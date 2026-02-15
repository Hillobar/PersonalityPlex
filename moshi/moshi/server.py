# SPDX-FileCopyrightText: Copyright (c) 2026 NVIDIA CORPORATION & AFFILIATES. All rights reserved.
# SPDX-License-Identifier: MIT
#
# Permission is hereby granted, free of charge, to any person obtaining a
# copy of this software and associated documentation files (the "Software"),
# to deal in the Software without restriction, including without limitation
# the rights to use, copy, modify, merge, publish, distribute, sublicense,
# and/or sell copies of the Software, and to permit persons to whom the
# Software is furnished to do so, subject to the following conditions:
#
# The above copyright notice and this permission notice shall be included in
# all copies or substantial portions of the Software.
#
# THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
# IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
# FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL
# THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
# LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING
# FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER
# DEALINGS IN THE SOFTWARE.


# Copyright (c) Kyutai, all rights reserved.
# This source code is licensed under the license found in the
# LICENSE file in the root directory of this source tree.

import argparse
import asyncio
import base64
import json
import os
from pathlib import Path
import random
import tarfile
import secrets
import sys
from typing import Literal, Optional

import aiohttp
from aiohttp import web
# from huggingface_hub import hf_hub_download
import numpy as np
import sentencepiece
import sphn
import torch
from dotenv import load_dotenv

# Load environment variables from .env file
load_dotenv()
from .models import loaders, MimiModel, LMModel, LMGen
from .utils.connection import create_ssl_context, get_lan_ip
from .utils.logging import setup_logger, ColorizedLog
from .voice_discovery import VoiceDiscovery


logger = setup_logger(__name__)
DeviceString = Literal["cuda"] | Literal["cpu"] #| Literal["mps"]

def torch_auto_device(requested: Optional[DeviceString] = None) -> torch.device:
    """Return a torch.device based on the requested string or availability."""
    if requested is not None:
        return torch.device(requested)
    if torch.cuda.is_available():
        return torch.device("cuda")
    #elif hasattr(torch.backends, "mps") and torch.backends.mps.is_available():
    #    return torch.device("mps")
    return torch.device("cpu")


def seed_all(seed):
    torch.manual_seed(seed)
    if torch.cuda.is_available():
        torch.cuda.manual_seed(seed)
        torch.cuda.manual_seed_all(seed)  # for multi-GPU setups
    random.seed(seed)
    np.random.seed(seed)
    torch.backends.cudnn.deterministic = False
    torch.backends.cudnn.benchmark = False


def wrap_with_system_tags(text: str) -> str:
    """Add system tags as the model expects if they are missing.
    Example: "<system> You enjoy having a good conversation. Have a deep conversation about technology. Your name is Jane. <system>"
    """
    cleaned = text.strip()
    if cleaned.startswith("<system>") and cleaned.endswith("<system>"):
        return cleaned
    return f"<system> {cleaned} <system>"


class ServerState:
    def __init__(self, mimi: MimiModel, text_tokenizer: sentencepiece.SentencePieceProcessor,
                 lm: LMModel, device: str | torch.device, voice_prompt_dir: str | None = None,
                 save_voice_prompt_embeddings: bool = False):
        self.mimi = mimi
        self.text_tokenizer = text_tokenizer
        self.device = device
        self.voice_prompt_dir = voice_prompt_dir
        self.frame_size = int(self.mimi.sample_rate / self.mimi.frame_rate)
        self.save_voice_prompt_embeddings = save_voice_prompt_embeddings
        self.lm = lm
        self.lm_gen = LMGen(lm,
                            audio_silence_frame_cnt=int(0.5 * self.mimi.frame_rate),
                            sample_rate=self.mimi.sample_rate,
                            device=device,
                            frame_rate=self.mimi.frame_rate,
                            save_voice_prompt_embeddings=save_voice_prompt_embeddings,
        )
        
        self.lock = asyncio.Lock()
        self.mimi.streaming_forever(1)
        self.lm_gen.streaming_forever(1)
    
    def warmup(self):
        for _ in range(4):
            chunk = torch.zeros(1, 1, self.frame_size, dtype=torch.float32, device=self.device)
            codes = self.mimi.encode(chunk)
            for c in range(codes.shape[-1]):
                tokens = self.lm_gen.step(codes[:, :, c: c + 1])
                if tokens is None:
                    continue
                _ = self.mimi.decode(tokens[:, 1:9])

        if self.device.type == 'cuda':
            torch.cuda.synchronize()


    async def handle_chat(self, request):
        ws = web.WebSocketResponse()
        await ws.prepare(request)
        clog = ColorizedLog.randomize()
        peer = request.remote  # IP
        peer_port = request.transport.get_extra_info("peername")[1]  # Port
        clog.log("info", f"Incoming connection from {peer}:{peer_port}")

        # Load all conversation params from the personality JSON file
        personality_id = request.query.get("personality_id", "")
        if not personality_id:
            clog.log("error", "No personality_id provided, closing connection")
            await ws.close(message=b"personality_id is required")
            return ws

        personalities_dir = Path.cwd() / "Personalities"
        personality_file = self._find_personality_file(personalities_dir, personality_id)
        if not personality_file or not personality_file.exists():
            clog.log("error", f"Personality file not found for id {personality_id}")
            await ws.close(message=b"Personality not found")
            return ws

        personality_data = json.loads(personality_file.read_text(encoding="utf-8"))

        # Voice embedding: load from inline embeddingData stored in the personality
        embedding_data_b64 = personality_data.get("embeddingData", "")
        cache_key = f"personality:{personality_id}"

        if embedding_data_b64:
            if self.lm_gen.voice_prompt != cache_key:
                self.lm_gen.load_voice_prompt_embeddings_from_data(embedding_data_b64, cache_key)
                logger.info(f"Loaded inline embedding for personality {personality_id}")
        else:
            clog.log("warning", f"Personality {personality_id} has no embeddingData")

        # Text prompt
        text_prompt = personality_data.get("description", "")
        additional_text = personality_data.get("additionalText", "")
        if text_prompt:
            tokens = self.text_tokenizer.encode(wrap_with_system_tags(text_prompt))
            if additional_text:
                tokens = tokens + self.text_tokenizer.encode(additional_text)
            self.lm_gen.text_prompt_tokens = tokens
        else:
            self.lm_gen.text_prompt_tokens = None

        # Sampling params
        self.lm_gen.temp_text = float(personality_data.get("textTemperature", 0.7))
        self.lm_gen.top_k_text = max(1, int(personality_data.get("textTopk", 25)))
        self.lm_gen.temp = float(personality_data.get("audioTemperature", 0.8))
        self.lm_gen.top_k = max(1, int(personality_data.get("audioTopk", 250)))

        # Seed
        seed_value = personality_data.get("seed", -1)
        seed = int(seed_value) if seed_value is not None else None

        async def recv_loop():
            nonlocal close
            try:
                async for message in ws:
                    if message.type == aiohttp.WSMsgType.ERROR:
                        clog.log("error", f"{ws.exception()}")
                        break
                    elif message.type == aiohttp.WSMsgType.CLOSED:
                        break
                    elif message.type == aiohttp.WSMsgType.CLOSE:
                        break
                    elif message.type != aiohttp.WSMsgType.BINARY:
                        clog.log("error", f"unexpected message type {message.type}")
                        continue
                    message = message.data
                    if not isinstance(message, bytes):
                        clog.log("error", f"unsupported message type {type(message)}")
                        continue
                    if len(message) == 0:
                        clog.log("warning", "empty message")
                        continue
                    kind = message[0]
                    if kind == 1:  # audio
                        payload = message[1:]
                        opus_reader.append_bytes(payload)
                    else:
                        clog.log("warning", f"unknown message kind {kind}")
            finally:
                close = True
                clog.log("info", "connection closed")

        async def opus_loop():
            all_pcm_data = None

            while True:
                if close:
                    return
                await asyncio.sleep(0.001)
                pcm = opus_reader.read_pcm()
                if pcm.shape[-1] == 0:
                    continue
                if all_pcm_data is None:
                    all_pcm_data = pcm
                else:
                    all_pcm_data = np.concatenate((all_pcm_data, pcm))
                while all_pcm_data.shape[-1] >= self.frame_size:
                    chunk = all_pcm_data[: self.frame_size]
                    all_pcm_data = all_pcm_data[self.frame_size:]
                    chunk = torch.from_numpy(chunk)
                    chunk = chunk.to(device=self.device)[None, None]
                    codes = self.mimi.encode(chunk)
                    for c in range(codes.shape[-1]):
                        tokens = self.lm_gen.step(codes[:, :, c: c + 1])
                        if tokens is None:
                            continue
                        assert tokens.shape[1] == self.lm_gen.lm_model.dep_q + 1
                        main_pcm = self.mimi.decode(tokens[:, 1:9])
                        main_pcm = main_pcm.cpu()
                        opus_writer.append_pcm(main_pcm[0, 0].numpy())
                        text_token = tokens[0, 0, 0].item()
                        # 0 = EPAD (end-of-padding), 3 = PAD — skip non-content tokens
                        if text_token not in (0, 3):
                            _text = self.text_tokenizer.id_to_piece(text_token)  # type: ignore
                            _text = _text.replace("▁", " ")
                            msg = b"\x02" + bytes(_text, encoding="utf8")
                            await ws.send_bytes(msg)
        async def send_loop():
            while True:
                if close:
                    return
                await asyncio.sleep(0.001)
                msg = opus_writer.read_bytes()
                if len(msg) > 0:
                    await ws.send_bytes(b"\x01" + msg)

        clog.log("info", "accepted connection")
        clog.log("info", f"personality: {personality_data.get('name', personality_id)}")
        if text_prompt:
            clog.log("info", f"text prompt: {text_prompt}")
        if embedding_data_b64:
            clog.log("info", f"voice embedding: loaded from personality file")
        close = False
        async with self.lock:
            if seed is not None and seed != -1:
                seed_all(seed)

            opus_writer = sphn.OpusStreamWriter(self.mimi.sample_rate)
            opus_reader = sphn.OpusStreamReader(self.mimi.sample_rate)
            self.mimi.reset_streaming()
            self.lm_gen.reset_streaming()
            async def is_alive():
                if close or ws.closed:
                    return False
                try:
                    # Check for disconnect without waiting too long
                    msg = await asyncio.wait_for(ws.receive(), timeout=0.01)
                    if msg.type in (aiohttp.WSMsgType.CLOSE, aiohttp.WSMsgType.CLOSED, aiohttp.WSMsgType.ERROR):
                        return False
                except asyncio.TimeoutError:
                    # No messages → client probably still alive
                    return True
                except aiohttp.ClientConnectionError:
                    return False
                return True
            # Reuse mimi for encoding voice prompt and then reset it before conversation starts
            await self.lm_gen.step_system_prompts_async(self.mimi, is_alive=is_alive)
            self.mimi.reset_streaming()
            clog.log("info", "done with system prompts")
            # Send the handshake.
            if await is_alive():
                await ws.send_bytes(b"\x00")
                clog.log("info", "sent handshake bytes")
                # Clean cancellation manager
                tasks = [
                    asyncio.create_task(recv_loop()),
                    asyncio.create_task(opus_loop()),
                    asyncio.create_task(send_loop()),
                ]

                done, pending = await asyncio.wait(tasks, return_when=asyncio.FIRST_COMPLETED)
                # Force-kill remaining tasks
                for task in pending:
                    task.cancel()
                    try:
                        await task
                    except asyncio.CancelledError:
                        pass
                await ws.close()
                clog.log("info", "session closed")
        clog.log("info", "done with connection")
        return ws

    @staticmethod
    def _personality_filename(name: str, pid: str) -> str:
        """Build a filename like 'MyPersonality_abc123.json' from name + id."""
        safe_name = "".join(c if c.isalnum() or c in (" ", "-", "_") else "" for c in name).strip().replace(" ", "_")
        return f"{safe_name}_{pid}.json" if safe_name else f"{pid}.json"

    @staticmethod
    def _find_personality_file(personalities_dir: Path, pid: str) -> Path | None:
        """Find a personality JSON by its id, regardless of the name prefix."""
        for f in personalities_dir.glob(f"*_{pid}.json"):
            return f
        # Fallback: old format without name prefix
        old = personalities_dir / f"{pid}.json"
        return old if old.exists() else None

    async def handle_generate_embedding(self, request):
        """Accept an uploaded audio file, generate voice prompt embeddings, and save as .pt."""
        try:
            reader = await request.multipart()

            audio_data = None
            embedding_name = None

            while True:
                part = await reader.next()
                if part is None:
                    break
                if part.name == "audio":
                    audio_data = await part.read()
                elif part.name == "name":
                    embedding_name = (await part.read()).decode("utf-8").strip()

            if audio_data is None or not embedding_name:
                return web.json_response({"error": "missing audio file or embedding name"}, status=400)

            # Save uploaded audio to voice prompt directory
            if self.voice_prompt_dir is None:
                return web.json_response({"error": "no voice prompt directory configured"}, status=500)

            audio_path = os.path.join(self.voice_prompt_dir, f"{embedding_name}.wav")
            with open(audio_path, "wb") as f:
                f.write(audio_data)

            # Enable embedding saving, load the audio, and step through prompts to generate .pt
            prev_save = self.lm_gen.save_voice_prompt_embeddings
            prev_text_tokens = self.lm_gen.text_prompt_tokens
            self.lm_gen.save_voice_prompt_embeddings = True
            self.lm_gen.text_prompt_tokens = self.text_tokenizer.encode(
                wrap_with_system_tags("You enjoy having a good conversation.")
            )
            self.mimi.reset_streaming()
            self.lm_gen.reset_streaming()
            self.lm_gen.load_voice_prompt(audio_path)
            self.lm_gen.step_system_prompts(self.mimi)
            self.mimi.reset_streaming()
            self.lm_gen.reset_streaming()
            self.lm_gen.save_voice_prompt_embeddings = prev_save
            self.lm_gen.text_prompt_tokens = prev_text_tokens

            # Re-enter streaming mode for normal operation
            self.mimi.streaming_forever(1)
            self.lm_gen.streaming_forever(1)

            pt_path = os.path.splitext(audio_path)[0] + ".pt"
            if not os.path.exists(pt_path):
                return web.json_response({"error": "embedding file was not created"}, status=500)

            # Remove the temporary .wav file now that the .pt embedding exists
            if os.path.exists(audio_path):
                os.unlink(audio_path)

            return web.json_response({"status": "ok", "embedding": f"{embedding_name}.pt"})
        except Exception as e:
            logger.error(f"Error generating embedding: {e}")
            return web.json_response({"error": str(e)}, status=500)

    async def handle_test_embedding(self, request):
        """Load a voice embedding, run inference with a text prompt, and return generated WAV audio."""
        try:
            data = await request.json()
            embedding_name = data.get("name", "").strip()
            test_text = data.get("text", "").strip()

            if not embedding_name:
                return web.json_response({"error": "missing embedding name"}, status=400)

            if self.voice_prompt_dir is None:
                return web.json_response({"error": "no voice prompt directory configured"}, status=500)

            pt_path = os.path.join(self.voice_prompt_dir, f"{embedding_name}.pt")
            if not os.path.exists(pt_path):
                return web.json_response({"error": f"embedding '{embedding_name}.pt' not found"}, status=404)

            # Save and override state
            prev_text_tokens = self.lm_gen.text_prompt_tokens
            if test_text:
                self.lm_gen.text_prompt_tokens = self.text_tokenizer.encode(
                    wrap_with_system_tags(test_text)
                )
            elif self.lm_gen.text_prompt_tokens is None:
                self.lm_gen.text_prompt_tokens = self.text_tokenizer.encode(
                    wrap_with_system_tags("You enjoy having a good conversation.")
                )

            # Load embedding and step system prompts
            self.mimi.reset_streaming()
            self.lm_gen.reset_streaming()
            self.lm_gen.load_voice_prompt_embeddings(pt_path)
            self.lm_gen.step_system_prompts(self.mimi)
            self.mimi.reset_streaming()

            # Collect text tokens to feed during generation so the model speaks the text
            gen_text_tokens = list(self.lm_gen.text_prompt_tokens) if self.lm_gen.text_prompt_tokens else []
            text_idx = 0

            # Generate audio frames by feeding silence input and text tokens
            num_steps = int(self.mimi.frame_rate * 5)  # 5 seconds of output
            generated_pcm = []
            for _ in range(num_steps):
                codes = self.mimi.encode(
                    torch.zeros(1, 1, self.frame_size, device=self.device)
                )
                for c in range(codes.shape[-1]):
                    # Feed text tokens one at a time to guide speech generation
                    tt = gen_text_tokens[text_idx] if text_idx < len(gen_text_tokens) else None
                    tokens = self.lm_gen.step(codes[:, :, c: c + 1], text_token=tt)
                    if tt is not None:
                        text_idx += 1
                    if tokens is None:
                        continue
                    pcm = self.mimi.decode(tokens[:, 1:9])
                    generated_pcm.append(pcm[0, 0].cpu().numpy())

            # Restore state and re-enter streaming
            self.lm_gen.text_prompt_tokens = prev_text_tokens
            self.mimi.reset_streaming()
            self.lm_gen.reset_streaming()
            self.mimi.streaming_forever(1)
            self.lm_gen.streaming_forever(1)

            if not generated_pcm:
                return web.json_response({"error": "no audio generated"}, status=500)

            # Concatenate and write WAV to bytes
            import tempfile
            audio_data = np.concatenate(generated_pcm, axis=-1)
            tmp = tempfile.NamedTemporaryFile(suffix=".wav", delete=False)
            tmp_path = tmp.name
            tmp.close()
            try:
                sphn.write_wav(tmp_path, audio_data, self.mimi.sample_rate)
                with open(tmp_path, "rb") as f:
                    wav_bytes = f.read()
            finally:
                os.unlink(tmp_path)

            return web.Response(
                body=wav_bytes,
                content_type="audio/wav",
            )
        except Exception as e:
            logger.error(f"Error testing embedding: {e}")
            # Attempt to restore streaming on error
            try:
                self.mimi.reset_streaming()
                self.lm_gen.reset_streaming()
                self.mimi.streaming_forever(1)
                self.lm_gen.streaming_forever(1)
            except Exception:
                pass
            return web.json_response({"error": str(e)}, status=500)

def _get_voice_prompt_dir(voice_prompt_dir: Optional[str], hf_repo: str) -> Optional[str]:
    """
    If voice_prompt_dir is None:
      - download voices.tgz from HF
      - extract it once
      - return extracted directory
    If voice_prompt_dir is provided:
      - just return it
    """
    if voice_prompt_dir is not None:
        return voice_prompt_dir

    # logger.info("retrieving voice prompts")

    # voices_tgz = hf_hub_download(hf_repo, "voices.tgz")
    # voices_tgz = Path(voices_tgz)
    # voices_dir = voices_tgz.parent / "voices"

    # if not voices_dir.exists():
    #     logger.info(f"extracting {voices_tgz} to {voices_dir}")
    #     with tarfile.open(voices_tgz, "r:gz") as tar:
    #         tar.extractall(path=voices_tgz.parent)

    # if not voices_dir.exists():
    #     raise RuntimeError("voices.tgz did not contain a 'voices/' directory")

    return str(voices_dir)


def _is_valid_ui_build(dist_path: Path) -> bool:
    """
    Validate that a directory contains a valid UI build.

    Args:
        dist_path: Path to the dist directory

    Returns:
        True if the directory contains a valid build (has index.html), False otherwise
    """
    if not dist_path.is_dir():
        return False

    # Check for essential file - index.html must exist and be non-empty
    index_html = dist_path / "index.html"
    try:
        return index_html.exists() and index_html.stat().st_size > 0
    except (OSError, PermissionError):
        return False


def _get_static_path(static: Optional[str]) -> Optional[str]:
    if static is None:
        # Auto-detect: prefer local custom UI (client/dist) if it exists
        try:
            # Priority 1: Check current working directory (works for all install modes)
            cwd_dist = Path.cwd() / "client" / "dist"
            if _is_valid_ui_build(cwd_dist):
                logger.info(f"Found custom UI at {cwd_dist}, using it instead of default")
                return str(cwd_dist)

            # Priority 2: Check project root relative to __file__ (works for editable installs)
            # server.py is in moshi/moshi/, so project root is 2 levels up
            project_root = Path(__file__).parent.parent.parent
            local_dist = project_root / "client" / "dist"

            if _is_valid_ui_build(local_dist):
                logger.info(f"Found custom UI at {local_dist}, using it instead of default")
                return str(local_dist)

        except (OSError, PermissionError) as e:
            logger.warning(f"Could not check for custom UI: {e}. Falling back to default.")
            # Fall through to HuggingFace download

    elif static != "none":
        # When set to the "none" string, we don't serve any static content.
        return static
    return None


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--host", default="localhost", type=str)
    parser.add_argument("--port", default=8998, type=int)
    parser.add_argument("--static", type=str)
    parser.add_argument("--gradio-tunnel", action='store_true', help='Activate a gradio tunnel.')
    parser.add_argument("--gradio-tunnel-token",
                        help='Provide a custom (secret) token here to keep getting the same URL.')

    parser.add_argument("--tokenizer", type=str, help="Path to a local tokenizer file.")
    parser.add_argument("--moshi-weight", type=str, help="Path to a local checkpoint file for Moshi.")
    parser.add_argument("--mimi-weight", type=str, help="Path to a local checkpoint file for Mimi.")
    parser.add_argument("--hf-repo", type=str, default=loaders.DEFAULT_REPO,
                        help="HF repo to look into, defaults PersonaPlex. "
                             "Use this to select a different pre-trained model.")
    parser.add_argument("--device", type=str, default="cuda", help="Device on which to run, defaults to 'cuda'.")
    parser.add_argument("--cpu-offload", action="store_true",
                        help="Offload LM model layers to CPU when GPU memory is insufficient. "
                             "Requires 'accelerate' package.")
    parser.add_argument(
        "--voice-prompt-dir",
        type=str,
        help=(
            "Directory containing voice prompt files. "
            "If omitted, voices.tgz is downloaded from HF and extracted."
            "Voice prompt filenames from client requests will be joined with this directory path."
        )
    )
    parser.add_argument(
        "--ssl",
        type=str,
        help=(
            "use https instead of http, this flag should point to a directory "
            "that contains valid key.pem and cert.pem files"
        )
    )

    args = parser.parse_args()

    # Warn if .env exists but HF_TOKEN is not set
    env_file = Path(__file__).parent.parent.parent / ".env"
    if env_file.exists() and not os.getenv("HF_TOKEN"):
        logger.warning(
            "Found .env file but HF_TOKEN is not set. "
            "Models requiring authentication may fail to download. "
            "See .env.example for configuration details."
        )

    args.voice_prompt_dir = Path.cwd() / 'Personalities' / 'Embeddings'
    args.voice_prompt_dir.mkdir(parents=True, exist_ok=True)
    logger.info(f"voice_prompt_dir = {args.voice_prompt_dir}")

    static_path: None | str = _get_static_path(args.static)
    assert static_path is None or os.path.exists(static_path), \
        f"Static path does not exist: {static_path}."
    logger.info(f"static_path = {static_path}")
    args.device = torch_auto_device(args.device)

    seed_all(42424242)

    setup_tunnel = None
    tunnel_token = ''
    if args.gradio_tunnel:
        try:
            from gradio import networking  # type: ignore
        except ImportError:
            logger.error("Cannot find gradio which is required to activate a tunnel. "
                         "Please install with `pip install gradio`.")
            sys.exit(1)
        setup_tunnel = networking.setup_tunnel
        if args.gradio_tunnel_token is None:
            tunnel_token = secrets.token_urlsafe(32)
        else:
            tunnel_token = args.gradio_tunnel_token

    # -- Deferred model loading: serve the frontend immediately, load models in background --

    loading_state = {
        "state": None,       # ServerState, set once models are loaded
        "status": "Waiting for model paths...",
        "ready": False,
        "loading": False,    # True while models are being loaded
    }

    voice_prompt_dir = str(args.voice_prompt_dir)
    hf_repo = args.hf_repo
    device = args.device
    cpu_offload = args.cpu_offload

    # --- Standalone handlers for file-based operations (no models needed) ---

    async def handle_list_personalities(request):
        personalities_dir = Path.cwd() / "Personalities"
        personalities_dir.mkdir(exist_ok=True)
        personalities = []
        for f in sorted(personalities_dir.glob("*.json")):
            try:
                data = json.loads(f.read_text(encoding="utf-8"))
                data.pop("embeddingData", None)
                personalities.append(data)
            except Exception as e:
                logger.warning(f"Failed to read personality {f}: {e}")
        return web.json_response(personalities)

    async def handle_save_personality(request):
        personalities_dir = Path.cwd() / "Personalities"
        personalities_dir.mkdir(exist_ok=True)
        try:
            data = await request.json()
            pid = data.get("id")
            if not pid:
                return web.json_response({"error": "missing id"}, status=400)

            # Check if embedding changed compared to existing personality
            embedding_filename = data.get("embedding", "")
            old_file = ServerState._find_personality_file(personalities_dir, pid)
            old_embedding = ""
            if old_file and old_file.exists():
                old_data = json.loads(old_file.read_text(encoding="utf-8"))
                old_embedding = old_data.get("embedding", "")

            old_embedding_data = old_data.get("embeddingData", "") if old_file and old_file.exists() else ""

            if embedding_filename != old_embedding or not old_embedding_data:
                # Embedding changed or no existing embeddingData — read the .pt file and inline it
                if embedding_filename and embedding_filename.endswith(".pt") and voice_prompt_dir is not None:
                    pt_path = os.path.join(voice_prompt_dir, embedding_filename)
                    if os.path.exists(pt_path):
                        with open(pt_path, "rb") as f:
                            pt_bytes = f.read()
                        data["embeddingData"] = base64.b64encode(pt_bytes).decode("ascii")
                        logger.info(f"Inlined embedding data from {pt_path} ({len(pt_bytes)} bytes)")
            else:
                # Embedding unchanged — preserve existing embeddingData
                data["embeddingData"] = old_embedding_data

            new_filename = ServerState._personality_filename(data.get("name", ""), pid)
            if old_file and old_file.name != new_filename:
                old_file.unlink()
            filepath = personalities_dir / new_filename
            filepath.write_text(json.dumps(data, indent=2), encoding="utf-8")
            return web.json_response({"status": "ok"})
        except Exception as e:
            logger.error(f"Error saving personality: {e}")
            return web.json_response({"error": str(e)}, status=500)

    async def handle_delete_personality(request):
        personalities_dir = Path.cwd() / "Personalities"
        pid = request.match_info.get("id")
        if not pid:
            return web.json_response({"error": "missing id"}, status=400)
        filepath = ServerState._find_personality_file(personalities_dir, pid)
        if filepath and filepath.exists():
            filepath.unlink()
            return web.json_response({"status": "ok"})
        return web.json_response({"error": "not found"}, status=404)

    async def handle_list_voices(request):
        try:
            voices = VoiceDiscovery.list_voices()
            return web.json_response({'voices': voices, 'count': len(voices)})
        except Exception as e:
            logger.error(f"Error listing voices: {e}")
            return web.json_response({'error': str(e)}, status=500)

    # --- Settings (persisted to Settings/settings.json) ---

    settings_dir = Path.cwd() / "Settings"
    settings_dir.mkdir(exist_ok=True)
    settings_file = settings_dir / "settings.json"

    async def handle_get_settings(request):
        if settings_file.exists():
            try:
                data = json.loads(settings_file.read_text(encoding="utf-8"))
                return web.json_response(data)
            except Exception:
                pass
        return web.json_response({"moshiWeightsPath": "", "mimiWeightsPath": "", "textEncoderPath": ""})

    def _clean_path(p: str) -> str:
        """Strip whitespace and surrounding quotes from a user-entered path."""
        return p.strip().strip("\"'")

    async def handle_save_settings(request):
        try:
            data = await request.json()
            for key in ("moshiWeightsPath", "mimiWeightsPath", "textEncoderPath"):
                if key in data and isinstance(data[key], str):
                    data[key] = _clean_path(data[key])
            settings_file.write_text(json.dumps(data, indent=2), encoding="utf-8")
            return web.json_response({"status": "ok"})
        except Exception as e:
            logger.error(f"Error saving settings: {e}")
            return web.json_response({"error": str(e)}, status=500)

    # --- Status endpoint so the frontend knows when models are ready ---

    async def handle_status(request):
        return web.json_response({
            "ready": loading_state["ready"],
            "loading": loading_state["loading"],
            "status": loading_state["status"],
        })

    # --- Wrappers for model-dependent handlers ---

    async def handle_chat(request):
        if not loading_state["ready"]:
            ws = web.WebSocketResponse()
            await ws.prepare(request)
            await ws.close(message=b"Models are still loading")
            return ws
        return await loading_state["state"].handle_chat(request)

    async def handle_generate_embedding(request):
        if not loading_state["ready"]:
            return web.json_response({"error": "Models are still loading"}, status=503)
        return await loading_state["state"].handle_generate_embedding(request)

    async def handle_test_embedding(request):
        if not loading_state["ready"]:
            return web.json_response({"error": "Models are still loading"}, status=503)
        return await loading_state["state"].handle_test_embedding(request)

    # --- Background model loading task (triggered by POST /api/load-models) ---

    async def load_models_task(mimi_path: str, text_encoder_path: str, moshi_path: str):
        loading_state["loading"] = True
        try:
            def _load_all():
                loading_state["status"] = "Loading Mimi..."
                logger.info(f"loading mimi from {mimi_path}")
                mimi = loaders.get_mimi(mimi_path, device)
                logger.info("mimi loaded")

                loading_state["status"] = "Loading tokenizer..."
                logger.info(f"loading tokenizer from {text_encoder_path}")
                text_tokenizer = sentencepiece.SentencePieceProcessor(text_encoder_path)  # type: ignore
                logger.info("tokenizer loaded")

                loading_state["status"] = "Loading Moshi..."
                logger.info(f"loading moshi from {moshi_path}")
                lm = loaders.get_moshi_lm(moshi_path, device=device, cpu_offload=cpu_offload)
                lm.eval()
                logger.info("moshi loaded")

                loading_state["status"] = "Warming up..."
                logger.info("warming up the model")
                state = ServerState(
                    mimi=mimi,
                    text_tokenizer=text_tokenizer,
                    lm=lm,
                    device=device,
                    voice_prompt_dir=voice_prompt_dir,
                    save_voice_prompt_embeddings=False,
                )
                state.warmup()
                return state

            state = await asyncio.to_thread(_load_all)
            loading_state["state"] = state
            loading_state["ready"] = True
            loading_state["status"] = "Ready"
            logger.info("All models loaded and warmed up - ready for connections")
        except Exception as e:
            loading_state["status"] = f"Error: {e}"
            logger.error(f"Failed to load models: {e}")
        finally:
            loading_state["loading"] = False

    async def handle_load_models(request):
        if loading_state["loading"]:
            return web.json_response({"error": "Models are already loading"}, status=409)
        if loading_state["ready"]:
            return web.json_response({"status": "already loaded", "ready": True})

        data = await request.json()
        moshi_path = _clean_path(data.get("moshiWeightsPath", ""))
        mimi_path = _clean_path(data.get("mimiWeightsPath", ""))
        text_encoder_path = _clean_path(data.get("textEncoderPath", ""))

        if not moshi_path or not mimi_path or not text_encoder_path:
            return web.json_response({"error": "All three model paths are required"}, status=400)

        asyncio.create_task(load_models_task(mimi_path, text_encoder_path, moshi_path))
        return web.json_response({"status": "loading started"})

    # --- Create app and register routes ---

    app = web.Application()

    async def test_endpoint(request):
        return web.json_response({"status": "ok", "test": True})

    app.router.add_get("/api/test", test_endpoint)
    app.router.add_get("/api/status", handle_status)
    app.router.add_get("/api/settings", handle_get_settings)
    app.router.add_post("/api/settings", handle_save_settings)
    app.router.add_post("/api/load-models", handle_load_models)
    app.router.add_get("/api/chat", handle_chat)
    app.router.add_get("/api/voices", handle_list_voices)
    app.router.add_get("/api/personalities", handle_list_personalities)
    app.router.add_post("/api/personalities", handle_save_personality)
    app.router.add_delete("/api/personalities/{id}", handle_delete_personality)
    app.router.add_post("/api/generate-embedding", handle_generate_embedding)
    app.router.add_post("/api/test-embedding", handle_test_embedding)

    logger.info(f"Registered routes: {[r.resource.canonical for r in app.router.routes()]}")

    # Register static routes AFTER API routes
    if static_path is not None:
        async def handle_root(_):
            return web.FileResponse(os.path.join(static_path, "index.html"))

        logger.info(f"serving static content from {static_path}")
        app.router.add_get("/", handle_root)
        app.router.add_static(
            "/", path=static_path, follow_symlinks=True, name="static"
        )

    # Debug: log all routes after registration
    logger.info(f"All registered routes: {[(r.method, r.resource.canonical) for r in app.router.routes()]}")
    protocol = "http"
    ssl_context = None
    if args.ssl is not None:
        ssl_context, protocol = create_ssl_context(args.ssl)
    host_ip = args.host if args.host not in ("0.0.0.0", "::", "localhost") else get_lan_ip()
    logger.info(f"Access the Web UI directly at {protocol}://{host_ip}:{args.port}")
    if setup_tunnel is not None:
        tunnel = setup_tunnel('localhost', args.port, tunnel_token, None)
        logger.info(f"Tunnel started, if executing on a remote GPU, you can use {tunnel}.")
    # Suppress harmless ConnectionResetError from Windows ProactorEventLoop
    # when WebSocket clients disconnect abruptly.
    if sys.platform == "win32":
        loop = asyncio.new_event_loop()
        _default_handler = loop.get_exception_handler()
        def _ignore_connection_reset(loop, context):
            exc = context.get("exception")
            if isinstance(exc, ConnectionResetError):
                return
            if _default_handler:
                _default_handler(loop, context)
            else:
                loop.default_exception_handler(context)
        loop.set_exception_handler(_ignore_connection_reset)
        asyncio.set_event_loop(loop)

    web.run_app(app, port=args.port, ssl_context=ssl_context)


with torch.no_grad():
    main()

import moshiProcessorUrl from "../../audio-processor.ts?worker&url";
import { FC, useEffect, useState, useCallback, useRef } from "react";
import eruda from "eruda";
import { useSearchParams } from "react-router-dom";
import { Conversation } from "../Conversation/Conversation";
import { ServerAudio } from "../Conversation/components/ServerAudio/ServerAudio";
import { UserAudio } from "../Conversation/components/UserAudio/UserAudio";
import { TextDisplay } from "../Conversation/components/TextDisplay/TextDisplay";
import { useSocketContext } from "../Conversation/SocketContext";
import { useConversationState } from "../Conversation/ConversationStateContext";
import { Button } from "../../components/Button/Button";
import {
  useModelParams,
  DEFAULT_TEXT_TEMPERATURE,
  DEFAULT_TEXT_TOPK,
  DEFAULT_AUDIO_TEMPERATURE,
  DEFAULT_AUDIO_TOPK,
  DEFAULT_RANDOM_SEED,
} from "../Conversation/hooks/useModelParams";
import { env } from "../../env";
import { prewarmDecoderWorker } from "../../decoder/decoderWorker";
import { usePersonalities, type Personality } from "../../hooks/usePersonalities";
import { type ThemeType } from "../Conversation/hooks/useSystemTheme";

const PersonalitiesPane: FC<{
  personalities: Personality[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onAdd: () => void;
  onCreateEmbedding: () => void;
  onEdit: (id: string) => void;
  onDelete: (id: string) => void;
  onSettings: () => void;
}> = ({ personalities, selectedId, onSelect, onAdd, onCreateEmbedding, onEdit, onDelete, onSettings }) => {
  const [showMenu, setShowMenu] = useState(false);
  return (
    <div className="flex flex-col h-full border-r border-gray-700 bg-gray-900">
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-700">
        <h2 className="text-sm font-semibold text-gray-300">Personalities</h2>
        <div className="relative">
          <button
            onClick={() => setShowMenu((v) => !v)}
            className="w-7 h-7 flex items-center justify-center rounded bg-gray-800 border border-gray-600 hover:bg-gray-700 text-gray-400"
            title="Add"
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
              <path fillRule="evenodd" d="M8.22 5.22a.75.75 0 0 1 1.06 0l4.25 4.25a.75.75 0 0 1 0 1.06l-4.25 4.25a.75.75 0 0 1-1.06-1.06L11.94 10 8.22 6.28a.75.75 0 0 1 0-1.06Z" clipRule="evenodd" />
            </svg>
          </button>
          {showMenu && (
            <div className="absolute right-0 top-full mt-1 bg-gray-800 border border-gray-600 rounded shadow-lg z-50 w-48">
              <button
                onClick={() => { setShowMenu(false); onAdd(); }}
                className="w-full text-left px-3 py-2 text-sm text-gray-300 hover:bg-gray-700"
              >
                Create new personality
              </button>
              <button
                onClick={() => { setShowMenu(false); onCreateEmbedding(); }}
                className="w-full text-left px-3 py-2 text-sm text-gray-300 hover:bg-gray-700 border-t border-gray-700"
              >
                Create a voice embedding
              </button>
            </div>
          )}
        </div>
      </div>
      <div className="flex-1 overflow-y-auto">
        {personalities.length === 0 ? (
          <p className="text-xs text-gray-500 p-4 text-center">No personalities yet</p>
        ) : (
          personalities.map((p) => {
            const isSelected = selectedId === p.id;
            return (
              <div
                key={p.id}
                onClick={() => onSelect(p.id)}
                className={`flex items-center w-full px-4 py-2 text-sm border-b border-gray-700 transition-colors cursor-pointer ${
                  isSelected
                    ? "bg-[#76b900] text-white"
                    : "text-gray-300 hover:bg-gray-800"
                }`}
              >
                <span className="flex-1 truncate text-left">{p.name}</span>
                <button
                  onClick={(e) => { e.stopPropagation(); onEdit(p.id); }}
                  className={`w-6 h-6 flex items-center justify-center rounded hover:bg-white/10 flex-shrink-0 ${
                    isSelected ? "text-white/80 hover:text-white" : "text-gray-500 hover:text-gray-300"
                  }`}
                  title="Rename"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-3.5 h-3.5">
                    <path fillRule="evenodd" d="M7.84 1.804A1 1 0 0 1 8.82 1h2.36a1 1 0 0 1 .98.804l.331 1.652a6.993 6.993 0 0 1 1.929 1.115l1.598-.54a1 1 0 0 1 1.186.447l1.18 2.044a1 1 0 0 1-.205 1.251l-1.267 1.113a7.047 7.047 0 0 1 0 2.228l1.267 1.113a1 1 0 0 1 .206 1.25l-1.18 2.045a1 1 0 0 1-1.187.447l-1.598-.54a6.993 6.993 0 0 1-1.929 1.115l-.33 1.652a1 1 0 0 1-.98.804H8.82a1 1 0 0 1-.98-.804l-.331-1.652a6.993 6.993 0 0 1-1.929-1.115l-1.598.54a1 1 0 0 1-1.186-.447l-1.18-2.044a1 1 0 0 1 .205-1.251l1.267-1.114a7.05 7.05 0 0 1 0-2.227L1.821 7.773a1 1 0 0 1-.206-1.25l1.18-2.045a1 1 0 0 1 1.187-.447l1.598.54A6.992 6.992 0 0 1 7.51 3.456l.33-1.652ZM10 13a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z" clipRule="evenodd" />
                  </svg>
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); onDelete(p.id); }}
                  className={`w-6 h-6 flex items-center justify-center rounded hover:bg-white/10 flex-shrink-0 ml-0.5 ${
                    isSelected ? "text-white/80 hover:text-white" : "text-gray-500 hover:text-red-400"
                  }`}
                  title="Delete"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-3.5 h-3.5">
                    <path fillRule="evenodd" d="M8.75 1A2.75 2.75 0 0 0 6 3.75v.443c-.795.077-1.584.176-2.365.298a.75.75 0 1 0 .23 1.482l.149-.022.841 10.518A2.75 2.75 0 0 0 7.596 19h4.807a2.75 2.75 0 0 0 2.742-2.53l.841-10.519.149.023a.75.75 0 0 0 .23-1.482A41.03 41.03 0 0 0 14 4.193V3.75A2.75 2.75 0 0 0 11.25 1h-2.5ZM10 4c.84 0 1.673.025 2.5.075V3.75c0-.69-.56-1.25-1.25-1.25h-2.5c-.69 0-1.25.56-1.25 1.25v.325C8.327 4.025 9.16 4 10 4ZM8.58 7.72a.75.75 0 0 0-1.5.06l.3 7.5a.75.75 0 1 0 1.5-.06l-.3-7.5Zm4.34.06a.75.75 0 1 0-1.5-.06l-.3 7.5a.75.75 0 1 0 1.5.06l.3-7.5Z" clipRule="evenodd" />
                  </svg>
                </button>
              </div>
            );
          })
        )}
      </div>
      <div
        onClick={onSettings}
        className="flex items-center justify-between px-4 py-3 border-t border-gray-700 cursor-pointer hover:bg-gray-800 transition-colors"
      >
        <span className="text-sm font-semibold text-gray-300">Settings</span>
        <div className="w-7 h-7 flex items-center justify-center rounded bg-gray-800 border border-gray-600 hover:bg-gray-700 text-gray-400">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
            <path fillRule="evenodd" d="M8.22 5.22a.75.75 0 0 1 1.06 0l4.25 4.25a.75.75 0 0 1 0 1.06l-4.25 4.25a.75.75 0 0 1-1.06-1.06L11.94 10 8.22 6.28a.75.75 0 0 1 0-1.06Z" clipRule="evenodd" />
          </svg>
        </div>
      </div>
    </div>
  );
};

const handleSliderWheel = (
  e: React.WheelEvent<HTMLInputElement>,
  setValue: (v: number) => void,
) => {
  const input = e.currentTarget;
  const step = parseFloat(input.step) || 1;
  const min = parseFloat(input.min);
  const max = parseFloat(input.max);
  const current = parseFloat(input.value);
  const delta = e.deltaY < 0 ? step : -step;
  setValue(Math.min(max, Math.max(min, parseFloat((current + delta).toFixed(10)))));
};

type PersonalityFormData = Omit<Personality, "id">;

const PersonalityModal: FC<{
  onSave: (data: PersonalityFormData) => void;
  onCancel: () => void;
  initial?: PersonalityFormData;
}> = ({ onSave, onCancel, initial }) => {
  const isEditing = !!initial;
  const [name, setName] = useState(initial?.name ?? "");
  const [avatar, setAvatar] = useState(initial?.avatar ?? "");
  const [shortDescription, setShortDescription] = useState(initial?.shortDescription ?? "");
  const [description, setDescription] = useState(initial?.description ?? "You enjoy having a good conversation..");
  const [additionalText, setAdditionalText] = useState(initial?.additionalText ?? "");
  const [embedding, setEmbedding] = useState(initial?.embedding ?? "");
  const [textTemperature, setTextTemperature] = useState(initial?.textTemperature ?? DEFAULT_TEXT_TEMPERATURE);
  const [textTopk, setTextTopk] = useState(initial?.textTopk ?? DEFAULT_TEXT_TOPK);
  const [audioTemperature, setAudioTemperature] = useState(initial?.audioTemperature ?? DEFAULT_AUDIO_TEMPERATURE);
  const [audioTopk, setAudioTopk] = useState(initial?.audioTopk ?? DEFAULT_AUDIO_TOPK);
  const [seed, setSeed] = useState(initial?.seed ?? DEFAULT_RANDOM_SEED);

  const handleSave = () => {
    if (!name.trim()) return;
    onSave({ name: name.trim(), avatar, shortDescription, description, additionalText, embedding, textTemperature, textTopk, audioTemperature, audioTopk, seed });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-gray-800 rounded-lg shadow-lg p-6 w-96 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-base font-semibold text-gray-100">{isEditing ? "Edit Personality" : "New Personality"}</h3>
          <button
            type="button"
            onClick={() => {
              const input = document.createElement("input");
              input.type = "file";
              input.accept = "image/*";
              input.onchange = (e) => {
                const file = (e.target as HTMLInputElement).files?.[0];
                if (!file) return;
                const reader = new FileReader();
                reader.onload = () => {
                  const img = new Image();
                  img.onload = () => {
                    const MAX = 100;
                    let w = img.width;
                    let h = img.height;
                    if (w > MAX || h > MAX) {
                      const scale = Math.min(MAX / w, MAX / h);
                      w = Math.round(w * scale);
                      h = Math.round(h * scale);
                    }
                    const canvas = document.createElement("canvas");
                    canvas.width = w;
                    canvas.height = h;
                    canvas.getContext("2d")!.drawImage(img, 0, 0, w, h);
                    setAvatar(canvas.toDataURL(file.type || "image/png"));
                  };
                  img.src = reader.result as string;
                };
                reader.readAsDataURL(file);
              };
              input.click();
            }}
            className="w-12 h-12 flex-shrink-0 rounded border border-gray-600 hover:border-[#76b900] overflow-hidden bg-gray-700 flex items-center justify-center cursor-pointer"
            title="Click to set avatar"
          >
            {avatar ? (
              <img src={avatar} alt="avatar" className="w-full h-full object-cover" />
            ) : (
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5 text-gray-400">
                <path d="M1 5.25A2.25 2.25 0 0 1 3.25 3h13.5A2.25 2.25 0 0 1 19 5.25v9.5A2.25 2.25 0 0 1 16.75 17H3.25A2.25 2.25 0 0 1 1 14.75v-9.5Zm1.5 5.81v3.69c0 .414.336.75.75.75h13.5a.75.75 0 0 0 .75-.75v-2.69l-2.22-2.219a.75.75 0 0 0-1.06 0l-1.91 1.909-4.97-4.969a.75.75 0 0 0-1.06 0L2.5 11.06Zm12.5-3.31a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3Z" />
              </svg>
            )}
          </button>
        </div>

        <label className="block text-xs font-medium text-gray-400 mb-1">Name</label>
        <input
          autoFocus
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") handleSave(); }}
          placeholder="Enter name..."
          className="w-full p-2 border border-gray-600 rounded text-sm bg-gray-700 text-gray-100 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-[#76b900] focus:border-transparent mb-3"
        />

        <label className="block text-xs font-medium text-gray-400 mb-1">Description</label>
        <input
          type="text"
          value={shortDescription}
          onChange={(e) => setShortDescription(e.target.value)}
          placeholder="Enter description..."
          className="w-full p-2 border border-gray-600 rounded text-sm bg-gray-700 text-gray-100 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-[#76b900] focus:border-transparent mb-3"
        />

        <label className="block text-xs font-medium text-gray-400 mb-1">Role (System Prompt)</label>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Enter role / system prompt..."
          rows={3}
          className="w-full p-2 border border-gray-600 rounded text-sm bg-gray-700 text-gray-100 placeholder-gray-500 resize-y focus:outline-none focus:ring-2 focus:ring-[#76b900] focus:border-transparent mb-3"
        />

        <label className="block text-xs font-medium text-gray-400 mb-1">Additional Text</label>
        <textarea
          value={additionalText}
          onChange={(e) => setAdditionalText(e.target.value)}
          placeholder="Enter additional text..."
          rows={3}
          className="w-full p-2 border border-gray-600 rounded text-sm bg-gray-700 text-gray-100 placeholder-gray-500 resize-y focus:outline-none focus:ring-2 focus:ring-[#76b900] focus:border-transparent mb-3"
        />

        <label className="block text-xs font-medium text-gray-400 mb-1">Embedding</label>
        <div className="mb-3">
          <button
            onClick={() => {
              const input = document.createElement("input");
              input.type = "file";
              input.accept = ".pt,.bin,.safetensors";
              input.onchange = (e) => {
                const file = (e.target as HTMLInputElement).files?.[0];
                if (file) setEmbedding(file.name);
              };
              input.click();
            }}
            className="px-3 py-1.5 text-sm bg-gray-700 border border-gray-600 rounded hover:bg-gray-600 text-gray-300"
          >
            Embedding
          </button>
          {embedding && <span className="ml-2 text-xs text-gray-400 truncate">{embedding}</span>}
        </div>

        <div className="flex items-center gap-2 mb-2">
          <label className="text-xs font-medium text-gray-400 w-24">Text Temp</label>
          <input
            type="range" min={0.5} max={1.5} step={0.01}
            value={textTemperature}
            onChange={(e) => setTextTemperature(Number(e.target.value))}
            onWheel={(e) => handleSliderWheel(e, setTextTemperature)}
            className="flex-1"
          />
          <span className="text-xs text-gray-400 w-10 text-right">{textTemperature.toFixed(2)}</span>
        </div>

        <div className="flex items-center gap-2 mb-2">
          <label className="text-xs font-medium text-gray-400 w-24">Text TopK</label>
          <input
            type="range" min={1} max={200} step={1}
            value={textTopk}
            onChange={(e) => setTextTopk(Number(e.target.value))}
            onWheel={(e) => handleSliderWheel(e, setTextTopk)}
            className="flex-1"
          />
          <span className="text-xs text-gray-400 w-10 text-right">{textTopk}</span>
        </div>

        <div className="flex items-center gap-2 mb-2">
          <label className="text-xs font-medium text-gray-400 w-24">Audio Temp</label>
          <input
            type="range" min={0.5} max={1.5} step={0.01}
            value={audioTemperature}
            onChange={(e) => setAudioTemperature(Number(e.target.value))}
            onWheel={(e) => handleSliderWheel(e, setAudioTemperature)}
            className="flex-1"
          />
          <span className="text-xs text-gray-400 w-10 text-right">{audioTemperature.toFixed(2)}</span>
        </div>

        <div className="flex items-center gap-2 mb-2">
          <label className="text-xs font-medium text-gray-400 w-24">Audio TopK</label>
          <input
            type="range" min={1} max={500} step={1}
            value={audioTopk}
            onChange={(e) => setAudioTopk(Number(e.target.value))}
            onWheel={(e) => handleSliderWheel(e, setAudioTopk)}
            className="flex-1"
          />
          <span className="text-xs text-gray-400 w-10 text-right">{audioTopk}</span>
        </div>

        <div className="flex items-center gap-2 mb-4">
          <label className="text-xs font-medium text-gray-400 w-24">Seed</label>
          <input
            type="number"
            value={seed}
            onChange={(e) => setSeed(Number(e.target.value))}
            placeholder="-1 for random"
            className="flex-1 p-1.5 border border-gray-600 rounded text-sm bg-gray-700 text-gray-100 focus:outline-none focus:ring-2 focus:ring-[#76b900] focus:border-transparent"
          />
        </div>

        <div className="flex justify-end gap-2">
          <button
            onClick={onCancel}
            className="px-3 py-1.5 text-sm text-gray-400 hover:text-gray-200 rounded border border-gray-600 hover:bg-gray-700"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={!name.trim()}
            className="px-3 py-1.5 text-sm text-white bg-[#76b900] hover:bg-[#6aa600] rounded disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Save
          </button>
        </div>
      </div>
    </div>
  );
};

const EmbeddingModal: FC<{
  onClose: () => void;
}> = ({ onClose }) => {
  const [inputAudio, setInputAudio] = useState<File | null>(null);
  const [embeddingName, setEmbeddingName] = useState("");
  const [testText, setTestText] = useState("");
  const [generating, setGenerating] = useState(false);
  const [testing, setTesting] = useState(false);
  const [status, setStatus] = useState<string | null>(null);

  const handleGenerate = async () => {
    if (!inputAudio || !embeddingName.trim()) return;
    setGenerating(true);
    setStatus("Uploading audio...");
    try {
      const formData = new FormData();
      formData.append("audio", inputAudio);
      formData.append("name", embeddingName.trim());
      setStatus("Generating embedding (this may take a moment)...");
      const res = await fetch("/api/generate-embedding", { method: "POST", body: formData });
      const data = await res.json();
      if (res.ok) {
        setStatus(`Embedding created: ${data.embedding}`);
      } else {
        setStatus(`Error: ${data.error}`);
      }
    } catch (e) {
      setStatus(`Error: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setGenerating(false);
    }
  };

  const handleTest = async () => {
    if (!embeddingName.trim()) return;
    setTesting(true);
    setStatus("Generating test audio...");
    try {
      const res = await fetch("/api/test-embedding", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: embeddingName.trim(), text: testText.trim() }),
      });
      if (!res.ok) {
        const data = await res.json();
        setStatus(`Error: ${data.error}`);
        return;
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const audio = new Audio(url);
      audio.onended = () => { URL.revokeObjectURL(url); setStatus(null); };
      audio.play();
      setStatus("Playing test audio...");
    } catch (e) {
      setStatus(`Error: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setTesting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-gray-800 rounded-lg shadow-lg p-6 w-96">
        <h3 className="text-base font-semibold text-gray-100 mb-4">Create Voice Embedding</h3>

        <label className="block text-xs font-medium text-gray-400 mb-1">Input audio</label>
        <div className="mb-3">
          <button
            onClick={() => {
              const input = document.createElement("input");
              input.type = "file";
              input.accept = "audio/*";
              input.onchange = (e) => {
                const file = (e.target as HTMLInputElement).files?.[0];
                if (file) setInputAudio(file);
              };
              input.click();
            }}
            className="px-3 py-1.5 text-sm bg-gray-700 border border-gray-600 rounded hover:bg-gray-600 text-gray-300"
          >
            Select audio file
          </button>
          {inputAudio && <span className="ml-2 text-xs text-gray-400 truncate">{inputAudio.name}</span>}
        </div>

        <label className="block text-xs font-medium text-gray-400 mb-1">Embedding name</label>
        <input
          type="text"
          value={embeddingName}
          onChange={(e) => setEmbeddingName(e.target.value)}
          placeholder="Enter embedding name..."
          className="w-full p-2 border border-gray-600 rounded text-sm bg-gray-700 text-gray-100 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-[#76b900] focus:border-transparent mb-3"
        />

        <button
          onClick={handleGenerate}
          disabled={!inputAudio || !embeddingName.trim() || generating}
          className="w-full px-3 py-2 text-sm text-white bg-[#76b900] hover:bg-[#6aa600] rounded disabled:opacity-40 disabled:cursor-not-allowed mb-3"
        >
          {generating ? "Generating..." : "Generate Embedding"}
        </button>

        <label className="block text-xs font-medium text-gray-400 mb-1">Test Text</label>
        <textarea
          value={testText}
          onChange={(e) => setTestText(e.target.value)}
          placeholder="Enter test text..."
          rows={3}
          className="w-full p-2 border border-gray-600 rounded text-sm bg-gray-700 text-gray-100 placeholder-gray-500 resize-y focus:outline-none focus:ring-2 focus:ring-[#76b900] focus:border-transparent mb-3"
        />

        <button
          onClick={handleTest}
          disabled={!embeddingName.trim() || testing}
          className="w-full px-3 py-2 text-sm text-white bg-[#76b900] hover:bg-[#6aa600] rounded disabled:opacity-40 disabled:cursor-not-allowed mb-4"
        >
          {testing ? "Testing..." : "Test Embedding"}
        </button>

        <div className="flex items-center justify-between">
          {status ? (
            <p className={`text-xs flex items-center gap-1.5 ${status.startsWith("Error") ? "text-red-500" : "text-green-600"}`}>
              {(generating || testing) && !status.startsWith("Error") && (
                <span className="inline-block w-3 h-3 border-2 border-current border-t-transparent rounded-full animate-spin" />
              )}
              {status}
            </p>
          ) : <span />}
          <button
            onClick={onClose}
            className="px-3 py-1.5 text-sm text-gray-400 hover:text-gray-200 rounded border border-gray-600 hover:bg-gray-700"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

interface AppSettings {
  moshiWeightsPath: string;
  mimiWeightsPath: string;
  textEncoderPath: string;
}

const DEFAULT_SETTINGS: AppSettings = { moshiWeightsPath: "", mimiWeightsPath: "", textEncoderPath: "" };

async function fetchSettings(): Promise<AppSettings> {
  try {
    const res = await fetch("/api/settings");
    if (res.ok) return await res.json() as AppSettings;
  } catch { /* server not up yet */ }
  return DEFAULT_SETTINGS;
}

async function saveSettings(settings: AppSettings): Promise<void> {
  try {
    await fetch("/api/settings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(settings),
    });
  } catch { /* ignore */ }
}

function settingsComplete(s: AppSettings): boolean {
  return !!(s.moshiWeightsPath && s.mimiWeightsPath && s.textEncoderPath);
}

const FilePathField: FC<{
  label: string;
  value: string;
  placeholder: string;
  onChange: (value: string) => void;
}> = ({ label, value, placeholder, onChange }) => {
  return (
    <div className="mb-4">
      <label className="block text-xs font-medium text-gray-400 mb-1">{label}</label>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full p-2 border border-gray-600 rounded text-sm bg-gray-700 text-gray-100 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-[#76b900] focus:border-transparent"
      />
    </div>
  );
};

const SettingsModal: FC<{
  onClose: () => void;
  initial: AppSettings;
  onSave: (settings: AppSettings) => void;
}> = ({ onClose, initial, onSave }) => {
  const [moshiWeightsPath, setMoshiWeightsPath] = useState(initial.moshiWeightsPath);
  const [mimiWeightsPath, setMimiWeightsPath] = useState(initial.mimiWeightsPath);
  const [textEncoderPath, setTextEncoderPath] = useState(initial.textEncoderPath);

  const handleSave = () => {
    const settings: AppSettings = { moshiWeightsPath, mimiWeightsPath, textEncoderPath };
    onSave(settings);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-gray-800 rounded-lg shadow-lg p-6 w-96">
        <h3 className="text-base font-semibold text-gray-100 mb-1">Settings</h3>
        <p className="text-xs text-gray-500 mb-4">Paths to weights must be entered as text due to browser security restrictions.</p>

        <FilePathField
          label="Moshi Weights"
          value={moshiWeightsPath}
          placeholder="e.g. F:\models\moshi\model.safetensors"
          onChange={setMoshiWeightsPath}
        />

        <FilePathField
          label="Mimi Weights"
          value={mimiWeightsPath}
          placeholder="e.g. F:\models\mimi\tokenizer.safetensors"
          onChange={setMimiWeightsPath}
        />

        <FilePathField
          label="Text Encoder"
          value={textEncoderPath}
          placeholder="e.g. F:\models\text\tokenizer_spm_32k_3.model"
          onChange={setTextEncoderPath}
        />

        <div className="flex justify-end gap-2 mt-2">
          <button
            onClick={onClose}
            className="px-3 py-1.5 text-sm text-gray-400 hover:text-gray-200 rounded border border-gray-600 hover:bg-gray-700"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="px-3 py-1.5 text-sm text-white bg-[#76b900] hover:bg-[#6aa600] rounded"
          >
            Save
          </button>
        </div>
      </div>
    </div>
  );
};

interface SetupPanelProps {
  isConnected: boolean;
  showMicrophoneAccessMessage: boolean;
  modelsReady: boolean;
  modelsLoading: boolean;
  loadingStatus: string;
  pathsConfigured: boolean;
  onConnect: () => Promise<void>;
  onDisconnect: () => void;
  onLoadModels: () => void;
  onOpenSettings: () => void;
}

const SetupPanel: FC<SetupPanelProps> = ({
  isConnected, showMicrophoneAccessMessage, modelsReady, modelsLoading, loadingStatus,
  pathsConfigured, onConnect, onDisconnect, onLoadModels, onOpenSettings,
}) => {
  let buttonLabel: string;
  let buttonAction: () => void;
  let buttonDisabled = false;

  if (isConnected) {
    buttonLabel = "Disconnect";
    buttonAction = onDisconnect;
  } else if (modelsReady) {
    buttonLabel = "Talk to your Personality";
    buttonAction = async () => await onConnect();
  } else if (modelsLoading) {
    buttonLabel = "Loading models...";
    buttonAction = () => {};
    buttonDisabled = true;
  } else if (!pathsConfigured) {
    buttonLabel = "Set model paths";
    buttonAction = onOpenSettings;
  } else {
    // Paths configured but not loaded (initial state or error — allow retry)
    buttonLabel = "Load Models";
    buttonAction = onLoadModels;
  }

  const showError = !modelsReady && !modelsLoading && loadingStatus.startsWith("Error");

  return (
    <div className="flex-shrink-0 border-b border-gray-700 bg-gray-900 p-4">
      <div className="flex flex-col items-center gap-3">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-100">PersonalityPlex</h1>
          <p className="text-xs text-gray-500">Full duplex Personalities</p>
        </div>
        {modelsReady && !isConnected && (
          <div className="flex items-center gap-2">
            <span className="inline-block w-2.5 h-2.5 rounded-full bg-[#76b900]" />
            <span className="text-xs text-gray-400">Models loaded</span>
          </div>
        )}
        {modelsLoading && (
          <div className="flex items-center gap-2">
            <span className="inline-block w-3 h-3 border-2 border-[#76b900] border-t-transparent rounded-full animate-spin" />
            <span className="text-xs text-gray-400">{loadingStatus}</span>
          </div>
        )}
        {showError && (
          <span className="text-xs text-red-500 text-center max-w-xs">{loadingStatus}</span>
        )}
        {showMicrophoneAccessMessage && (
          <span className="text-xs text-red-500">Enable microphone</span>
        )}
        <Button onClick={buttonAction} disabled={buttonDisabled}>
          {buttonLabel}
        </Button>
      </div>
    </div>
  );
}

const ConversationDisplay: FC<{ theme: ThemeType; personalityName?: string; personalityAvatar?: string }> = ({ theme, personalityName, personalityAvatar }) => {
  const { socketStatus } = useSocketContext();
  const { isMediaReady, socketColor } = useConversationState();
  const textContainerRef = useRef<HTMLDivElement>(null);

  return (
    <div className="flex flex-col h-full">
      <div className="flex-shrink-0 flex justify-center items-center gap-2 py-2">
        <div className={`h-4 w-4 rounded-full ${socketColor}`} />
        <span className="text-sm text-gray-500">{socketStatus}</span>
      </div>
      {isMediaReady ? (
        <>
          <div className="flex-shrink-0 px-4 py-2 space-y-3">
            {/* Input meter - "You" */}
            <div>
              <div className="ml-11">
                <p className="text-xs font-semibold text-gray-400 mb-1">You</p>
              </div>
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full flex-shrink-0 border border-gray-600 bg-gray-700 flex items-center justify-center">
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5 text-gray-400">
                    <path d="M10 8a3 3 0 1 0 0-6 3 3 0 0 0 0 6ZM3.465 14.493a1.23 1.23 0 0 0 .41 1.412A9.957 9.957 0 0 0 10 18c2.31 0 4.438-.784 6.131-2.1.43-.333.604-.903.408-1.41a7.002 7.002 0 0 0-13.074.003Z" />
                  </svg>
                </div>
                <div className="flex-1">
                  <UserAudio theme={theme} />
                </div>
              </div>
            </div>
            {/* Output meter - Personality */}
            <div>
              <div className="ml-11">
                <p className="text-xs font-semibold text-gray-400 mb-1">{personalityName || "AI"}</p>
              </div>
              <div className="flex items-center gap-3">
                {personalityAvatar ? (
                  <img
                    src={personalityAvatar}
                    alt={personalityName || "AI"}
                    className="w-8 h-8 rounded-full object-cover flex-shrink-0 border border-gray-600"
                  />
                ) : (
                  <div className="w-8 h-8 rounded-full flex-shrink-0 border border-gray-600 bg-gray-700 flex items-center justify-center">
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5 text-gray-400">
                      <path d="M10 8a3 3 0 1 0 0-6 3 3 0 0 0 0 6ZM3.465 14.493a1.23 1.23 0 0 0 .41 1.412A9.957 9.957 0 0 0 10 18c2.31 0 4.438-.784 6.131-2.1.43-.333.604-.903.408-1.41a7.002 7.002 0 0 0-13.074.003Z" />
                    </svg>
                  </div>
                )}
                <div className="flex-1">
                  <ServerAudio theme={theme} />
                </div>
              </div>
            </div>
          </div>
          <div className="flex-1 flex flex-col px-4 overflow-hidden min-h-0">
            <div className="flex-1 overflow-auto scrollbar min-h-0" ref={textContainerRef}>
              <TextDisplay containerRef={textContainerRef} />
            </div>
          </div>
        </>
      ) : (
        <div className="flex-1 flex items-center justify-center text-gray-400 text-sm">
          Connecting...
        </div>
      )}
    </div>
  );
};

export const Queue:FC = () => {
  const theme = "dark" as const;
  const [searchParams] = useSearchParams();
  const overrideWorkerAddr = searchParams.get("worker_addr");
  const [, setHasMicrophoneAccess] = useState<boolean>(false);
  const [showMicrophoneAccessMessage, setShowMicrophoneAccessMessage] = useState<boolean>(false);
  const modelParams = useModelParams();

  const { personalities, setPersonalities, savePersonality, deletePersonality: deletePersonalityApi } = usePersonalities();
  const [selectedPersonalityId, setSelectedPersonalityId] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [editingPersonalityId, setEditingPersonalityId] = useState<string | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [showEmbeddingModal, setShowEmbeddingModal] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [appSettings, setAppSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [modelsReady, setModelsReady] = useState(false);
  const [modelsLoading, setModelsLoading] = useState(false);
  const [loadingStatus, setLoadingStatus] = useState("Waiting for model paths...");
  const [showPathsWarning, setShowPathsWarning] = useState(false);

  const audioContext = useRef<AudioContext | null>(null);
  const worklet = useRef<AudioWorkletNode | null>(null);
  const sendMessageRef = useRef<((msg: any) => void) | null>(null);

  // Poll /api/status while models are loading
  const pollStatus = useCallback(() => {
    let cancelled = false;
    const poll = async () => {
      while (!cancelled) {
        try {
          const res = await fetch("/api/status");
          const data = await res.json();
          if (!cancelled) {
            setLoadingStatus(data.status);
            setModelsLoading(data.loading);
            if (data.ready) {
              setModelsReady(true);
              setModelsLoading(false);
              return;
            }
            if (!data.loading && !data.ready) {
              // Loading finished but not ready (error case)
              return;
            }
          }
        } catch { /* server not up yet */ }
        await new Promise((r) => setTimeout(r, 1000));
      }
    };
    poll();
    return () => { cancelled = true; };
  }, []);

  // Trigger model loading by sending paths to the server
  const triggerLoadModels = useCallback(async (settings: AppSettings) => {
    if (!settingsComplete(settings)) {
      setShowPathsWarning(true);
      return;
    }
    try {
      setModelsLoading(true);
      setLoadingStatus("Starting model loading...");
      const res = await fetch("/api/load-models", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(settings),
      });
      const data = await res.json();
      if (!res.ok) {
        setLoadingStatus(`Error: ${data.error}`);
        setModelsLoading(false);
        return;
      }
      // If models were already loaded, skip polling
      if (data.ready) {
        setModelsReady(true);
        setModelsLoading(false);
        setLoadingStatus("Ready");
        return;
      }
      // Start polling for progress
      pollStatus();
    } catch (e) {
      setLoadingStatus(`Error: ${e instanceof Error ? e.message : String(e)}`);
      setModelsLoading(false);
    }
  }, [pollStatus]);

  // On mount: check if models are already loaded, then fetch settings and auto-trigger if needed
  useEffect(() => {
    let cancelled = false;
    (async () => {
      // First check if models are already loaded (e.g. page refresh)
      let alreadyReady = false;
      try {
        const statusRes = await fetch("/api/status");
        const statusData = await statusRes.json();
        if (!cancelled && statusData.ready) {
          alreadyReady = true;
          setModelsReady(true);
          setModelsLoading(false);
          setLoadingStatus("Ready");
        }
      } catch { /* server not up yet */ }

      const settings = await fetchSettings();
      if (cancelled) return;
      setAppSettings(settings);
      if (!alreadyReady && settingsComplete(settings)) {
        triggerLoadModels(settings);
      } else if (!settingsComplete(settings) && !alreadyReady) {
        setShowPathsWarning(true);
      }
    })();
    return () => { cancelled = true; };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // enable eruda in development
  useEffect(() => {
    if(env.VITE_ENV === "development") {
      eruda.init();
    }
    () => {
      if(env.VITE_ENV === "development") {
        eruda.destroy();
      }
    };
  }, []);

  const getMicrophoneAccess = useCallback(async () => {
    try {
      await window.navigator.mediaDevices.getUserMedia({ audio: true });
      setHasMicrophoneAccess(true);
      return true;
    } catch(e) {
      console.error(e);
      setShowMicrophoneAccessMessage(true);
      setHasMicrophoneAccess(false);
    }
    return false;
}, [setHasMicrophoneAccess, setShowMicrophoneAccessMessage]);

  const startProcessor = useCallback(async () => {
    if(!audioContext.current) {
      audioContext.current = new AudioContext();
      // Prewarm decoder worker as soon as we have audio context
      // This gives WASM time to load while user grants mic access
      prewarmDecoderWorker(audioContext.current.sampleRate);
    }
    if(worklet.current) {
      return;
    }
    let ctx = audioContext.current;
    ctx.resume();
    try {
      worklet.current = new AudioWorkletNode(ctx, 'moshi-processor');
    } catch (err) {
      await ctx.audioWorklet.addModule(moshiProcessorUrl);
      worklet.current = new AudioWorkletNode(ctx, 'moshi-processor');
    }
    worklet.current.connect(ctx.destination);
  }, [audioContext, worklet]);

  const startConnection = useCallback(async() => {
      // Apply selected personality's description and embedding as text/voice prompts
      if (selectedPersonalityId) {
        const personality = personalities.find((p) => p.id === selectedPersonalityId);
        if (personality) {
          modelParams.setPersonalityId(personality.id);
          if (personality.description) {
            modelParams.setTextPrompt(personality.description);
          }
          modelParams.setAdditionalText(personality.additionalText || "");
          if (personality.embedding) {
            modelParams.setVoicePrompt(personality.embedding);
          }
          modelParams.setTextTemperature(personality.textTemperature);
          modelParams.setTextTopk(personality.textTopk);
          modelParams.setAudioTemperature(personality.audioTemperature);
          modelParams.setAudioTopk(personality.audioTopk);
          modelParams.setRandomSeed(personality.seed ?? DEFAULT_RANDOM_SEED);
        }
      } else {
        modelParams.setPersonalityId("");
      }
      await startProcessor();
      const hasAccess = await getMicrophoneAccess();
      if (hasAccess) {
        setIsConnected(true);
      }
  }, [startProcessor, getMicrophoneAccess, selectedPersonalityId, personalities, modelParams]);

  const closeModal = useCallback(() => {
    setShowModal(false);
    setEditingPersonalityId(null);
  }, []);

  const handleSavePersonality = useCallback((data: PersonalityFormData) => {
    if (editingPersonalityId) {
      const updated = { id: editingPersonalityId, ...data };
      setPersonalities((prev) =>
        prev.map((p) => (p.id === editingPersonalityId ? updated : p))
      );
      savePersonality(updated);
    } else {
      const newPersonality: Personality = { id: crypto.randomUUID(), ...data };
      setPersonalities((prev) => [...prev, newPersonality]);
      setSelectedPersonalityId(newPersonality.id);
      savePersonality(newPersonality);
    }
    closeModal();
  }, [editingPersonalityId, closeModal, savePersonality]);

  const handleEditPersonality = useCallback((id: string) => {
    setEditingPersonalityId(id);
    setShowModal(true);
  }, []);

  const handleDeletePersonality = useCallback((id: string) => {
    setPersonalities((prev) => prev.filter((p) => p.id !== id));
    setSelectedPersonalityId((prev) => (prev === id ? null : prev));
    deletePersonalityApi(id);
  }, [deletePersonalityApi]);

  const handleDisconnect = useCallback(() => {
    setIsConnected(false);
  }, []);

  return (
    <div className="flex h-screen w-screen bg-gray-900 text-gray-100">
      <div className="w-64 flex-shrink-0">
        <PersonalitiesPane
          personalities={personalities}
          selectedId={selectedPersonalityId}
          onSelect={setSelectedPersonalityId}
          onAdd={() => { setEditingPersonalityId(null); setShowModal(true); }}
          onCreateEmbedding={() => setShowEmbeddingModal(true)}
          onEdit={handleEditPersonality}
          onDelete={handleDeletePersonality}
          onSettings={() => setShowSettingsModal(true)}
        />
      </div>
      <div className="flex-1 flex flex-col overflow-hidden">
        <SetupPanel
          isConnected={isConnected}
          showMicrophoneAccessMessage={showMicrophoneAccessMessage}
          modelsReady={modelsReady}
          modelsLoading={modelsLoading}
          loadingStatus={loadingStatus}
          pathsConfigured={settingsComplete(appSettings)}
          onConnect={startConnection}
          onDisconnect={handleDisconnect}
          onLoadModels={() => triggerLoadModels(appSettings)}
          onOpenSettings={() => setShowSettingsModal(true)}
        />
        <div className="flex-1 overflow-hidden">
          <Conversation
            workerAddr={overrideWorkerAddr ?? ""}
            audioContext={audioContext}
            worklet={worklet}
            theme={theme}
            startConnection={startConnection}
            sendMessageRef={sendMessageRef}
            isActive={isConnected}
            onConversationEnd={handleDisconnect}
            {...modelParams}
          >
            {isConnected && (
              <ConversationDisplay
                theme={theme}
                personalityName={selectedPersonalityId ? personalities.find(p => p.id === selectedPersonalityId)?.name : undefined}
                personalityAvatar={selectedPersonalityId ? personalities.find(p => p.id === selectedPersonalityId)?.avatar : undefined}
              />
            )}
          </Conversation>
        </div>
      </div>
      {showModal && (
        <PersonalityModal
          onSave={handleSavePersonality}
          onCancel={closeModal}
          initial={editingPersonalityId ? (() => { const p = personalities.find((p) => p.id === editingPersonalityId); return p ? { name: p.name, avatar: p.avatar, shortDescription: p.shortDescription, description: p.description, additionalText: p.additionalText, embedding: p.embedding, textTemperature: p.textTemperature, textTopk: p.textTopk, audioTemperature: p.audioTemperature, audioTopk: p.audioTopk, seed: p.seed } : undefined; })() : undefined}
        />
      )}
      {showEmbeddingModal && (
        <EmbeddingModal onClose={() => setShowEmbeddingModal(false)} />
      )}
      {showSettingsModal && (
        <SettingsModal
          initial={appSettings}
          onSave={(settings) => {
            setAppSettings(settings);
            saveSettings(settings);
            if (settingsComplete(settings) && !modelsReady && !modelsLoading) {
              triggerLoadModels(settings);
            }
          }}
          onClose={() => setShowSettingsModal(false)}
        />
      )}
      {showPathsWarning && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-gray-800 rounded-lg shadow-lg p-6 w-96">
            <h3 className="text-base font-semibold text-gray-100 mb-3">Model Paths Required</h3>
            <p className="text-sm text-gray-400 mb-4">
              Model paths have not been configured yet. Please open Settings and set the file paths for
              Moshi Weights, Mimi Weights, and Text Encoder before loading.
            </p>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setShowPathsWarning(false)}
                className="px-3 py-1.5 text-sm text-gray-400 hover:text-gray-200 rounded border border-gray-600 hover:bg-gray-700"
              >
                Close
              </button>
              <button
                onClick={() => { setShowPathsWarning(false); setShowSettingsModal(true); }}
                className="px-3 py-1.5 text-sm text-white bg-[#76b900] hover:bg-[#6aa600] rounded"
              >
                Open Settings
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

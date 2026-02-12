import { FC, MutableRefObject, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSocket } from "./hooks/useSocket";
import { SocketContext } from "./SocketContext";
import { ServerAudio } from "./components/ServerAudio/ServerAudio";
import { UserAudio } from "./components/UserAudio/UserAudio";
import { Button } from "../../components/Button/Button";
import { ServerAudioStats } from "./components/ServerAudio/ServerAudioStats";
import { AudioStats } from "./hooks/useServerAudio";
import { TextDisplay } from "./components/TextDisplay/TextDisplay";
import { MediaContext } from "./MediaContext";
import { ServerInfo } from "./components/ServerInfo/ServerInfo";
import { ModelParamsValues, useModelParams } from "./hooks/useModelParams";
import fixWebmDuration from "webm-duration-fix";
import { getMimeType, getExtension } from "./getMimeType";
import { type ThemeType } from "./hooks/useSystemTheme";

type ConversationProps = {
  workerAddr: string;
  workerAuthId?: string;
  sessionAuthId?: string;
  sessionId?: number;
  email?: string;
  theme: ThemeType;
  audioContext: MutableRefObject<AudioContext|null>;
  worklet: MutableRefObject<AudioWorkletNode|null>;
  onConversationEnd?: () => void;
  isBypass?: boolean;
  isActive: boolean;
  startConnection: () => Promise<void>;
} & Partial<ModelParamsValues>;


const buildURL = ({
  workerAddr,
  params,
  workerAuthId,
  email,
  textSeed,
  audioSeed,
}: {
  workerAddr: string;
  params: ModelParamsValues;
  workerAuthId?: string;
  email?: string;
  textSeed: number;
  audioSeed: number;
}) => {
  const newWorkerAddr = useMemo(() => {
    if (workerAddr == "same" || workerAddr == "") {
      const newWorkerAddr = window.location.hostname + ":" + window.location.port;
      console.log("Overriding workerAddr to", newWorkerAddr);
      return newWorkerAddr;
    }
    return workerAddr;
  }, [workerAddr]);
  const wsProtocol = (window.location.protocol === 'https:') ? 'wss' : 'ws';
  const url = new URL(`${wsProtocol}://${newWorkerAddr}/api/chat`);
  if(workerAuthId) {
    url.searchParams.append("worker_auth_id", workerAuthId);
  }
  if(email) {
    url.searchParams.append("email", email);
  }
  url.searchParams.append("pad_mult", params.padMult.toString());
  url.searchParams.append("text_seed", textSeed.toString());
  url.searchParams.append("audio_seed", audioSeed.toString());
  url.searchParams.append("repetition_penalty_context", params.repetitionPenaltyContext.toString());
  url.searchParams.append("repetition_penalty", params.repetitionPenalty.toString());
  url.searchParams.append("text_prompt", params.textPrompt.toString());
  url.searchParams.append("voice_prompt", params.voicePrompt.toString());
  console.log(url.toString());
  return url.toString();
};


export const Conversation:FC<ConversationProps> = ({
  workerAddr,
  workerAuthId,
  audioContext,
  worklet,
  sessionAuthId,
  sessionId,
  onConversationEnd,
  startConnection,
  isBypass=false,
  isActive,
  email,
  theme,
  ...params
}) => {
  const getAudioStats = useRef<() => AudioStats>(() => ({
    playedAudioDuration: 0,
    missedAudioDuration: 0,
    totalAudioMessages: 0,
    delay: 0,
    minPlaybackDelay: 0,
    maxPlaybackDelay: 0,
  }));
  const isRecording = useRef<boolean>(false);
  const audioChunks = useRef<Blob[]>([]);

  const audioStreamDestination = useRef<MediaStreamAudioDestinationNode | null>(null);
  const stereoMerger = useRef<ChannelMergerNode | null>(null);
  const audioRecorder = useRef<MediaRecorder | null>(null);
  const [audioURL, setAudioURL] = useState<string>("");

  // Lazy-initialize audio recording infrastructure when audioContext becomes available
  useEffect(() => {
    if (!audioContext.current || audioStreamDestination.current) return;
    audioStreamDestination.current = audioContext.current.createMediaStreamDestination();
    stereoMerger.current = audioContext.current.createChannelMerger(2);
    audioRecorder.current = new MediaRecorder(
      audioStreamDestination.current.stream,
      { mimeType: getMimeType("audio"), audioBitsPerSecond: 128000 }
    );
  }, [isActive]);
  const [isOver, setIsOver] = useState(false);
  const modelParams = useModelParams(params);
  const micDuration = useRef<number>(0);
  const actualAudioPlayed = useRef<number>(0);
  const textContainerRef = useRef<HTMLDivElement>(null);
  const textSeed = useMemo(() => Math.round(1000000 * Math.random()), []);
  const audioSeed = useMemo(() => Math.round(1000000 * Math.random()), []);

  const WSURL = buildURL({
    workerAddr,
    params: modelParams,
    workerAuthId,
    email: email,
    textSeed: textSeed,
    audioSeed: audioSeed,
  });

  const onDisconnect = useCallback(() => {
    setIsOver(true);
    console.log("on disconnect!");
    stopRecording();
  }, [setIsOver]);

  const { socketStatus, sendMessage, socket, start, stop } = useSocket({
    // onMessage,
    uri: WSURL,
    onDisconnect,
  });
  useEffect(() => {
    if (!audioRecorder.current) return;
    audioRecorder.current.ondataavailable = (e) => {
      audioChunks.current.push(e.data);
    };
    audioRecorder.current.onstop = async () => {
      let blob: Blob;
      const mimeType = getMimeType("audio");
      if(mimeType.includes("webm")) {
        blob = await fixWebmDuration(new Blob(audioChunks.current, { type: mimeType }));
        } else {
          blob = new Blob(audioChunks.current, { type: mimeType });
      }
      setAudioURL(URL.createObjectURL(blob));
      audioChunks.current = [];
      console.log("Audio Recording and encoding finished");
    };
  }, [isActive]);


  useEffect(() => {
    if (isActive) {
      start();
    }
    return () => {
      stop();
    };
  }, [isActive]);

  const startRecording = useCallback(() => {
    if(isRecording.current || !stereoMerger.current || !audioStreamDestination.current || !audioRecorder.current) {
      return;
    }
    console.log(Date.now() % 1000, "Starting recording");
    console.log("Starting recording");
    // Build stereo routing for recording: left = server (worklet), right = user mic (connected in useUserAudio)
    try {
      stereoMerger.current.disconnect();
    } catch {}
    try {
      worklet.current?.disconnect(audioStreamDestination.current);
    } catch {}
    // Route server audio (mono) to left channel of merger
    worklet.current?.connect(stereoMerger.current, 0, 0);
    // Connect merger to the MediaStream destination
    stereoMerger.current.connect(audioStreamDestination.current);

    setAudioURL("");
    audioRecorder.current.start();
    isRecording.current = true;
  }, [isRecording, worklet, audioStreamDestination, audioRecorder, stereoMerger]);

  const stopRecording = useCallback(() => {
    console.log("Stopping recording");
    console.log("isRecording", isRecording)
    if(!isRecording.current || !stereoMerger.current || !audioStreamDestination.current || !audioRecorder.current) {
      return;
    }
    try {
      worklet.current?.disconnect(stereoMerger.current);
    } catch {}
    try {
      stereoMerger.current.disconnect(audioStreamDestination.current);
    } catch {}
    audioRecorder.current.stop();
    isRecording.current = false;
  }, [isRecording, worklet, audioStreamDestination, audioRecorder, stereoMerger]);

  // Notify parent when conversation ends
  useEffect(() => {
    if (isOver && onConversationEnd) {
      onConversationEnd();
    }
  }, [isOver, onConversationEnd]);

  const socketColor = useMemo(() => {
    if (socketStatus === "connected") {
      return 'bg-[#76b900]';
    } else if (socketStatus === "connecting") {
      return 'bg-orange-300';
    } else {
      return 'bg-red-400';
    }
  }, [socketStatus]);

  return (
    <SocketContext.Provider
      value={{
        socketStatus,
        sendMessage,
        socket,
      }}
    >
    <div>
    <div className="main-grid h-full max-h-full w-full p-4 max-w-screen-lg m-auto">
      <div className="controls text-center flex justify-center items-center gap-2">
          <div className={`h-4 w-4 rounded-full ${socketColor}`} />
          <span className="text-sm text-gray-500">{socketStatus}</span>
      <div className="flex flex-col gap-2 ml-4">
        <div className="flex items-center gap-2">
          <label className="text-sm w-32">Text Temp (0.7):</label>
          <input
            aria-label="text-temperature"
            type="range"
            min={0}
            max={2.0}
            step={0.01}
            value={modelParams.textTemperature}
            onChange={(e) => modelParams.setTextTemperature(Number(e.target.value))}
            className="w-40"
          />
          <div className="w-12 text-sm text-left">{modelParams.textTemperature.toFixed(2)}</div>
        </div>
        <div className="flex items-center gap-2">
          <label className="text-sm w-32">Text TopK (25):</label>
          <input
            aria-label="text-topk"
            type="range"
            min={5}
            max={500}
            step={1}
            value={modelParams.textTopk}
            onChange={(e) => modelParams.setTextTopk(Number(e.target.value))}
            className="w-40"
          />
          <div className="w-12 text-sm text-left">{modelParams.textTopk}</div>
        </div>
        <div className="flex items-center gap-2">
          <label className="text-sm w-32">Audio Temp (0.8):</label>
          <input
            aria-label="audio-temperature"
            type="range"
            min={0}
            max={2.0}
            step={0.01}
            value={modelParams.audioTemperature}
            onChange={(e) => modelParams.setAudioTemperature(Number(e.target.value))}
            className="w-40"
          />
          <div className="w-12 text-sm text-left">{modelParams.audioTemperature.toFixed(2)}</div>
        </div>
        <div className="flex items-center gap-2">
          <label className="text-sm w-32">Audio TopK (250):</label>
          <input
            aria-label="audio-topk"
            type="range"
            min={5}
            max={1000}
            step={1}
            value={modelParams.audioTopk}
            onChange={(e) => modelParams.setAudioTopk(Number(e.target.value))}
            className="w-40"
          />
          <div className="w-12 text-sm text-left">{modelParams.audioTopk}</div>
        </div>
        <Button onClick={() => {
          sendMessage({
            type: "metadata",
            data: {
              text_temperature: modelParams.textTemperature,
              text_topk: modelParams.textTopk,
              audio_temperature: modelParams.audioTemperature,
              audio_topk: modelParams.audioTopk,
            },
          });
        }}>
          Apply
        </Button>
      </div>
        </div>
        {audioContext.current && worklet.current && audioStreamDestination.current && stereoMerger.current && <MediaContext.Provider value={
          {
            startRecording,
            stopRecording,
            audioContext: audioContext as MutableRefObject<AudioContext>,
            worklet: worklet as MutableRefObject<AudioWorkletNode>,
            audioStreamDestination: audioStreamDestination as MutableRefObject<MediaStreamAudioDestinationNode>,
            stereoMerger: stereoMerger as MutableRefObject<ChannelMergerNode>,
            micDuration,
            actualAudioPlayed,
          }
        }>
          <div className="relative player h-full max-h-full w-full justify-between gap-3 md:p-12">
              <ServerAudio
                setGetAudioStats={(callback: () => AudioStats) =>
                  (getAudioStats.current = callback)
                }
                theme={theme}
              />
              <UserAudio theme={theme}/>
              <div className="pt-8 text-sm flex justify-center items-center flex-col download-links">
                {audioURL && <div><a href={audioURL} download={`personaplex_audio.${getExtension("audio")}`} className="pt-2 text-center block">Download audio</a></div>}
              </div>
          </div>
          <div className="scrollbar player-text" ref={textContainerRef}>
            <TextDisplay containerRef={textContainerRef}/>
          </div>
          <div className="player-stats hidden md:block">
            <ServerAudioStats getAudioStats={getAudioStats} />
          </div></MediaContext.Provider>}
        </div>
        <div className="max-w-96 md:max-w-screen-lg p-4 m-auto text-center">
          <ServerInfo/>
        </div>
      </div>
    </SocketContext.Provider>
  );
};

        // </MediaContext.Provider> : undefined}
        // 
        // }></MediaContext.Provider>

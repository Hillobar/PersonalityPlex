import { FC, MutableRefObject, ReactNode, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSocket } from "./hooks/useSocket";
import { SocketContext } from "./SocketContext";
import { ConversationStateContext } from "./ConversationStateContext";
import { MediaContext } from "./MediaContext";
import { ModelParamsValues, useModelParams } from "./hooks/useModelParams";
import fixWebmDuration from "webm-duration-fix";
import { getMimeType } from "./getMimeType";
import { type ThemeType } from "./hooks/useSystemTheme";

type ConversationProps = {
  workerAddr: string;
  theme: ThemeType;
  audioContext: MutableRefObject<AudioContext|null>;
  worklet: MutableRefObject<AudioWorkletNode|null>;
  onConversationEnd?: () => void;
  isBypass?: boolean;
  isActive: boolean;
  startConnection: () => Promise<void>;
  sendMessageRef?: MutableRefObject<((msg: any) => void) | null>;
  children?: ReactNode;
} & Partial<ModelParamsValues>;


const buildURL = ({
  workerAddr,
  params,
}: {
  workerAddr: string;
  params: ModelParamsValues;
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
  url.searchParams.append("text_prompt", params.textPrompt.toString());
  url.searchParams.append("additional_text", params.additionalText.toString());
  if (params.personalityId) {
    url.searchParams.append("personality_id", params.personalityId);
  }
  url.searchParams.append("voice_prompt", params.voicePrompt.toString());
  url.searchParams.append("seed", params.randomSeed.toString());
  console.log(url.toString());
  return url.toString();
};


export const Conversation:FC<ConversationProps> = ({
  workerAddr,
  audioContext,
  worklet,
  onConversationEnd,
  startConnection,
  sendMessageRef,
  isBypass=false,
  isActive,
  theme,
  children,
  ...params
}) => {
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
  const WSURL = buildURL({
    workerAddr,
    params: modelParams,
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

  // Expose sendMessage to parent via ref
  useEffect(() => {
    if (sendMessageRef) {
      sendMessageRef.current = sendMessage;
    }
    return () => {
      if (sendMessageRef) {
        sendMessageRef.current = null;
      }
    };
  }, [sendMessage, sendMessageRef]);

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

  const isMediaReady = !!(audioContext.current && worklet.current && audioStreamDestination.current && stereoMerger.current);

  return (
    <SocketContext.Provider value={{ socketStatus, sendMessage, socket }}>
      <ConversationStateContext.Provider value={{ audioURL, isMediaReady, socketColor }}>
        {isMediaReady ? (
          <MediaContext.Provider value={{
            startRecording,
            stopRecording,
            audioContext: audioContext as MutableRefObject<AudioContext>,
            worklet: worklet as MutableRefObject<AudioWorkletNode>,
            audioStreamDestination: audioStreamDestination as MutableRefObject<MediaStreamAudioDestinationNode>,
            stereoMerger: stereoMerger as MutableRefObject<ChannelMergerNode>,
            micDuration,
            actualAudioPlayed,
          }}>
            {children}
          </MediaContext.Provider>
        ) : (
          children
        )}
      </ConversationStateContext.Provider>
    </SocketContext.Provider>
  );
};

import moshiProcessorUrl from "../../audio-processor.ts?worker&url";
import { FC, useEffect, useState, useCallback, useRef } from "react";
import eruda from "eruda";
import { useSearchParams } from "react-router-dom";
import { Conversation } from "../Conversation/Conversation";
import { Button } from "../../components/Button/Button";
import {
  useModelParams,
  DEFAULT_TEXT_TEMPERATURE,
  DEFAULT_TEXT_TOPK,
  DEFAULT_AUDIO_TEMPERATURE,
  DEFAULT_AUDIO_TOPK,
} from "../Conversation/hooks/useModelParams";
import { env } from "../../env";
import { prewarmDecoderWorker } from "../../decoder/decoderWorker";
import { usePersonalities, type Personality } from "../../hooks/usePersonalities";

const PersonalitiesPane: FC<{
  personalities: Personality[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onAdd: () => void;
  onEdit: (id: string) => void;
  onDelete: (id: string) => void;
}> = ({ personalities, selectedId, onSelect, onAdd, onEdit, onDelete }) => {
  return (
    <div className="flex flex-col h-full border-r border-gray-300 bg-gray-50">
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-300">
        <h2 className="text-sm font-semibold text-gray-700">Personalities</h2>
        <button
          onClick={onAdd}
          className="w-7 h-7 flex items-center justify-center rounded bg-white border border-gray-300 hover:bg-gray-100 text-gray-600 text-lg leading-none"
          title="Add personality"
        >
          +
        </button>
      </div>
      <div className="flex-1 overflow-y-auto">
        {personalities.length === 0 ? (
          <p className="text-xs text-gray-400 p-4 text-center">No personalities yet</p>
        ) : (
          personalities.map((p) => {
            const isSelected = selectedId === p.id;
            return (
              <div
                key={p.id}
                onClick={() => onSelect(p.id)}
                className={`flex items-center w-full px-4 py-2 text-sm border-b border-gray-200 transition-colors cursor-pointer ${
                  isSelected
                    ? "bg-[#76b900] text-white"
                    : "text-gray-700 hover:bg-gray-100"
                }`}
              >
                <span className="flex-1 truncate text-left">{p.name}</span>
                <button
                  onClick={(e) => { e.stopPropagation(); onEdit(p.id); }}
                  className={`w-6 h-6 flex items-center justify-center rounded hover:bg-black/10 flex-shrink-0 ${
                    isSelected ? "text-white/80 hover:text-white" : "text-gray-400 hover:text-gray-600"
                  }`}
                  title="Rename"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-3.5 h-3.5">
                    <path fillRule="evenodd" d="M7.84 1.804A1 1 0 0 1 8.82 1h2.36a1 1 0 0 1 .98.804l.331 1.652a6.993 6.993 0 0 1 1.929 1.115l1.598-.54a1 1 0 0 1 1.186.447l1.18 2.044a1 1 0 0 1-.205 1.251l-1.267 1.113a7.047 7.047 0 0 1 0 2.228l1.267 1.113a1 1 0 0 1 .206 1.25l-1.18 2.045a1 1 0 0 1-1.187.447l-1.598-.54a6.993 6.993 0 0 1-1.929 1.115l-.33 1.652a1 1 0 0 1-.98.804H8.82a1 1 0 0 1-.98-.804l-.331-1.652a6.993 6.993 0 0 1-1.929-1.115l-1.598.54a1 1 0 0 1-1.186-.447l-1.18-2.044a1 1 0 0 1 .205-1.251l1.267-1.114a7.05 7.05 0 0 1 0-2.227L1.821 7.773a1 1 0 0 1-.206-1.25l1.18-2.045a1 1 0 0 1 1.187-.447l1.598.54A6.992 6.992 0 0 1 7.51 3.456l.33-1.652ZM10 13a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z" clipRule="evenodd" />
                  </svg>
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); onDelete(p.id); }}
                  className={`w-6 h-6 flex items-center justify-center rounded hover:bg-black/10 flex-shrink-0 ml-0.5 ${
                    isSelected ? "text-white/80 hover:text-white" : "text-gray-400 hover:text-red-500"
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
    </div>
  );
};

type PersonalityFormData = Omit<Personality, "id">;

const PersonalityModal: FC<{
  onSave: (data: PersonalityFormData) => void;
  onCancel: () => void;
  initial?: PersonalityFormData;
}> = ({ onSave, onCancel, initial }) => {
  const isEditing = !!initial;
  const [name, setName] = useState(initial?.name ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [embedding, setEmbedding] = useState(initial?.embedding ?? "");
  const [textTemperature, setTextTemperature] = useState(initial?.textTemperature ?? DEFAULT_TEXT_TEMPERATURE);
  const [textTopk, setTextTopk] = useState(initial?.textTopk ?? DEFAULT_TEXT_TOPK);
  const [audioTemperature, setAudioTemperature] = useState(initial?.audioTemperature ?? DEFAULT_AUDIO_TEMPERATURE);
  const [audioTopk, setAudioTopk] = useState(initial?.audioTopk ?? DEFAULT_AUDIO_TOPK);

  const handleSave = () => {
    if (!name.trim()) return;
    onSave({ name: name.trim(), description, embedding, textTemperature, textTopk, audioTemperature, audioTopk });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-lg shadow-lg p-6 w-96 max-h-[90vh] overflow-y-auto">
        <h3 className="text-base font-semibold text-gray-800 mb-4">{isEditing ? "Edit Personality" : "New Personality"}</h3>

        <label className="block text-xs font-medium text-gray-600 mb-1">Name</label>
        <input
          autoFocus
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") handleSave(); }}
          placeholder="Enter name..."
          className="w-full p-2 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-[#76b900] focus:border-transparent mb-3"
        />

        <label className="block text-xs font-medium text-gray-600 mb-1">Description</label>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Enter description..."
          rows={3}
          className="w-full p-2 border border-gray-300 rounded text-sm resize-y focus:outline-none focus:ring-2 focus:ring-[#76b900] focus:border-transparent mb-3"
        />

        <label className="block text-xs font-medium text-gray-600 mb-1">Embedding</label>
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
            className="px-3 py-1.5 text-sm bg-white border border-gray-300 rounded hover:bg-gray-50 text-gray-700"
          >
            Embedding
          </button>
          {embedding && <span className="ml-2 text-xs text-gray-500 truncate">{embedding}</span>}
        </div>

        <div className="flex items-center gap-2 mb-2">
          <label className="text-xs font-medium text-gray-600 w-24">Text Temp</label>
          <input
            type="range" min={0} max={2.0} step={0.01}
            value={textTemperature}
            onChange={(e) => setTextTemperature(Number(e.target.value))}
            className="flex-1"
          />
          <span className="text-xs text-gray-600 w-10 text-right">{textTemperature.toFixed(2)}</span>
        </div>

        <div className="flex items-center gap-2 mb-2">
          <label className="text-xs font-medium text-gray-600 w-24">Text TopK</label>
          <input
            type="range" min={5} max={500} step={1}
            value={textTopk}
            onChange={(e) => setTextTopk(Number(e.target.value))}
            className="flex-1"
          />
          <span className="text-xs text-gray-600 w-10 text-right">{textTopk}</span>
        </div>

        <div className="flex items-center gap-2 mb-2">
          <label className="text-xs font-medium text-gray-600 w-24">Audio Temp</label>
          <input
            type="range" min={0} max={2.0} step={0.01}
            value={audioTemperature}
            onChange={(e) => setAudioTemperature(Number(e.target.value))}
            className="flex-1"
          />
          <span className="text-xs text-gray-600 w-10 text-right">{audioTemperature.toFixed(2)}</span>
        </div>

        <div className="flex items-center gap-2 mb-4">
          <label className="text-xs font-medium text-gray-600 w-24">Audio TopK</label>
          <input
            type="range" min={5} max={1000} step={1}
            value={audioTopk}
            onChange={(e) => setAudioTopk(Number(e.target.value))}
            className="flex-1"
          />
          <span className="text-xs text-gray-600 w-10 text-right">{audioTopk}</span>
        </div>

        <div className="flex justify-end gap-2">
          <button
            onClick={onCancel}
            className="px-3 py-1.5 text-sm text-gray-600 hover:text-gray-800 rounded border border-gray-300 hover:bg-gray-50"
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

interface SetupPanelProps {
  isConnected: boolean;
  showMicrophoneAccessMessage: boolean;
  onConnect: () => Promise<void>;
  onDisconnect: () => void;
}

const SetupPanel: FC<SetupPanelProps> = ({
  isConnected, showMicrophoneAccessMessage,
  onConnect, onDisconnect,
}) => {
  return (
    <div className="flex-shrink-0 border-b border-gray-200 bg-white p-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-black">PersonaPlex</h1>
          <p className="text-xs text-gray-500">Full duplex conversational AI</p>
        </div>
        <div className="flex items-center gap-3">
          {showMicrophoneAccessMessage && (
            <span className="text-xs text-red-500">Enable microphone</span>
          )}
          <Button onClick={isConnected ? onDisconnect : async () => await onConnect()}>
            {isConnected ? "Disconnect" : "Connect"}
          </Button>
        </div>
      </div>
    </div>
  );
}

export const Queue:FC = () => {
  const theme = "light" as const;  // Always use light theme
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

  const audioContext = useRef<AudioContext | null>(null);
  const worklet = useRef<AudioWorkletNode | null>(null);
  
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
          if (personality.description) {
            modelParams.setTextPrompt(personality.description);
          }
          if (personality.embedding) {
            modelParams.setVoicePrompt(personality.embedding);
          }
          modelParams.setTextTemperature(personality.textTemperature);
          modelParams.setTextTopk(personality.textTopk);
          modelParams.setAudioTemperature(personality.audioTemperature);
          modelParams.setAudioTopk(personality.audioTopk);
        }
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
    <div className="flex h-screen w-screen">
      <div className="w-64 flex-shrink-0">
        <PersonalitiesPane
          personalities={personalities}
          selectedId={selectedPersonalityId}
          onSelect={setSelectedPersonalityId}
          onAdd={() => { setEditingPersonalityId(null); setShowModal(true); }}
          onEdit={handleEditPersonality}
          onDelete={handleDeletePersonality}
        />
      </div>
      <div className="flex-1 flex flex-col overflow-hidden">
        <SetupPanel
          isConnected={isConnected}
          showMicrophoneAccessMessage={showMicrophoneAccessMessage}
          onConnect={startConnection}
          onDisconnect={handleDisconnect}
        />
        <div className="flex-1 overflow-auto">
          <Conversation
            workerAddr={overrideWorkerAddr ?? ""}
            audioContext={audioContext}
            worklet={worklet}
            theme={theme}
            startConnection={startConnection}
            isActive={isConnected}
            onConversationEnd={handleDisconnect}
            {...modelParams}
          />
        </div>
      </div>
      {showModal && (
        <PersonalityModal
          onSave={handleSavePersonality}
          onCancel={closeModal}
          initial={editingPersonalityId ? (() => { const p = personalities.find((p) => p.id === editingPersonalityId); return p ? { name: p.name, description: p.description, embedding: p.embedding, textTemperature: p.textTemperature, textTopk: p.textTopk, audioTemperature: p.audioTemperature, audioTopk: p.audioTopk } : undefined; })() : undefined}
        />
      )}
    </div>
  );
};

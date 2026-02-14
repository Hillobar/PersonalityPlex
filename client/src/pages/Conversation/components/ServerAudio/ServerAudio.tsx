import { FC, useRef } from "react";
import { useServerAudio } from "../../hooks/useServerAudio";
import { ServerVisualizer } from "../AudioVisualizer/ServerVisualizer";
import { type ThemeType } from "../../hooks/useSystemTheme";

type ServerAudioProps = {
  theme: ThemeType;
};
export const ServerAudio: FC<ServerAudioProps> = ({ theme }) => {
  const { analyser, hasCriticalDelay, setHasCriticalDelay } = useServerAudio();
  const containerRef = useRef<HTMLDivElement>(null);
  return (
    <>
      {hasCriticalDelay && (
        <div className="fixed left-0 top-0 flex w-screen justify-between bg-red-500 p-2 text-center">
          <p>A connection issue has been detected, you've been reconnected</p>
          <button
            onClick={async () => {
              setHasCriticalDelay(false);
            }}
            className="bg-gray-800 p-1 text-gray-100 rounded"
          >
            Dismiss
          </button>
        </div>
      )}
      <div className="server-audio w-full" ref={containerRef}>
        <ServerVisualizer analyser={analyser.current} parent={containerRef} theme={theme}/>
      </div>
    </>
  );
};

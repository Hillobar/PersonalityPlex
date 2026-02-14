import { FC, RefObject, useCallback, useEffect, useRef, useState } from "react";
import { clamp } from "../../hooks/audioUtils";
import { type ThemeType } from "../../hooks/useSystemTheme";

type AudioVisualizerProps = {
  analyser: AnalyserNode | null;
  parent: RefObject<HTMLElement>;
  theme: ThemeType;
};

const MAX_INTENSITY = 255;
const BAR_HEIGHT = 24;

export const ClientVisualizer: FC<AudioVisualizerProps> = ({ analyser, parent, theme }) => {
  const [canvasWidth, setCanvasWidth] = useState(parent.current ? parent.current.clientWidth : 0);
  const requestRef = useRef<number | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const draw = useCallback((width: number, audioData: Uint8Array, ctx: CanvasRenderingContext2D) => {
    const averageIntensity = Math.sqrt(
      audioData.reduce((acc, curr) => acc + curr * curr, 0) / audioData.length,
    );
    const intensity = clamp(
      averageIntensity * 1.4,
      averageIntensity,
      MAX_INTENSITY,
    );
    const relIntensity = intensity / MAX_INTENSITY;
    const barWidth = relIntensity * width;

    const h = BAR_HEIGHT;
    const r = h / 2;

    // Clear and fill background
    ctx.clearRect(0, 0, width, h);
    ctx.fillStyle = theme === "dark" ? "#000000" : "#e5e7eb";
    ctx.beginPath();
    ctx.roundRect(0, 0, width, h, r);
    ctx.fill();

    // Draw the active bar
    if (barWidth > 0) {
      ctx.beginPath();
      ctx.fillStyle = "#4E8800";
      ctx.roundRect(0, 0, barWidth, h, r);
      ctx.fill();

      // Draw a brighter leading section
      const highlightWidth = Math.min(barWidth, width * 0.05);
      ctx.beginPath();
      ctx.fillStyle = "#76B900";
      ctx.roundRect(0, 0, highlightWidth, h, r);
      ctx.fill();
    }

    // Draw border
    ctx.beginPath();
    ctx.roundRect(0, 0, width, h, r);
    ctx.strokeStyle = theme === "dark" ? "white" : "#9ca3af";
    ctx.lineWidth = 1;
    ctx.stroke();
  }, [theme]);

  const visualizeData = useCallback(() => {
    const width = parent.current ? parent.current.clientWidth : 0;
    if (width !== canvasWidth) {
      setCanvasWidth(width);
    }
    requestRef.current = window.requestAnimationFrame(() => visualizeData());
    if (!canvasRef.current) {
      return;
    }
    const ctx = canvasRef.current.getContext("2d");
    const audioData = new Uint8Array(140);
    analyser?.getByteFrequencyData(audioData);
    if (!ctx) {
      return;
    }
    draw(width, audioData, ctx);
  }, [analyser, canvasWidth, parent, draw]);

  useEffect(() => {
    visualizeData();
    return () => {
      if (requestRef.current) {
        cancelAnimationFrame(requestRef.current);
      }
    };
  }, [visualizeData, analyser]);

  return (
    <canvas
      className="w-full"
      ref={canvasRef}
      width={canvasWidth}
      height={BAR_HEIGHT}
    />
  );
};

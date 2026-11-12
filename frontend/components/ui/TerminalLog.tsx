"use client";
import React, { useEffect, useRef } from "react";

interface TerminalLogProps {
  lines: string[];
  maxLines?: number;
}

export default function TerminalLog({ lines, maxLines = 100 }: TerminalLogProps) {
  const ref = useRef<HTMLDivElement>(null);
  const visible = lines.slice(-maxLines);

  useEffect(() => {
    if (ref.current) {
      ref.current.scrollTop = ref.current.scrollHeight;
    }
  }, [lines]);

  return (
    <div
      ref={ref}
      className="bg-[#080B12] border border-[#1E2A40] rounded-xl p-4 h-48 overflow-y-auto font-mono text-xs text-[#8892A4] scrollbar-thin"
      role="log"
      aria-label="Segmentation log output"
    >
      {visible.length === 0 && (
        <span className="text-[#4A5568]">Awaiting output...</span>
      )}
      {visible.map((line, i) => (
        <div key={i} className="leading-5">
          <span className="text-[#4A5568] select-none mr-2">›</span>
          {line}
        </div>
      ))}
      <span className="cursor-blink text-[#00D4FF]">▌</span>
    </div>
  );
}

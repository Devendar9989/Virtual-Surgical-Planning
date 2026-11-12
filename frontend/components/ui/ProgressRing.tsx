"use client";
import React from "react";

interface ProgressRingProps {
  progress: number; // 0-100
  size?: number;
  strokeWidth?: number;
  label?: string;
  sublabel?: string;
}

export default function ProgressRing({
  progress,
  size = 120,
  strokeWidth = 8,
  label,
  sublabel,
}: ProgressRingProps) {
  const r = (size - strokeWidth * 2) / 2;
  const circ = 2 * Math.PI * r;
  const offset = circ - (Math.min(100, Math.max(0, progress)) / 100) * circ;

  return (
    <div className="relative inline-flex items-center justify-center">
      <svg width={size} height={size} className="-rotate-90">
        {/* Outer glow track */}
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#0C1220" strokeWidth={strokeWidth + 4} />
        {/* Base track */}
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#1A2540" strokeWidth={strokeWidth} />
        {/* Glow (blurred duplicate) */}
        {progress > 0 && (
          <circle
            cx={size / 2} cy={size / 2} r={r}
            fill="none"
            stroke="#00D4FF"
            strokeWidth={strokeWidth + 4}
            strokeLinecap="round"
            strokeDasharray={circ}
            strokeDashoffset={offset}
            style={{ transition: "stroke-dashoffset 0.7s ease", filter: "blur(4px)", opacity: 0.4 }}
          />
        )}
        {/* Main progress arc */}
        <circle
          cx={size / 2} cy={size / 2} r={r}
          fill="none"
          stroke="url(#progress-grad)"
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circ}
          strokeDashoffset={offset}
          style={{ transition: "stroke-dashoffset 0.7s cubic-bezier(0.4,0,0.2,1)" }}
        />
        <defs>
          <linearGradient id="progress-grad" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#00D4FF" />
            <stop offset="100%" stopColor="#7B61FF" />
          </linearGradient>
        </defs>
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="font-black text-[#EEF2FF]" style={{ fontSize: size * 0.18 }}>{progress}%</span>
        {label && <span className="text-[#7C8BA1] text-center px-3 mt-0.5" style={{ fontSize: size * 0.09 }}>{label}</span>}
        {sublabel && <span className="text-[#3D4F68]" style={{ fontSize: size * 0.074 }}>{sublabel}</span>}
      </div>
    </div>
  );
}

"use client";
import React from "react";
import { motion } from "framer-motion";

export interface Structure {
  key: string;
  display: string;
  color: string;
}

interface StructureToggleProps {
  structure: Structure;
  enabled: boolean;
  opacity: number;
  onToggle: (key: string) => void;
  onOpacityChange?: (key: string, val: number) => void;
}

export default function StructureToggle({ structure, enabled, opacity, onToggle, onOpacityChange }: StructureToggleProps) {
  return (
    <div className={`flex items-center gap-3 p-2 rounded-lg transition-all duration-200 ${enabled ? "bg-white/5" : "opacity-50"}`}>
      <button
        onClick={() => onToggle(structure.key)}
        className="flex items-center gap-2 flex-1 text-left"
        aria-label={`Toggle ${structure.display}`}
        aria-pressed={enabled}
        id={`toggle-${structure.key}`}
      >
        <motion.div
          className="w-4 h-4 rounded-full border-2 flex-shrink-0"
          style={{
            borderColor: structure.color,
            backgroundColor: enabled ? structure.color : "transparent",
          }}
          animate={{ scale: enabled ? 1 : 0.85 }}
          transition={{ duration: 0.15 }}
        />
        <span className="text-sm text-[#F0F4FF]">{structure.display}</span>
      </button>
    </div>
  );
}

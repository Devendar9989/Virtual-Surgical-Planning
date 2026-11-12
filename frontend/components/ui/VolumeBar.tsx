"use client";
import React from "react";
import { motion } from "framer-motion";

interface VolumeBarProps {
  label: string;
  volume: number;
  percent: number;
  color: string;
}

export default function VolumeBar({ label, volume, percent, color }: VolumeBarProps) {
  return (
    <div className="space-y-1.5">
      <div className="flex justify-between items-center text-sm">
        <div className="flex items-center gap-2">
          <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: color }} />
          <span className="text-[#F0F4FF]">{label}</span>
        </div>
        <div className="flex items-center gap-3 text-right">
          <span className="text-[#8892A4]">{volume.toFixed(1)} cm³</span>
          <span className="text-[#4A5568] w-8 text-right">{percent.toFixed(0)}%</span>
        </div>
      </div>
      <div className="h-1.5 bg-[#1E2A40] rounded-full overflow-hidden">
        <motion.div
          className="h-full rounded-full"
          style={{ backgroundColor: color }}
          initial={{ width: 0 }}
          animate={{ width: `${percent}%` }}
          transition={{ duration: 0.8, ease: "easeOut", delay: 0.1 }}
        />
      </div>
    </div>
  );
}

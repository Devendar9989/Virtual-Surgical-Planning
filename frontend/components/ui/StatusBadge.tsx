"use client";
import React from "react";

type Status = "queued" | "processing" | "completed" | "failed" | "deleted";

interface StatusBadgeProps {
  status: Status;
}

const CONFIG: Record<Status, { label: string; color: string; dot: string }> = {
  queued: { label: "Queued", color: "text-[#FFB800] border-[#FFB800]/30 bg-[#FFB800]/10", dot: "bg-[#FFB800]" },
  processing: { label: "Processing", color: "text-[#00D4FF] border-[#00D4FF]/30 bg-[#00D4FF]/10", dot: "bg-[#00D4FF] animate-pulse" },
  completed: { label: "Completed", color: "text-[#00FF94] border-[#00FF94]/30 bg-[#00FF94]/10", dot: "bg-[#00FF94]" },
  failed: { label: "Failed", color: "text-[#FF4D6A] border-[#FF4D6A]/30 bg-[#FF4D6A]/10", dot: "bg-[#FF4D6A]" },
  deleted: { label: "Deleted", color: "text-[#8892A4] border-[#8892A4]/30 bg-[#8892A4]/10", dot: "bg-[#8892A4]" },
};

export default function StatusBadge({ status }: StatusBadgeProps) {
  const cfg = CONFIG[status] ?? CONFIG.queued;
  return (
    <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full border text-xs font-medium ${cfg.color}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
      {cfg.label}
    </span>
  );
}

"use client";
import React from "react";
import { motion, AnimatePresence } from "framer-motion";

export interface Step {
  id: string;
  label: string;
  status: "pending" | "active" | "done" | "error";
}

interface StepTimelineProps {
  steps: Step[];
}

export default function StepTimeline({ steps }: StepTimelineProps) {
  return (
    <div className="flex flex-col gap-0">
      {steps.map((step, i) => (
        <div key={step.id} className="flex items-start gap-3">
          {/* Connector line + icon */}
          <div className="flex flex-col items-center">
            <div className={`w-7 h-7 rounded-full flex items-center justify-center border-2 flex-shrink-0 transition-all duration-500 ${
              step.status === "done" ? "border-[#00FF94] bg-[#00FF94]/15" :
              step.status === "active" ? "border-[#00D4FF] bg-[#00D4FF]/15" :
              step.status === "error" ? "border-[#FF4D6A] bg-[#FF4D6A]/15" :
              "border-[#1E2A40] bg-transparent"
            }`}>
              {step.status === "done" && (
                <motion.svg initial={{ scale: 0 }} animate={{ scale: 1 }} width="12" height="12" viewBox="0 0 12 12">
                  <motion.path
                    d="M2 6l3 3 5-5"
                    stroke="#00FF94" strokeWidth="2" fill="none" strokeLinecap="round"
                    initial={{ pathLength: 0 }} animate={{ pathLength: 1 }}
                    transition={{ duration: 0.3 }}
                  />
                </motion.svg>
              )}
              {step.status === "active" && (
                <div className="w-2.5 h-2.5 rounded-full bg-[#00D4FF] animate-pulse" />
              )}
              {step.status === "error" && (
                <span className="text-[#FF4D6A] font-bold text-xs">✕</span>
              )}
              {step.status === "pending" && (
                <div className="w-2.5 h-2.5 rounded-full bg-[#1E2A40]" />
              )}
            </div>
            {i < steps.length - 1 && (
              <div className={`w-0.5 h-8 mt-1 transition-all duration-500 ${
                step.status === "done" ? "bg-[#00FF94]/40" : "bg-[#1E2A40]"
              }`} />
            )}
          </div>
          {/* Label */}
          <div className="pt-1 pb-8">
            <span className={`text-sm font-medium transition-colors duration-300 ${
              step.status === "done" ? "text-[#00FF94]" :
              step.status === "active" ? "text-[#00D4FF]" :
              step.status === "error" ? "text-[#FF4D6A]" :
              "text-[#4A5568]"
            }`}>
              {step.label}
            </span>
          </div>
        </div>
      ))}
    </div>
  );
}

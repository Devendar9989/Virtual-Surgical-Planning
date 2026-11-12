"use client";
import React from "react";
import { motion } from "framer-motion";

interface GlassCardProps {
  children: React.ReactNode;
  className?: string;
  hover?: boolean;
  onClick?: () => void;
  id?: string;
  glow?: "cyan" | "violet" | "green" | "none";
}

export default function GlassCard({ children, className = "", hover = false, onClick, id, glow = "cyan" }: GlassCardProps) {
  const base = "card p-6 relative overflow-hidden";

  if (hover) {
    return (
      <motion.div
        className={`${base} card-hover cursor-pointer ${className}`}
        whileHover={{ y: -2 }}
        transition={{ duration: 0.18 }}
        onClick={onClick}
        id={id}
      >
        <div className="absolute inset-x-0 top-0 h-px"
          style={{ background: "linear-gradient(90deg, transparent, rgba(56,189,248,0.25), transparent)" }} />
        {children}
      </motion.div>
    );
  }

  return (
    <div className={`${base} ${className}`} id={id}>
      <div className="absolute inset-x-0 top-0 h-px"
        style={{ background: "linear-gradient(90deg, transparent, rgba(56,189,248,0.15), transparent)" }} />
      {children}
    </div>
  );
}

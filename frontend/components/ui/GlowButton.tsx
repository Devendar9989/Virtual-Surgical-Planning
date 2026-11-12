"use client";
import React from "react";
import { motion } from "framer-motion";
import Link from "next/link";

interface GlowButtonProps {
  children: React.ReactNode;
  href?: string;
  onClick?: () => void;
  variant?: "primary" | "ghost" | "danger";
  size?: "sm" | "md" | "lg";
  disabled?: boolean;
  className?: string;
  type?: "button" | "submit";
  id?: string;
}

const SIZES = {
  sm: "px-4 py-1.5 text-sm",
  md: "px-5 py-2.5 text-sm",
  lg: "px-7 py-3 text-base",
};

export default function GlowButton({
  children, href, onClick,
  variant = "primary", size = "md",
  disabled = false, className = "",
  type = "button", id,
}: GlowButtonProps) {

  const styles = {
    primary: {
      base: "font-semibold text-slate-950",
      style: { background: "#38BDF8" },
      hover: { scale: 1.03, boxShadow: "0 0 24px rgba(56,189,248,0.55)" },
    },
    ghost: {
      base: "font-medium text-slate-300 border border-slate-700",
      style: { background: "transparent" },
      hover: { scale: 1.02, borderColor: "rgba(56,189,248,0.4)", color: "#E2E8F0" },
    },
    danger: {
      base: "font-medium text-red-400 border border-red-500/40",
      style: { background: "transparent" },
      hover: { scale: 1.02, boxShadow: "0 0 16px rgba(239,68,68,0.35)" },
    },
  };

  const v = styles[variant];
  const cls = `inline-flex items-center justify-center gap-2 rounded-xl cursor-pointer select-none transition-colors duration-150 disabled:opacity-40 disabled:cursor-not-allowed ${SIZES[size]} ${v.base} ${className}`;

  const motionProps = {
    whileHover: disabled ? {} : v.hover,
    whileTap: disabled ? {} : { scale: 0.97 },
    transition: { duration: 0.13 },
  };

  if (href && !disabled) {
    return (
      <motion.div {...motionProps}>
        <Link href={href} className={cls} style={v.style} id={id}>
          {children}
        </Link>
      </motion.div>
    );
  }

  return (
    <motion.button
      {...motionProps}
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={cls}
      style={v.style}
      id={id}
    >
      {children}
    </motion.button>
  );
}

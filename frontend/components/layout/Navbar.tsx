"use client";
import React, { useEffect, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";

export default function Navbar() {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const fn = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", fn, { passive: true });
    return () => window.removeEventListener("scroll", fn);
  }, []);

  return (
    <motion.nav
      initial={{ y: -16, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.4 }}
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
        scrolled
          ? "bg-slate-950/90 backdrop-blur-xl border-b border-sky-500/10 shadow-lg shadow-black/20"
          : "bg-transparent"
      }`}
    >
      <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">

        {/* Logo */}
        <Link href="/" className="flex items-center gap-2.5 group">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center font-black text-sm transition-all duration-200 group-hover:shadow-[0_0_16px_rgba(56,189,248,0.45)]"
            style={{ background: "linear-gradient(135deg, #38BDF8, #818CF8)", color: "#09111F" }}>
            O
          </div>
          <span className="font-bold text-base tracking-tight">
            <span className="text-slate-100">Osseus</span>
            <span className="text-gradient">AI</span>
          </span>
        </Link>

        {/* Nav links */}
        <div className="hidden md:flex items-center gap-1">
          {[
            { href: "/upload", label: "Upload" },
            { href: "/demo", label: "Demo" },
          ].map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className="px-4 py-2 rounded-lg text-sm text-slate-400 hover:text-slate-100 hover:bg-white/5 transition-all duration-150"
            >
              {l.label}
            </Link>
          ))}
        </div>

        {/* CTA */}
        <motion.div whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }} transition={{ duration: 0.13 }}>
          <Link
            href="/upload"
            id="nav-cta"
            className="flex items-center px-5 py-2 rounded-xl text-sm font-semibold transition-all duration-150 hover:shadow-[0_0_20px_rgba(56,189,248,0.4)]"
            style={{ background: "#38BDF8", color: "#09111F" }}
          >
            Start →
          </Link>
        </motion.div>
      </div>
    </motion.nav>
  );
}

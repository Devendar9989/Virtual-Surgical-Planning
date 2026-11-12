"use client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import React, { useState, useEffect } from "react";

export default function QueryProvider({ children }: { children: React.ReactNode }) {
  // Swallow upstream r3f warning about Clock deprecation
  useEffect(() => {
    const orig = console.warn;
    console.warn = (...args) => {
      if (typeof args[0] === "string" && args[0].includes("THREE.Clock")) return;
      orig(...args);
    };
    return () => { console.warn = orig; };
  }, []);

  const [qc] = useState(() => new QueryClient({
    defaultOptions: {
      queries: { retry: 2, staleTime: 5000 },
    },
  }));
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
}

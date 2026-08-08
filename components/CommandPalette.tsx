"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

interface Result {
  kind: string;
  id: string;
  title: string;
  meta: string;
  href: string;
}

const KIND_ICON: Record<string, string> = {
  incident: "🚨",
  service: "🏠",
  runbook: "📘",
  postmortem: "📖",
  action: "⚡",
};

const ACTIONS: Result[] = [
  { kind: "action", id: "declare", title: "Declare an incident", meta: "action", href: "/incidents/declare" },
  { kind: "action", id: "alerts", title: "Go to Alerts", meta: "action", href: "/alerts" },
  { kind: "action", id: "oncall", title: "Who is on call?", meta: "action", href: "/oncall" },
  { kind: "action", id: "status", title: "Open status page", meta: "action", href: "/status" },
];

export default function CommandPalette() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Result[]>([]);
  const [selected, setSelected] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((o) => !o);
      }
      if (e.key === "Escape") setOpen(false);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    if (open) {
      setQuery("");
      setResults([]);
      setSelected(0);
      setTimeout(() => inputRef.current?.focus(), 30);
    }
  }, [open]);

  useEffect(() => {
    if (debounce.current) clearTimeout(debounce.current);
    if (query.trim().length < 2) {
      setResults([]);
      setSelected(0);
      return;
    }
    debounce.current = setTimeout(async () => {
      const res = await fetch(`/api/search?q=${encodeURIComponent(query.trim())}`);
      const data = await res.json();
      setResults(data.results ?? []);
      setSelected(0);
    }, 150);
  }, [query]);

  const shown = query.trim().length < 2
    ? ACTIONS
    : [...results, ...ACTIONS.filter((a) => a.title.toLowerCase().includes(query.toLowerCase()))];

  const go = useCallback(
    (r: Result) => {
      setOpen(false);
      router.push(r.href);
    },
    [router],
  );

  function onInputKey(e: React.KeyboardEvent) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelected((s) => Math.min(s + 1, shown.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelected((s) => Math.max(s - 1, 0));
    } else if (e.key === "Enter" && shown[selected]) {
      go(shown[selected]);
    }
  }

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center pt-[15vh] bg-black/50 backdrop-blur-sm"
      onClick={() => setOpen(false)}
    >
      <div
        className="w-full max-w-xl card shadow-2xl shadow-black/50 overflow-hidden animate-in"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-3 px-4 py-3 border-b border-line">
          <svg viewBox="0 0 24 24" className="w-4 h-4 text-dim" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M21 21l-4.35-4.35M17 11a6 6 0 11-12 0 6 6 0 0112 0z" strokeLinecap="round" />
          </svg>
          <input
            ref={inputRef}
            className="flex-1 bg-transparent outline-none text-sm placeholder:text-dim"
            placeholder="Search incidents, services, runbooks… or jump to an action"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={onInputKey}
          />
          <kbd className="text-[10px] font-mono text-dim border border-line rounded px-1.5 py-0.5">esc</kbd>
        </div>
        <div className="max-h-80 overflow-y-auto py-1">
          {shown.length === 0 ? (
            <p className="px-4 py-6 text-center text-sm text-dim">No matches for &quot;{query}&quot;</p>
          ) : (
            shown.map((r, i) => (
              <button
                key={`${r.kind}-${r.id}`}
                className={`w-full flex items-center gap-3 px-4 py-2.5 text-left text-sm transition-colors ${
                  i === selected ? "bg-accent/15" : "hover:bg-elevated"
                }`}
                onMouseEnter={() => setSelected(i)}
                onClick={() => go(r)}
              >
                <span>{KIND_ICON[r.kind] ?? "•"}</span>
                <span className="flex-1 truncate">{r.title}</span>
                <span className="text-xs text-dim shrink-0">{r.meta}</span>
              </button>
            ))
          )}
        </div>
        <div className="px-4 py-2 border-t border-line text-[10px] text-dim flex gap-3">
          <span><kbd className="font-mono">↑↓</kbd> navigate</span>
          <span><kbd className="font-mono">↵</kbd> open</span>
          <span><kbd className="font-mono">ctrl+k</kbd> toggle</span>
        </div>
      </div>
    </div>
  );
}

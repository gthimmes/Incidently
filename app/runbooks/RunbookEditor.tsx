"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

interface Props {
  runbook: { id: string | null; title: string; content: string; serviceId: string };
  services: { id: string; name: string }[];
}

export default function RunbookEditor({ runbook, services }: Props) {
  const router = useRouter();
  const [data, setData] = useState(runbook);
  const [busy, setBusy] = useState(false);
  const [savedAt, setSavedAt] = useState<Date | null>(null);
  const [preview, setPreview] = useState(Boolean(runbook.id));

  async function save() {
    if (!data.title.trim()) return;
    setBusy(true);
    const res = await fetch(data.id ? `/api/runbooks/${data.id}` : "/api/runbooks", {
      method: data.id ? "PUT" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: data.title, content: data.content, serviceId: data.serviceId || null }),
    });
    const saved = await res.json();
    if (!data.id) {
      router.replace(`/runbooks/${saved.id}`);
    }
    setData({ ...data, id: saved.id });
    setSavedAt(new Date());
    router.refresh();
    setBusy(false);
  }

  // minimal markdown-ish rendering: headings, bold, code, lists
  function renderLine(line: string, i: number) {
    if (line.startsWith("### ")) return <h4 key={i} className="font-semibold mt-4 mb-1">{line.slice(4)}</h4>;
    if (line.startsWith("## ")) return <h3 key={i} className="font-semibold text-lg mt-5 mb-1.5">{line.slice(3)}</h3>;
    if (line.startsWith("# ")) return <h2 key={i} className="font-bold text-xl mt-5 mb-2">{line.slice(2)}</h2>;
    const numbered = line.match(/^(\d+)\.\s(.*)$/);
    if (numbered)
      return (
        <p key={i} className="ml-1 my-1 flex gap-2">
          <span className="text-dim font-medium shrink-0">{numbered[1]}.</span>
          <span>{inline(numbered[2])}</span>
        </p>
      );
    if (line.startsWith("- ")) return <li key={i} className="ml-5 list-disc my-1">{inline(line.slice(2))}</li>;
    if (line.trim() === "") return <div key={i} className="h-2" />;
    return <p key={i} className="my-1 leading-relaxed">{inline(line)}</p>;
  }
  function inline(text: string) {
    const parts = text.split(/(`[^`]+`|\*\*[^*]+\*\*)/g);
    return parts.map((p, j) => {
      if (p.startsWith("`") && p.endsWith("`"))
        return <code key={j} className="font-mono text-[13px] bg-elevated border border-line rounded px-1">{p.slice(1, -1)}</code>;
      if (p.startsWith("**") && p.endsWith("**")) return <strong key={j}>{p.slice(2, -2)}</strong>;
      return p;
    });
  }

  return (
    <div className="space-y-4 animate-in max-w-4xl">
      <div className="flex items-center gap-2 text-sm text-dim">
        <Link href="/runbooks" className="hover:text-accent">Runbooks</Link>
        <span>/</span>
        <span>{data.id ? data.title || "Untitled" : "New"}</span>
      </div>

      <div className="card p-4 flex items-center gap-3 flex-wrap">
        <input
          className="input !w-80"
          placeholder="Runbook title, e.g. Database connection pool exhaustion"
          value={data.title}
          onChange={(e) => setData({ ...data, title: e.target.value })}
        />
        <select className="input !w-56" value={data.serviceId} onChange={(e) => setData({ ...data, serviceId: e.target.value })}>
          <option value="">General (no service)</option>
          {services.map((s) => (
            <option key={s.id} value={s.id}>{s.name}</option>
          ))}
        </select>
        <div className="flex-1" />
        {savedAt && <span className="text-xs text-dim">Saved {savedAt.toLocaleTimeString()}</span>}
        <button className="btn btn-ghost" onClick={() => setPreview(!preview)}>
          {preview ? "Edit" : "Preview"}
        </button>
        <button className="btn btn-primary" onClick={save} disabled={busy || !data.title.trim()}>
          {busy ? "Saving…" : "Save"}
        </button>
      </div>

      {preview ? (
        <div className="card p-6 text-[15px]">
          {data.content ? data.content.split("\n").map(renderLine) : <p className="text-dim">Nothing here yet.</p>}
        </div>
      ) : (
        <textarea
          className="input min-h-[420px] font-mono text-[13px] leading-relaxed"
          placeholder={"# What this covers\n\n## Symptoms\n- Error rate spike on ...\n\n## Steps\n1. Check dashboard `...`\n2. Roll back with **deploy tool**\n3. Verify recovery"}
          value={data.content}
          onChange={(e) => setData({ ...data, content: e.target.value })}
        />
      )}
    </div>
  );
}

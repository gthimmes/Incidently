"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV = [
  { href: "/", label: "Dashboard", icon: "M3 12l9-9 9 9M5 10v10h5v-6h4v6h5V10" },
  { href: "/incidents", label: "Incidents", icon: "M12 9v4m0 4h.01M10.3 3.9L1.8 18a2 2 0 001.7 3h17a2 2 0 001.7-3L13.7 3.9a2 2 0 00-3.4 0z" },
  { href: "/oncall", label: "On-Call", icon: "M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" },
  { href: "/notifications", label: "Notifications", icon: "M15 17h5l-1.4-1.4A2 2 0 0118 14.2V11a6 6 0 00-4-5.7V5a2 2 0 10-4 0v.3A6 6 0 006 11v3.2a2 2 0 01-.6 1.4L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" },
  { href: "/postmortems", label: "Postmortems", icon: "M9 12h6m-6 4h6M9 8h6M5 4h14a1 1 0 011 1v14a1 1 0 01-1 1H5a1 1 0 01-1-1V5a1 1 0 011-1z" },
  { href: "/remediations", label: "Remediations", icon: "M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" },
  { href: "/services", label: "Services", icon: "M5 12H3l9-9 9 9h-2M5 12v7a2 2 0 002 2h10a2 2 0 002-2v-7M9 21V12h6v9" },
  { href: "/analytics", label: "Analytics", icon: "M9 19v-6m4 6V9m4 10V5M5 19h16" },
  { href: "/status", label: "Status Page", icon: "M13 10V3L4 14h7v7l9-11h-7z" },
  { href: "/settings", label: "Settings", icon: "M10.3 4.3a1.7 1.7 0 013.4 0 1.7 1.7 0 002.6 1.1 1.7 1.7 0 012.4 2.4 1.7 1.7 0 001 2.5 1.7 1.7 0 010 3.4 1.7 1.7 0 00-1 2.6 1.7 1.7 0 01-2.4 2.4 1.7 1.7 0 00-2.6 1 1.7 1.7 0 01-3.4 0 1.7 1.7 0 00-2.5-1 1.7 1.7 0 01-2.4-2.4 1.7 1.7 0 00-1.1-2.6 1.7 1.7 0 010-3.4 1.7 1.7 0 001.1-2.5 1.7 1.7 0 012.4-2.4 1.7 1.7 0 002.5-1.1z M15 12a3 3 0 11-6 0 3 3 0 016 0z" },
];

export default function Sidebar() {
  const pathname = usePathname();
  return (
    <aside className="w-56 shrink-0 border-r border-line bg-panel/60 flex flex-col h-screen sticky top-0">
      <div className="px-5 py-5 flex items-center gap-2.5">
        <span className="w-8 h-8 rounded-lg bg-accent flex items-center justify-center shadow-lg shadow-indigo-500/30">
          <svg viewBox="0 0 24 24" className="w-5 h-5 text-white" fill="none" stroke="currentColor" strokeWidth="2.5">
            <path d="M13 10V3L4 14h7v7l9-11h-7z" strokeLinejoin="round" strokeLinecap="round" />
          </svg>
        </span>
        <span className="font-bold text-[17px] tracking-tight">Incidently</span>
      </div>

      <div className="px-3 pb-3">
        <Link href="/incidents/declare" className="btn btn-danger w-full justify-center pulse-live">
          <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M12 9v4m0 4h.01M10.3 3.9L1.8 18a2 2 0 001.7 3h17a2 2 0 001.7-3L13.7 3.9a2 2 0 00-3.4 0z" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          Declare Incident
        </Link>
      </div>

      <nav className="flex-1 px-3 space-y-0.5 overflow-y-auto">
        {NAV.map((item) => {
          const active = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${
                active ? "bg-accent/15 text-white font-medium" : "text-dim hover:text-ink hover:bg-elevated"
              }`}
            >
              <svg viewBox="0 0 24 24" className={`w-[18px] h-[18px] ${active ? "text-accent" : ""}`} fill="none" stroke="currentColor" strokeWidth="1.8">
                <path d={item.icon} strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="px-5 py-4 border-t border-line text-[11px] text-dim/70">
        Incidently · response in seconds
      </div>
    </aside>
  );
}

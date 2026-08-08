import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import Sidebar from "@/components/Sidebar";
import CommandPalette from "@/components/CommandPalette";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Incidently — Incident Management",
  description: "Declare, respond, learn. Incident management that moves at the speed of your team.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased app-bg`}>
        <div className="flex min-h-screen">
          <Sidebar />
          <main className="flex-1 min-w-0 px-8 py-6 max-w-[1400px]">{children}</main>
        </div>
        <CommandPalette />
      </body>
    </html>
  );
}

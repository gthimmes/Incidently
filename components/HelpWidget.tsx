"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import { HelpNavigator } from "help-navigator";
import { helpContent } from "@/lib/help/content";
import { helpArticlesFor } from "@/lib/help/context";

// Mounts the in-app help center (floating launcher, bottom-right; F1 to
// toggle) and keeps its "Suggested for this page" section in sync with the
// current route.
export default function HelpWidget() {
  const pathname = usePathname();
  const helpRef = useRef<HelpNavigator | null>(null);

  useEffect(() => {
    const help = HelpNavigator.init({
      content: helpContent,
      theme: "dark",
      accentColor: "#6366f1",
      position: "bottom-right",
      hotkey: "F1",
      texts: { panelTitle: "Incidently Help" },
    });
    helpRef.current = help;
    return () => {
      helpRef.current = null;
      help.destroy();
    };
  }, []);

  useEffect(() => {
    helpRef.current?.setContext(helpArticlesFor(pathname ?? "/"));
  }, [pathname]);

  return null;
}

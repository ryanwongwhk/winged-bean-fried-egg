import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef } from "react";
import shell from "@/game/shell.html?raw";

export const Route = createFileRoute("/")({ component: Home });

function Home() {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    let stop: (() => void) | undefined;
    let cancelled = false;
    import("@/game/kitchen").then((mod) => {
      if (cancelled || !ref.current) return;
      stop = mod.start(ref.current);
    });
    return () => {
      cancelled = true;
      stop?.();
    };
  }, []);
  return <div id="game-root" ref={ref} dangerouslySetInnerHTML={{ __html: shell }} />;
}
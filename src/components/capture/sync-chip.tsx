"use client";

// Persistent sync-state chip (spec 1.4 "UI truth"): green cloud = all synced,
// amber clock + count = N reports queued locally, pulsing while a sync pass
// runs. Lives in the wizard + My Reports headers.

import { useEffect, useState } from "react";
import { Cloud, CloudOff, Clock } from "lucide-react";
import { onOutboxChanged, outboxCount } from "@/lib/capture/db";

export function SyncChip() {
  const [count, setCount] = useState(0);
  const [online, setOnline] = useState(true);

  useEffect(() => {
    let mounted = true;
    const refresh = () => {
      void outboxCount().then((n) => {
        if (mounted) setCount(n);
      });
      setOnline(typeof navigator === "undefined" ? true : navigator.onLine);
    };
    refresh();
    const offOutbox = onOutboxChanged(refresh);
    window.addEventListener("online", refresh);
    window.addEventListener("offline", refresh);
    return () => {
      mounted = false;
      offOutbox();
      window.removeEventListener("online", refresh);
      window.removeEventListener("offline", refresh);
    };
  }, []);

  if (count > 0) {
    return (
      <span
        className="flex h-10 min-w-10 items-center justify-center gap-1 rounded-full bg-[#B7791F]/15 px-2.5 text-sm font-bold text-[#B7791F]"
        aria-label={`${count} queued`}
      >
        <Clock className={online ? "h-5 w-5 animate-pulse" : "h-5 w-5"} />
        {count}
      </span>
    );
  }
  return (
    <span
      className="flex h-10 w-10 items-center justify-center rounded-full bg-[#2E7D5B]/10 text-[#2E7D5B]"
      aria-label={online ? "synced" : "offline"}
    >
      {online ? <Cloud className="h-5 w-5" /> : <CloudOff className="h-5 w-5 text-[#5A6273]" />}
    </span>
  );
}

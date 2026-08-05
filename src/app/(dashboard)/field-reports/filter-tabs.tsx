"use client";

import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";

const TABS = [
  { key: "submitted", label: "To triage" },
  { key: "triaged", label: "Triaged" },
  { key: "converted", label: "Converted" },
  { key: "rejected", label: "Rejected" },
  { key: "all", label: "All" },
];

export function FilterTabs({ active }: { active: string }) {
  const router = useRouter();
  return (
    <div className="flex flex-wrap gap-2">
      {TABS.map((tab) => (
        <button
          key={tab.key}
          type="button"
          onClick={() => router.push(tab.key === "submitted" ? "/field-reports" : `/field-reports?status=${tab.key}`)}
          className={cn(
            "rounded-full border px-3.5 py-1.5 text-sm font-medium transition-colors",
            active === tab.key
              ? "border-primary bg-primary text-primary-foreground"
              : "bg-card text-muted-foreground hover:bg-accent",
          )}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}

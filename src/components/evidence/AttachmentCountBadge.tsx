import { Paperclip } from "lucide-react";
import { cn } from "@/lib/utils";

// AttachmentCountBadge — a tiny paperclip + count shown on a list-screen row so
// users can see at a glance which records carry evidence without opening them
// (spec §5.2). Presentational; the count is fetched server-side by the page and
// passed in. Renders nothing at count 0 (no clutter on rows with no evidence).

export function AttachmentCountBadge({ count, className }: { count: number; className?: string }) {
  if (!count) return null;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-0.5 rounded border border-slate-200 bg-slate-50 px-1 text-[10px] font-medium text-slate-500",
        className
      )}
      title={`${count} document${count === 1 ? "" : "s"} attached`}
    >
      <Paperclip size={10} />
      {count}
    </span>
  );
}

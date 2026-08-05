"use client";

// Guided Field Capture — shared primitives, Midnight Executive skin
// (DECISIONS.md D9: navy #0B1F4D / gold #C9A961 / ice #E8EEF7 scoped to this
// surface only). Constraints from spec 1.1: touch targets >= 64px, icon tiles
// >= 96x96, bilingual labels (chosen language large, English muted below),
// no long-press / drag / pinch.

import type { LucideIcon } from "lucide-react";
import { Volume2 } from "lucide-react";
import type { Lang } from "@/lib/capture/i18n";
import { speak } from "@/lib/capture/i18n";
import { cn } from "@/lib/utils";

export const MX = {
  navy: "#0B1F4D",
  gold: "#C9A961",
  ice: "#E8EEF7",
  red: "#C0392B",
  green: "#2E7D5B",
} as const;

export function BiText({
  primary,
  secondary,
  className,
  primaryClassName,
  secondaryClassName,
}: {
  primary: string;
  secondary?: string | null;
  className?: string;
  primaryClassName?: string;
  secondaryClassName?: string;
}) {
  return (
    <span className={cn("flex flex-col items-center text-center leading-tight", className)}>
      <span className={cn("text-base font-semibold", primaryClassName)}>{primary}</span>
      {secondary ? (
        <span className={cn("mt-0.5 text-xs text-[#5A6273]", secondaryClassName)}>{secondary}</span>
      ) : null}
    </span>
  );
}

/** Big square icon tile (>= 96x96 icon area, whole tile >= 64px tall). */
export function Tile({
  icon: Icon,
  primary,
  secondary,
  selected,
  onClick,
  tone = "ice",
  className,
  testId,
}: {
  icon: LucideIcon;
  primary: string;
  secondary?: string | null;
  selected?: boolean;
  onClick: () => void;
  tone?: "ice" | "danger" | "gold";
  className?: string;
  testId?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      data-testid={testId}
      className={cn(
        "flex min-h-[128px] w-full flex-col items-center justify-center gap-2 rounded-2xl border-2 p-3 transition-transform active:scale-[0.97]",
        selected
          ? "border-[#C9A961] bg-[#0B1F4D] text-white shadow-lg"
          : tone === "danger"
            ? "border-[#C0392B]/40 bg-[#C0392B]/5 text-[#0B1F4D]"
            : tone === "gold"
              ? "border-[#C9A961]/60 bg-[#C9A961]/10 text-[#0B1F4D]"
              : "border-[#D9E1EF] bg-white text-[#0B1F4D]",
        className,
      )}
    >
      <span
        className={cn(
          "flex h-14 w-14 items-center justify-center rounded-xl",
          selected ? "bg-white/10" : "bg-[#E8EEF7]",
        )}
      >
        <Icon className={cn("h-8 w-8", selected ? "text-[#C9A961]" : tone === "danger" ? "text-[#C0392B]" : "text-[#0B1F4D]")} strokeWidth={1.8} />
      </span>
      <BiText
        primary={primary}
        secondary={secondary}
        primaryClassName={cn("text-[15px]", selected && "text-white")}
        secondaryClassName={cn(selected && "text-white/60")}
      />
    </button>
  );
}

export function TileGrid({ children, cols = 2 }: { children: React.ReactNode; cols?: 2 | 3 }) {
  return <div className={cn("grid w-full gap-3", cols === 2 ? "grid-cols-2" : "grid-cols-3")}>{children}</div>;
}

/** Full-width action button, >= 64px tall (glove-tolerant). */
export function BigButton({
  primary,
  secondary,
  onClick,
  icon: Icon,
  variant = "primary",
  disabled,
  className,
  testId,
}: {
  primary: string;
  secondary?: string | null;
  onClick: () => void;
  icon?: LucideIcon;
  variant?: "primary" | "gold" | "ghost" | "danger";
  disabled?: boolean;
  className?: string;
  testId?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      data-testid={testId}
      className={cn(
        "flex min-h-[64px] w-full items-center justify-center gap-3 rounded-2xl px-5 py-3 text-lg font-semibold transition-transform active:scale-[0.98] disabled:opacity-50",
        variant === "primary" && "bg-[#0B1F4D] text-white",
        variant === "gold" && "bg-[#C9A961] text-[#0B1F4D] shadow-md",
        variant === "ghost" && "border-2 border-[#D9E1EF] bg-white text-[#0B1F4D]",
        variant === "danger" && "bg-[#C0392B] text-white",
        className,
      )}
    >
      {Icon ? <Icon className="h-6 w-6 shrink-0" /> : null}
      <span className="flex flex-col items-center leading-tight">
        <span>{primary}</span>
        {secondary ? <span className="text-xs font-normal opacity-70">{secondary}</span> : null}
      </span>
    </button>
  );
}

/** Wizard progress — large dots, no percentage text (spec 1.1.2). */
export function ProgressDots({ total, current }: { total: number; current: number }) {
  return (
    <div className="flex items-center justify-center gap-2.5" aria-label={`Step ${current + 1} of ${total}`}>
      {Array.from({ length: total }, (_, i) => (
        <span
          key={i}
          className={cn(
            "rounded-full transition-all",
            i === current ? "h-3.5 w-8 bg-[#C9A961]" : i < current ? "h-3 w-3 bg-[#0B1F4D]" : "h-3 w-3 bg-[#D9E1EF]",
          )}
        />
      ))}
    </div>
  );
}

/** Screen question — Georgia display heading, bilingual, with a speaker
 *  button that reads the question aloud in the chosen language. */
export function ScreenHeading({
  primary,
  secondary,
  lang,
}: {
  primary: string;
  secondary?: string | null;
  lang: Lang;
}) {
  return (
    <div className="flex items-start justify-between gap-3">
      <div className="min-w-0">
        <h1
          className="text-2xl font-semibold text-[#0B1F4D]"
          style={{ fontFamily: "Georgia, 'Times New Roman', serif" }}
        >
          {primary}
        </h1>
        {secondary ? <p className="mt-0.5 text-sm text-[#5A6273]">{secondary}</p> : null}
      </div>
      <button
        type="button"
        aria-label="Listen"
        onClick={() => speak(primary, lang)}
        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#E8EEF7] text-[#0B1F4D] active:scale-95"
      >
        <Volume2 className="h-5 w-5" />
      </button>
    </div>
  );
}

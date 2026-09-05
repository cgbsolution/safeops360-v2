"use client";

// WP-44 - photo annotation on captured evidence (docs/cams/09 §3.4).
//
// **The original is the evidence; the annotation is interpretation.** Both are
// returned, and the caller stores both. Flattening an arrow into the only copy
// of a photograph destroys the artefact a certification body would want to see
// unmarked — and it is irreversible, which is the part that matters.
//
// Deliberately three tools, not a drawing app: arrow, circle, freehand. An
// auditor standing at a blocked fire exit needs to point at the thing, not
// choose a brush.
//
// Offline-capable by construction: everything is canvas + a data URI, no
// upload, no network, no library. It works inside the WP-17 offline pack
// because it never needed to leave the device in the first place.

import { useEffect, useRef, useState } from "react";
import { ArrowUpRight, Circle, Loader2, Pencil, Undo2, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

type Tool = "arrow" | "circle" | "free";

type Shape =
  | { tool: "arrow"; x1: number; y1: number; x2: number; y2: number }
  | { tool: "circle"; x1: number; y1: number; x2: number; y2: number }
  | { tool: "free"; points: { x: number; y: number }[] };

const STROKE = "#DC2626"; // one colour: this marks a problem, nothing else
const LINE_WIDTH = 4;

export function PhotoAnnotator({
  src,
  onDiscard,
  onAttachWithoutMarkup,
  onSave,
}: {
  src: string;
  /** Close (X) — attach NOTHING. The capture is thrown away. */
  onDiscard: () => void;
  /**
   * Attach the photo as-is, no markup. Reached only when the image cannot be
   * rendered on the canvas (HEIC, truncated upload) — a capture that can't be
   * drawn on should still become evidence.
   */
  onAttachWithoutMarkup: () => void;
  /** Receives BOTH: the untouched original and the annotated render. */
  onSave: (result: { original: string; annotated: string }) => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const imgRef = useRef<HTMLImageElement | null>(null);
  const [tool, setTool] = useState<Tool>("arrow");
  const [shapes, setShapes] = useState<Shape[]>([]);
  const [draft, setDraft] = useState<Shape | null>(null);
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);
  const [busy, setBusy] = useState(false);

  // Load once, then every redraw paints the image + shapes from scratch. That
  // is what keeps the original pristine: we never draw onto the source.
  //
  // The canvas is mounted unconditionally (hidden until `ready`) and sized in
  // redraw, NOT here: gating the element on `ready` while `ready` is only set
  // after reading canvasRef is a deadlock — the ref is null on first load, so
  // the spinner spins forever.
  useEffect(() => {
    setReady(false);
    setFailed(false);
    const img = new Image();
    // Only for remote sources. A blob:/data: URL is same-origin already, and
    // the CORS attribute can make it fail outright in some browsers.
    if (!/^(blob:|data:)/.test(src)) img.crossOrigin = "anonymous";
    img.onload = () => {
      imgRef.current = img;
      setReady(true);
    };
    // Never hang silently: an unreadable capture (HEIC, truncated upload)
    // must offer a way out rather than trapping the auditor mid-checkpoint.
    img.onerror = () => setFailed(true);
    img.src = src;
  }, [src]);

  useEffect(() => {
    redraw();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shapes, draft, ready]);

  function redraw() {
    const c = canvasRef.current;
    const img = imgRef.current;
    if (!c || !img) return;
    const ctx = c.getContext("2d");
    if (!ctx) return;
    // Sizing here (not in onload) keeps it correct whichever mounts first.
    if (c.width !== img.naturalWidth || c.height !== img.naturalHeight) {
      c.width = img.naturalWidth;
      c.height = img.naturalHeight;
    }
    ctx.clearRect(0, 0, c.width, c.height);
    ctx.drawImage(img, 0, 0);
    ctx.strokeStyle = STROKE;
    ctx.fillStyle = STROKE;
    // Scale the stroke to the image so a 4000px photo does not get a hairline.
    ctx.lineWidth = Math.max(LINE_WIDTH, c.width / 400);
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    for (const s of [...shapes, ...(draft ? [draft] : [])]) paint(ctx, s);
  }

  function paint(ctx: CanvasRenderingContext2D, s: Shape) {
    if (s.tool === "free") {
      if (s.points.length < 2) return;
      ctx.beginPath();
      ctx.moveTo(s.points[0].x, s.points[0].y);
      for (const p of s.points.slice(1)) ctx.lineTo(p.x, p.y);
      ctx.stroke();
      return;
    }
    if (s.tool === "circle") {
      const rx = Math.abs(s.x2 - s.x1) / 2;
      const ry = Math.abs(s.y2 - s.y1) / 2;
      ctx.beginPath();
      ctx.ellipse(Math.min(s.x1, s.x2) + rx, Math.min(s.y1, s.y2) + ry, rx, ry, 0, 0, Math.PI * 2);
      ctx.stroke();
      return;
    }
    // arrow
    ctx.beginPath();
    ctx.moveTo(s.x1, s.y1);
    ctx.lineTo(s.x2, s.y2);
    ctx.stroke();
    const head = ctx.lineWidth * 4;
    const a = Math.atan2(s.y2 - s.y1, s.x2 - s.x1);
    ctx.beginPath();
    ctx.moveTo(s.x2, s.y2);
    ctx.lineTo(s.x2 - head * Math.cos(a - Math.PI / 6), s.y2 - head * Math.sin(a - Math.PI / 6));
    ctx.lineTo(s.x2 - head * Math.cos(a + Math.PI / 6), s.y2 - head * Math.sin(a + Math.PI / 6));
    ctx.closePath();
    ctx.fill();
  }

  /** Screen -> image coordinates. Without this, marks land off-target on a
   *  phone where the canvas is displayed far smaller than the photo. */
  function pos(e: React.PointerEvent<HTMLCanvasElement>) {
    const c = canvasRef.current!;
    const r = c.getBoundingClientRect();
    return {
      x: ((e.clientX - r.left) / r.width) * c.width,
      y: ((e.clientY - r.top) / r.height) * c.height,
    };
  }

  function down(e: React.PointerEvent<HTMLCanvasElement>) {
    e.currentTarget.setPointerCapture(e.pointerId);
    const p = pos(e);
    setDraft(
      tool === "free"
        ? { tool: "free", points: [p] }
        : { tool, x1: p.x, y1: p.y, x2: p.x, y2: p.y },
    );
  }

  function move(e: React.PointerEvent<HTMLCanvasElement>) {
    if (!draft) return;
    const p = pos(e);
    setDraft(
      draft.tool === "free"
        ? { tool: "free", points: [...draft.points, p] }
        : { ...draft, x2: p.x, y2: p.y },
    );
  }

  function up() {
    if (!draft) return;
    setShapes((s) => [...s, draft]);
    setDraft(null);
  }

  function save() {
    const c = canvasRef.current;
    if (!c) return;
    setBusy(true);
    // JPEG at 0.9: an annotated copy is a derivative, so a small quality cost
    // is right — the untouched original travels alongside it.
    onSave({ original: src, annotated: c.toDataURL("image/jpeg", 0.9) });
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-slate-900">
      <div className="flex items-center gap-2 px-3 py-2 text-white">
        <span className="text-sm font-medium">Mark up evidence</span>
        <Button variant="ghost"
          type="button"
          onClick={onDiscard} className="ml-auto rounded p-1"
          aria-label="Discard photo"
          title="Discard — nothing is attached">
          <X size={18} />
        </Button>
      </div>

      <div className="relative flex flex-1 items-center justify-center overflow-hidden p-2">
        <canvas
          ref={canvasRef}
          onPointerDown={down}
          onPointerMove={move}
          onPointerUp={up}
          onPointerCancel={up}
          className={cn(
            "max-h-full max-w-full touch-none rounded bg-black",
            !ready && "invisible",
          )}
        />
        {!ready && !failed && (
          <Loader2 size={22} className="absolute animate-spin text-white/70" />
        )}
        {failed && (
          <div className="absolute flex flex-col items-center gap-3 px-6 text-center">
            <p className="text-sm text-white/80">This photo can&apos;t be marked up.</p>
            <Button type="button" size="sm" variant="secondary" onClick={onAttachWithoutMarkup}>
              Attach without markup
            </Button>
          </div>
        )}
      </div>

      {/* Thumb-reachable: this is used one-handed on a shop floor. */}
      <div className="flex items-center gap-2 border-t border-white/10 px-3 py-3">
        {(
          [
            ["arrow", <ArrowUpRight key="a" size={18} />, "Arrow"],
            ["circle", <Circle key="c" size={18} />, "Circle"],
            ["free", <Pencil key="f" size={18} />, "Freehand"],
          ] as const
        ).map(([t, icon, label]) => (
          <Button variant="ghost"
            key={t}
            type="button"
            onClick={() => setTool(t)}
            aria-label={label}
            aria-pressed={tool === t}
            className={cn(
              "flex min-h-[44px] min-w-[44px] items-center justify-center rounded-lg text-white",
              tool === t ? "bg-rose-600" : "bg-white/10 hover:bg-white/20",
            )}>
            {icon}
          </Button>
        ))}
        <Button variant="ghost"
          type="button"
          onClick={() => setShapes((s) => s.slice(0, -1))}
          disabled={!shapes.length}
          aria-label="Undo" className="flex min-h-[44px] min-w-[44px] rounded-lg text-white">
          <Undo2 size={18} />
        </Button>
        <Button
          type="button"
          size="sm"
          className="ml-auto min-h-[44px]"
          onClick={save}
          disabled={busy || !ready}
        >
          {busy && <Loader2 size={14} className="animate-spin" />} Attach
        </Button>
      </div>

      {/* Spelling out both outcomes. The close button used to attach the photo
          anyway, which read as a duplicate appearing from a dismissed dialog —
          a control that says "close" has to mean it. */}
      <p className="px-3 pb-2 text-center text-[11px] text-white/50">
        Attach saves one photo with your markup; the unmarked original is retained on the record.
        Closing discards the photo.
      </p>
    </div>
  );
}

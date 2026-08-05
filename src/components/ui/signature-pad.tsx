"use client";

// Shared HTML5-canvas signature pad — lifted out of
// components/training/attendance-capture.tsx so the PTW closed-loop panels
// (approve / accept / complete / handback / suspend / resume / extend)
// reuse the SAME drawing surface instead of rebuilding it. Exports:
//   <SignatureModal onSave={dataUrl => …} onClose={…} />   (full-screen modal)
//   <SignatureField value onChange label? />               (inline field with
//                                                            preview + modal)

import { useEffect, useRef, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CheckCircle2, PenTool, XCircle } from "lucide-react";

export function SignatureModal({
  title = "Sign here",
  onSave,
  onClose,
}: {
  title?: string;
  onSave: (dataUrl: string) => void;
  onClose: () => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [drawing, setDrawing] = useState(false);
  const [hasInk, setHasInk] = useState(false);

  useEffect(() => {
    const c = canvasRef.current;
    if (!c) return;
    const ctx = c.getContext("2d");
    if (!ctx) return;
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, c.width, c.height);
    ctx.strokeStyle = "#0f172a";
    ctx.lineWidth = 2.5;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
  }, []);

  function pointer(e: React.PointerEvent<HTMLCanvasElement>) {
    const c = canvasRef.current;
    if (!c) return { x: 0, y: 0 };
    const rect = c.getBoundingClientRect();
    return {
      x: ((e.clientX - rect.left) / rect.width) * c.width,
      y: ((e.clientY - rect.top) / rect.height) * c.height,
    };
  }

  function startDraw(e: React.PointerEvent<HTMLCanvasElement>) {
    const c = canvasRef.current;
    if (!c) return;
    const ctx = c.getContext("2d");
    if (!ctx) return;
    const p = pointer(e);
    ctx.beginPath();
    ctx.moveTo(p.x, p.y);
    setDrawing(true);
    c.setPointerCapture(e.pointerId);
  }
  function moveDraw(e: React.PointerEvent<HTMLCanvasElement>) {
    if (!drawing) return;
    const c = canvasRef.current;
    if (!c) return;
    const ctx = c.getContext("2d");
    if (!ctx) return;
    const p = pointer(e);
    ctx.lineTo(p.x, p.y);
    ctx.stroke();
    setHasInk(true);
  }
  function endDraw(e: React.PointerEvent<HTMLCanvasElement>) {
    setDrawing(false);
    const c = canvasRef.current;
    if (c) c.releasePointerCapture(e.pointerId);
  }

  function clear() {
    const c = canvasRef.current;
    if (!c) return;
    const ctx = c.getContext("2d");
    if (!ctx) return;
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, c.width, c.height);
    setHasInk(false);
  }

  function save() {
    const c = canvasRef.current;
    if (!c) return;
    onSave(c.toDataURL("image/png"));
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-3">
      <Card className="w-full max-w-md">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-1.5">
            <PenTool size={14} /> {title}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <canvas
            ref={canvasRef}
            width={500}
            height={250}
            onPointerDown={startDraw}
            onPointerMove={moveDraw}
            onPointerUp={endDraw}
            onPointerCancel={endDraw}
            className="w-full h-auto rounded-md border-2 border-dashed border-slate-300 bg-white touch-none"
          />
          <div className="flex items-center justify-between gap-2">
            <Button size="sm" variant="outline" onClick={clear}>
              <XCircle size={14} /> Clear
            </Button>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={onClose}>
                Cancel
              </Button>
              <Button size="sm" onClick={save} disabled={!hasInk}>
                <CheckCircle2 size={14} /> Save signature
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

/** Inline signature field: shows the drawn signature (or a "Sign now"
 *  button) and opens the modal to (re)draw. */
export function SignatureField({
  value,
  onChange,
  label = "Signature",
  required,
}: {
  value: string | null;
  onChange: (dataUrl: string | null) => void;
  label?: string;
  required?: boolean;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="space-y-1">
      <div className="text-[11px] font-medium text-slate-600">
        {label} {required && <span className="text-rose-600">*</span>}
      </div>
      {value ? (
        <div className="flex items-center gap-2">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={value}
            alt="Signature"
            className="h-12 rounded border border-slate-200 bg-white"
          />
          <Button size="sm" variant="outline" onClick={() => setOpen(true)}>
            <PenTool size={13} /> Redo
          </Button>
        </div>
      ) : (
        <Button size="sm" variant="outline" onClick={() => setOpen(true)}>
          <PenTool size={13} /> Sign now
        </Button>
      )}
      {open && (
        <SignatureModal
          onSave={(url) => {
            onChange(url);
            setOpen(false);
          }}
          onClose={() => setOpen(false)}
        />
      )}
    </div>
  );
}

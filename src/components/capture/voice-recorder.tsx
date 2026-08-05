"use client";

// Tap-to-start / tap-to-stop voice recorder (spec screen 3 + 5): 60s cap,
// animated level bars while recording, no long-press. Records audio/webm
// (Opus) where supported, audio/mp4 on Safari. Degrades to a "mic not
// available" hint — recording is always optional.

import { useEffect, useRef, useState } from "react";
import { Check, Mic, RotateCcw, Square } from "lucide-react";
import type { Lang } from "@/lib/capture/i18n";
import { t } from "@/lib/capture/i18n";
import type { WizardMedia } from "@/lib/capture/types";
import { MAX_VOICE_SECONDS, mediaDuration, newClientId } from "./upload";

function pickMime(): string {
  if (typeof MediaRecorder === "undefined") return "";
  for (const m of ["audio/webm;codecs=opus", "audio/webm", "audio/mp4"]) {
    if (MediaRecorder.isTypeSupported(m)) return m;
  }
  return "";
}

// Web Speech API (on-device STT) — free opportunistic transcript on Android
// Chrome; recognition runs in parallel with MediaRecorder and its output goes
// up as voice.transcriptOriginal (server translates async). Feature-detected;
// silence means the server pipeline handles it (or the stub stores audio only).
type SpeechRecognitionLike = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  start: () => void;
  stop: () => void;
  onresult: ((event: { results: ArrayLike<ArrayLike<{ transcript: string }> & { isFinal?: boolean }> }) => void) | null;
  onerror: (() => void) | null;
};

function makeRecognizer(lang: Lang): SpeechRecognitionLike | null {
  try {
    const w = window as unknown as {
      SpeechRecognition?: new () => SpeechRecognitionLike;
      webkitSpeechRecognition?: new () => SpeechRecognitionLike;
    };
    const Ctor = w.SpeechRecognition ?? w.webkitSpeechRecognition;
    if (!Ctor) return null;
    const rec = new Ctor();
    rec.lang = lang === "hi" ? "hi-IN" : "en-IN";
    rec.continuous = true;
    rec.interimResults = false;
    return rec;
  } catch {
    return null;
  }
}

export function VoiceRecorder({
  lang,
  existing,
  onRecorded,
  onClear,
  onTranscript,
}: {
  lang: Lang;
  existing: WizardMedia | null;
  onRecorded: (media: WizardMedia) => void;
  onClear: () => void;
  onTranscript?: (text: string) => void;
}) {
  const [state, setState] = useState<"idle" | "recording" | "done" | "denied">(existing ? "done" : "idle");
  const [seconds, setSeconds] = useState(0);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const recognizerRef = useRef<SpeechRecognitionLike | null>(null);
  const transcriptRef = useRef<string>("");

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      recorderRef.current?.stream.getTracks().forEach((tr) => tr.stop());
      try {
        recognizerRef.current?.stop();
      } catch {
        /* already stopped */
      }
    };
  }, []);

  function startRecognizer() {
    const rec = makeRecognizer(lang);
    if (!rec || !onTranscript) return;
    transcriptRef.current = "";
    rec.onresult = (event) => {
      const parts: string[] = [];
      for (let i = 0; i < event.results.length; i++) {
        const alt = event.results[i][0];
        if (alt?.transcript) parts.push(alt.transcript);
      }
      transcriptRef.current = parts.join(" ").trim();
    };
    rec.onerror = null;
    try {
      rec.start();
      recognizerRef.current = rec;
    } catch {
      recognizerRef.current = null;
    }
  }

  async function start() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mime = pickMime();
      const recorder = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);
      chunksRef.current = [];
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      recorder.onstop = async () => {
        stream.getTracks().forEach((tr) => tr.stop());
        try {
          recognizerRef.current?.stop();
        } catch {
          /* already stopped */
        }
        // give the recognizer a beat to flush its final result
        window.setTimeout(() => {
          if (transcriptRef.current && onTranscript) onTranscript(transcriptRef.current);
        }, 400);
        const type = recorder.mimeType || "audio/webm";
        const blob = new Blob(chunksRef.current, { type });
        const duration = (await mediaDuration(blob)) ?? seconds;
        onRecorded({
          clientMediaId: newClientId(),
          kind: "VOICE",
          blob,
          fileName: `voice-note.${type.includes("mp4") ? "m4a" : "webm"}`,
          mimeType: type.split(";")[0],
          durationSec: Math.round(duration * 10) / 10,
        });
        setState("done");
      };
      recorderRef.current = recorder;
      recorder.start();
      startRecognizer();
      setSeconds(0);
      setState("recording");
      timerRef.current = setInterval(() => {
        setSeconds((s) => {
          if (s + 1 >= MAX_VOICE_SECONDS) stop();
          return s + 1;
        });
      }, 1000);
    } catch {
      setState("denied");
    }
  }

  function stop() {
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = null;
    if (recorderRef.current && recorderRef.current.state !== "inactive") recorderRef.current.stop();
  }

  if (state === "denied") {
    return (
      <p className="rounded-xl bg-[#E8EEF7] p-4 text-center text-sm text-[#5A6273]">{t("micDenied", lang)}</p>
    );
  }

  if (state === "done") {
    return (
      <div className="flex flex-col items-center gap-3">
        <div className="flex min-h-[64px] w-full items-center justify-center gap-3 rounded-2xl bg-[#2E7D5B]/10 px-5 py-4 text-[#2E7D5B]">
          <Check className="h-6 w-6" />
          <span className="text-lg font-semibold">
            {t("recorded", lang)}
            {existing?.durationSec ? ` · ${Math.round(existing.durationSec)}s` : ""}
          </span>
        </div>
        <button
          type="button"
          onClick={() => {
            onClear();
            setState("idle");
            setSeconds(0);
          }}
          className="flex min-h-[56px] items-center gap-2 rounded-xl px-5 text-base font-medium text-[#5A6273] active:scale-95"
        >
          <RotateCcw className="h-5 w-5" /> {t("recordAgain", lang)}
        </button>
      </div>
    );
  }

  const recording = state === "recording";
  return (
    <div className="flex flex-col items-center gap-4">
      <button
        type="button"
        onClick={recording ? stop : start}
        aria-label={recording ? t("tapToStop", lang) : t("tapToRecord", lang)}
        className={
          recording
            ? "flex h-28 w-28 items-center justify-center rounded-full bg-[#C0392B] text-white shadow-lg active:scale-95"
            : "flex h-28 w-28 items-center justify-center rounded-full bg-[#0B1F4D] text-white shadow-lg active:scale-95"
        }
      >
        {recording ? <Square className="h-10 w-10 fill-current" /> : <Mic className="h-12 w-12" />}
      </button>
      {recording ? (
        <div className="flex flex-col items-center gap-2">
          {/* waveform animation while recording (CSS bars — see globals.css) */}
          <div className="mx-wave" aria-hidden>
            <span /><span /><span /><span /><span /><span /><span />
          </div>
          <span className="font-mono text-lg font-semibold text-[#C0392B]">
            0:{String(seconds).padStart(2, "0")} / 1:00
          </span>
          <span className="text-sm text-[#5A6273]">{t("tapToStop", lang)}</span>
        </div>
      ) : (
        <span className="text-base font-medium text-[#0B1F4D]">{t("tapToRecord", lang)}</span>
      )}
    </div>
  );
}

"use client";

// Online MCQ assessment-taking interface.
// Server-graded — submission returns the result with passed flag.
// Question-by-question presentation; learner can navigate forward
// and back; submission is final + atomic.

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Loader2,
  Send,
  Sparkles,
  XCircle,
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { readApiError } from "@/lib/client-errors";

type QuestionOption = { text: string; isCorrect?: boolean };

type Question = {
  id: string;
  sequence: number;
  questionText: string;
  questionType: string;
  options: QuestionOption[];
  marks: number;
  isCritical: boolean;
};

type ExistingAttempt = {
  id: string;
  attemptNumber: number;
  submittedAt: string | null;
  scorePercent: number | null;
  passed: boolean;
};

type Response = {
  questionId: string;
  selectedOptions?: number[];
  textAnswer?: string;
  numericAnswer?: number;
};

export function AssessmentTake({
  registrationId,
  attemptsUsed,
  attemptsAllowed,
  passingScorePercent,
  questions,
  existingAssessments,
}: {
  registrationId: string;
  attemptsUsed: number;
  attemptsAllowed: number;
  passingScorePercent: number;
  questions: Question[];
  existingAssessments: ExistingAttempt[];
}) {
  const router = useRouter();
  const [phase, setPhase] = useState<"prelude" | "taking" | "submitted">("prelude");
  const [assessmentId, setAssessmentId] = useState<string | null>(null);
  const [currentQ, setCurrentQ] = useState(0);
  const [responses, setResponses] = useState<Map<string, Response>>(new Map());
  const [submitting, setSubmitting] = useState(false);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<{
    passed: boolean;
    scorePercent: number | null;
    failureReasons: string[] | null;
  } | null>(null);

  // Detect any passed prior attempt — short-circuit
  const passedAttempt = existingAssessments.find((a) => a.passed);
  const exhausted = attemptsUsed >= attemptsAllowed;

  async function start() {
    setStarting(true);
    setError("");
    try {
      const r = await fetch(`/api/training/assessments/start?registration_id=${registrationId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{}",
      });
      if (r.ok) {
        const j = await r.json();
        setAssessmentId(j.id);
        setPhase("taking");
        return;
      }
      setError(await readApiError(r, "Failed to start assessment"));
    } finally {
      setStarting(false);
    }
  }

  async function submit() {
    if (!assessmentId) return;
    setSubmitting(true);
    setError("");
    try {
      const r = await fetch(`/api/training/assessments/${assessmentId}/submit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          registrationId,
          responses: Array.from(responses.values()),
        }),
      });
      if (r.ok) {
        const j = await r.json();
        setResult({
          passed: j.passed,
          scorePercent: j.scorePercent,
          failureReasons: j.failureReasons ?? null,
        });
        setPhase("submitted");
        router.refresh();
        return;
      }
      setError(await readApiError(r, "Failed to submit assessment"));
    } finally {
      setSubmitting(false);
    }
  }

  function setResponse(qId: string, r: Partial<Response>) {
    setResponses((prev) => {
      const next = new Map(prev);
      const existing = next.get(qId) ?? { questionId: qId };
      next.set(qId, { ...existing, ...r, questionId: qId });
      return next;
    });
  }

  // ─── Prelude ────────────────────────────────────────────────────

  if (phase === "prelude") {
    if (passedAttempt) {
      return (
        <Card className="border-emerald-200 bg-emerald-50/40">
          <CardContent className="p-6 text-center">
            <CheckCircle2 size={48} className="mx-auto mb-3 text-emerald-600" />
            <div className="text-lg font-semibold text-emerald-900 mb-1">Already passed</div>
            <p className="text-sm text-emerald-800">
              You passed attempt #{passedAttempt.attemptNumber} with{" "}
              {passedAttempt.scorePercent}%. No further action needed.
            </p>
          </CardContent>
        </Card>
      );
    }

    if (exhausted) {
      return (
        <Card className="border-rose-200 bg-rose-50/40">
          <CardContent className="p-6 text-center">
            <XCircle size={48} className="mx-auto mb-3 text-rose-600" />
            <div className="text-lg font-semibold text-rose-900 mb-1">No attempts remaining</div>
            <p className="text-sm text-rose-800">
              You've used all {attemptsAllowed} attempts for this assessment. Talk to your trainer
              about a remediation plan.
            </p>
          </CardContent>
        </Card>
      );
    }

    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Ready to start the assessment?</CardTitle>
          <CardDescription className="text-xs">
            {questions.length} question{questions.length === 1 ? "" : "s"} · pass mark{" "}
            {passingScorePercent}% · {attemptsAllowed - attemptsUsed} attempt
            {attemptsAllowed - attemptsUsed === 1 ? "" : "s"} remaining
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <ul className="text-xs text-slate-600 list-disc list-inside space-y-1">
            <li>You can navigate freely before submitting.</li>
            <li>Critical questions (marked) must be answered correctly to pass.</li>
            <li>Submission is final — you cannot change responses after.</li>
            {existingAssessments.length > 0 && (
              <li>
                Past attempts:{" "}
                {existingAssessments.map((a) => (
                  <Badge
                    key={a.id}
                    className={
                      a.passed
                        ? "bg-emerald-100 text-emerald-700 border-emerald-200 text-[10px]"
                        : "bg-rose-100 text-rose-700 border-rose-200 text-[10px]"
                    }
                  >
                    #{a.attemptNumber} {a.scorePercent}%
                  </Badge>
                ))}
              </li>
            )}
          </ul>
          {error && <div className="text-xs text-rose-700">{error}</div>}
          <Button onClick={start} disabled={starting}>
            {starting ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
            Start Attempt #{attemptsUsed + 1}
          </Button>
        </CardContent>
      </Card>
    );
  }

  // ─── Submitted ──────────────────────────────────────────────────

  if (phase === "submitted" && result) {
    return (
      <Card
        className={
          result.passed ? "border-emerald-200 bg-emerald-50/40" : "border-rose-200 bg-rose-50/40"
        }
      >
        <CardContent className="p-6 text-center space-y-3">
          {result.passed ? (
            <CheckCircle2 size={48} className="mx-auto text-emerald-600" />
          ) : (
            <XCircle size={48} className="mx-auto text-rose-600" />
          )}
          <div
            className={[
              "text-2xl font-bold",
              result.passed ? "text-emerald-900" : "text-rose-900",
            ].join(" ")}
          >
            {result.passed ? "PASSED" : "FAILED"}
          </div>
          <div className="text-sm text-slate-700">
            Score: <strong>{result.scorePercent}%</strong> (passing mark{" "}
            {passingScorePercent}%)
          </div>
          {!result.passed && result.failureReasons && result.failureReasons.length > 0 && (
            <div className="text-xs text-rose-700">
              Reason{result.failureReasons.length === 1 ? "" : "s"}:{" "}
              {result.failureReasons.map((f) => f.replace(/_/g, " ")).join(", ")}
            </div>
          )}
          <Button variant="outline" onClick={() => router.back()}>
            Back to schedule
          </Button>
        </CardContent>
      </Card>
    );
  }

  // ─── Taking ─────────────────────────────────────────────────────

  if (questions.length === 0) {
    return (
      <Card>
        <CardContent className="p-6 text-sm text-center text-slate-600">
          This program has assessment enabled but no questions configured. Contact L&D.
        </CardContent>
      </Card>
    );
  }

  const q = questions[currentQ];
  const r = responses.get(q.id);
  const answered = (() => {
    if (!r) return false;
    if (q.questionType === "MCQ_SINGLE" || q.questionType === "MCQ_MULTI")
      return (r.selectedOptions ?? []).length > 0;
    if (q.questionType === "NUMERIC")
      return r.numericAnswer !== undefined && r.numericAnswer !== null;
    return !!r.textAnswer;
  })();
  const totalAnswered = Array.from(responses.values()).filter((rr) => {
    const qq = questions.find((x) => x.id === rr.questionId);
    if (!qq) return false;
    if (qq.questionType === "MCQ_SINGLE" || qq.questionType === "MCQ_MULTI")
      return (rr.selectedOptions ?? []).length > 0;
    if (qq.questionType === "NUMERIC")
      return rr.numericAnswer !== undefined && rr.numericAnswer !== null;
    return !!rr.textAnswer;
  }).length;

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base">
            Question {currentQ + 1} of {questions.length}
          </CardTitle>
          <div className="text-xs text-slate-500">
            {totalAnswered} answered
          </div>
        </div>
        {/* Progress bar */}
        <div className="h-1 bg-slate-200 rounded-full mt-2 overflow-hidden">
          <div
            className="h-full bg-primary-600 transition-all"
            style={{ width: `${((currentQ + 1) / questions.length) * 100}%` }}
          />
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="rounded-md border border-slate-200 bg-slate-50 p-3">
          <div className="flex items-start gap-2">
            <span className="bg-primary-600 text-white rounded-full w-6 h-6 flex items-center justify-center text-xs font-bold shrink-0">
              {q.sequence}
            </span>
            <div className="text-sm text-slate-800 flex-1">{q.questionText}</div>
            {q.isCritical && (
              <Badge className="bg-rose-100 text-rose-700 border-rose-200 text-[10px] shrink-0">
                Critical
              </Badge>
            )}
          </div>
          <div className="text-[11px] text-slate-500 mt-2 ml-8">
            Worth {q.marks} mark{q.marks === 1 ? "" : "s"}
          </div>
        </div>

        {(q.questionType === "MCQ_SINGLE" || q.questionType === "MCQ_MULTI") && (
          <div className="space-y-1.5">
            {q.options.map((opt, i) => {
              const selected = (r?.selectedOptions ?? []).includes(i);
              const isMulti = q.questionType === "MCQ_MULTI";
              return (
                <button
                  key={i}
                  type="button"
                  onClick={() => {
                    if (isMulti) {
                      const cur = new Set(r?.selectedOptions ?? []);
                      if (cur.has(i)) cur.delete(i);
                      else cur.add(i);
                      setResponse(q.id, { selectedOptions: Array.from(cur).sort() });
                    } else {
                      setResponse(q.id, { selectedOptions: [i] });
                    }
                  }}
                  className={[
                    "w-full text-left px-3 py-2.5 rounded-md border transition-colors",
                    selected
                      ? "border-primary-500 bg-primary-50 text-primary-900"
                      : "border-slate-200 bg-white text-slate-700 hover:border-primary-300",
                  ].join(" ")}
                >
                  <div className="flex items-center gap-2">
                    <div
                      className={[
                        "w-5 h-5 flex items-center justify-center text-xs font-medium border",
                        isMulti ? "rounded" : "rounded-full",
                        selected ? "bg-primary-600 text-white border-primary-600" : "border-slate-300",
                      ].join(" ")}
                    >
                      {selected && <CheckCircle2 size={14} />}
                    </div>
                    <span className="text-sm">{opt.text}</span>
                  </div>
                </button>
              );
            })}
          </div>
        )}

        {q.questionType === "TRUE_FALSE" && (
          <div className="grid grid-cols-2 gap-2">
            {["true", "false"].map((v) => {
              const selected = r?.textAnswer === v;
              return (
                <button
                  key={v}
                  onClick={() => setResponse(q.id, { textAnswer: v })}
                  className={[
                    "px-4 py-3 rounded-md border font-medium",
                    selected
                      ? "bg-primary-600 text-white border-primary-600"
                      : "bg-white text-slate-700 border-slate-200",
                  ].join(" ")}
                >
                  {v.charAt(0).toUpperCase() + v.slice(1)}
                </button>
              );
            })}
          </div>
        )}

        {q.questionType === "SHORT_ANSWER" && (
          <Textarea
            rows={2}
            value={r?.textAnswer ?? ""}
            onChange={(e) => setResponse(q.id, { textAnswer: e.target.value })}
            placeholder="Your answer"
          />
        )}

        {q.questionType === "NUMERIC" && (
          <Input
            type="number"
            value={r?.numericAnswer ?? ""}
            onChange={(e) => setResponse(q.id, { numericAnswer: parseFloat(e.target.value) })}
            placeholder="Numeric answer"
          />
        )}

        {error && <div className="text-xs text-rose-700">{error}</div>}

        <div className="flex items-center justify-between pt-2">
          <Button
            variant="outline"
            onClick={() => setCurrentQ((i) => Math.max(0, i - 1))}
            disabled={currentQ === 0 || submitting}
          >
            <ChevronLeft size={14} /> Previous
          </Button>

          {currentQ < questions.length - 1 ? (
            <Button
              onClick={() => setCurrentQ((i) => Math.min(questions.length - 1, i + 1))}
              disabled={submitting}
            >
              Next <ChevronRight size={14} />
            </Button>
          ) : (
            <Button onClick={submit} disabled={submitting}>
              {submitting ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
              Submit ({totalAnswered}/{questions.length} answered)
            </Button>
          )}
        </div>

        {currentQ === questions.length - 1 && totalAnswered < questions.length && (
          <div className="text-[11px] text-amber-700 flex items-center gap-1">
            <AlertTriangle size={11} /> {questions.length - totalAnswered} question
            {questions.length - totalAnswered === 1 ? "" : "s"} unanswered. Unanswered questions
            score zero.
          </div>
        )}
      </CardContent>
    </Card>
  );
}

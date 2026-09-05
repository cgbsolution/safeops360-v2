"use client";

// Renders the AI agent outputs persisted on Observation.closureTriggers.
// Currently surfaces:
//   • TriageAgent (rule_triage_on_submit) — submission-time triage
//     suggestion (severity / category / priority + first-response prompts)
//   • LessonsDistributionAgent (rule_lessons_distribution) — closure-time
//     lesson + audience + follow-up actions
//
// Hides itself when neither agent has fired (or both were skipped because
// ANTHROPIC_API_KEY isn't set).

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Sparkles, AlertTriangle, BookOpen, Users } from "lucide-react";
import { Alert } from "@/components/ui/alert";

type ClosureTrigger = {
  ruleId: string;
  ruleName: string;
  fired: boolean;
  reason?: string | null;
  error?: string | null;
  data?: any;
};

type TriageData = {
  agentId?: string;
  model?: string | null;
  suggestedSeverity?: string | null;
  suggestedCategory?: string | null;
  priority?: string | null;
  rationale?: string | null;
  firstResponse?: string[];
  skipped?: boolean;
};

type LessonData = {
  agentId?: string;
  model?: string | null;
  lesson?: string | null;
  audience?: string[];
  actions?: string[];
  tags?: string[];
  confidence?: string | null;
  skipped?: boolean;
};

export function AiInsightsPanel({ closureTriggers }: { closureTriggers: any }) {
  const list: ClosureTrigger[] = Array.isArray(closureTriggers) ? closureTriggers : [];
  const triage = list.find((e) => e.ruleId === "rule_triage_on_submit" && e.fired)?.data as
    | TriageData
    | undefined;
  const lesson = list.find((e) => e.ruleId === "rule_lessons_distribution" && e.fired)?.data as
    | LessonData
    | undefined;

  if (!triage && !lesson) return null;

  return (
    <Card className="border-violet-200 bg-violet-50/30">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-violet-900 text-base">
          <Sparkles size={16} /> AI Insights
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {triage && (triage.suggestedSeverity || triage.firstResponse?.length) && (
          <Alert variant="warning" className="p-3">
            <div className="flex items-center gap-2 text-xs uppercase tracking-wider font-semibold text-amber-800 mb-2">
              <AlertTriangle size={12} /> Triage Agent
            </div>
            <div className="flex flex-wrap gap-2 mb-2">
              {triage.suggestedSeverity && (
                <Badge variant="warning" size="sm">
                  Severity: {triage.suggestedSeverity}
                </Badge>
              )}
              {triage.suggestedCategory && (
                <Badge variant="warning" size="sm">
                  Category: {triage.suggestedCategory}
                </Badge>
              )}
              {triage.priority && (
                <Badge variant="warning" size="sm">
                  Priority: {triage.priority}
                </Badge>
              )}
            </div>
            {triage.rationale && (
              <div className="text-xs text-amber-900 italic">"{triage.rationale}"</div>
            )}
            {triage.firstResponse && triage.firstResponse.length > 0 && (
              <ul className="list-disc list-inside text-xs text-amber-900 mt-2 space-y-0.5">
                {triage.firstResponse.map((s, i) => (
                  <li key={i}>{s}</li>
                ))}
              </ul>
            )}
          </Alert>
        )}

        {lesson && lesson.lesson && (
          <Alert variant="success" className="p-3">
            <div className="flex items-center gap-2 text-xs uppercase tracking-wider font-semibold text-emerald-800 mb-2">
              <BookOpen size={12} /> Lessons Distribution
              {lesson.confidence && (
                <Badge variant="success" size="sm" className="ml-auto">
                  {lesson.confidence}
                </Badge>
              )}
            </div>
            <div className="text-sm text-emerald-900 mb-3">{lesson.lesson}</div>
            {lesson.audience && lesson.audience.length > 0 && (
              <div className="flex items-center gap-2 text-xs text-emerald-800 mb-2">
                <Users size={11} />
                <span className="font-medium">Audience:</span>
                <span>{lesson.audience.join(", ")}</span>
              </div>
            )}
            {lesson.actions && lesson.actions.length > 0 && (
              <div>
                <div className="text-[10px] uppercase tracking-wider font-semibold text-emerald-800 mb-1">
                  Follow-up actions
                </div>
                <ul className="list-disc list-inside text-xs text-emerald-900 space-y-0.5">
                  {lesson.actions.map((a, i) => (
                    <li key={i}>{a}</li>
                  ))}
                </ul>
              </div>
            )}
            {lesson.tags && lesson.tags.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-3">
                {lesson.tags.map((t, i) => (
                  <Badge key={i} variant="success" size="sm" className="rounded px-1.5 py-0.5 font-normal tracking-normal">
                    {t}
                  </Badge>
                ))}
              </div>
            )}
          </Alert>
        )}
      </CardContent>
    </Card>
  );
}

import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  AlertTriangle,
  ClipboardCheck,
  ShieldAlert,
  GraduationCap,
  FileCheck,
  Users,
  Info,
  Activity,
  CheckCircle2,
  XCircle
} from "lucide-react";

// Each closureTriggers entry has the shape produced by post-closure-rules.ts.
// We intentionally don't share that type here to avoid a server→client type
// import; the runtime payload is small and stable.
type TriggerEvent = {
  ruleId: string;
  ruleName: string;
  fired: boolean;
  reason?: string;
  spawnedRecordType?: string;
  spawnedRecordId?: string;
  spawnedRecordNumber?: string;
  error?: string;
};

type RelatedItemsProps = {
  observationNumber: string;
  isRepeat: boolean;
  similarObservationIds: string[];
  activePermitId: string | null;
  activePermitNumber: string | null;
  permitReviewFlagged: boolean;
  triggeredInspectionId: string | null;
  triggeredInspectionNumber: string | null;
  triggeredTbtId: string | null;
  triggeredTbtCode: string | null;
  contributedToIncidentId: string | null;
  contributedToIncidentNumber: string | null;
  closureTriggers: TriggerEvent[] | null;
  coachingTasks: { id: string; number: string; type: string; status: string }[];
};

const TYPE_TO_LINK: Record<string, (id: string) => string> = {
  INSPECTION: (id) => `/inspections/${id}`,
  TRAINING_RECORD: (id) => `/training/${id}`,
  INCIDENT: (id) => `/incidents/${id}`,
  COACHING_TASK: (id) => `/inbox?tab=tasks&highlight=${id}`,
  PERMIT_FLAG: (id) => `/ptw/${id}`,
  CONTRACTOR_SCORE_EVENT: (id) => `/contractors?event=${id}`
};

const TYPE_ICON: Record<string, any> = {
  INSPECTION: ClipboardCheck,
  TRAINING_RECORD: GraduationCap,
  INCIDENT: ShieldAlert,
  COACHING_TASK: Users,
  PERMIT_FLAG: FileCheck,
  CONTRACTOR_SCORE_EVENT: Activity
};

export function RelatedItems(props: RelatedItemsProps) {
  const fired = (props.closureTriggers ?? []).filter((t) => t.fired);
  const skipped = (props.closureTriggers ?? []).filter((t) => !t.fired);
  const errored = (props.closureTriggers ?? []).filter((t) => !!t.error);

  const hasAnything =
    props.isRepeat ||
    props.activePermitId ||
    props.triggeredInspectionId ||
    props.triggeredTbtId ||
    props.contributedToIncidentId ||
    fired.length > 0 ||
    props.coachingTasks.length > 0;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Related Items</CardTitle>
        <CardDescription>
          Cross-module records this observation triggered or is linked to. Auto-populated at submit
          and on closure by the post-closure rules engine.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        {!hasAnything && (
          <div className="text-sm text-slate-500 text-center py-6">
            No related items yet. Triggers fire on closure (focused inspections, toolbox talks,
            permit flags, coaching tasks) and submit-time detections (repeat patterns, active
            permit overlap).
          </div>
        )}

        {/* Submit-time detections */}
        {(props.isRepeat || props.activePermitId) && (
          <Section title="Submit-time detections" icon={Info}>
            {props.isRepeat && (
              <Row
                badge="REPEAT PATTERN"
                badgeClass="bg-amber-100 text-amber-800 border-amber-200"
                title={`This is the ${props.similarObservationIds.length + 1}${ordinal(props.similarObservationIds.length + 1)} similar observation in the last 30 days`}
                detail={`${props.similarObservationIds.length} earlier matching observation${props.similarObservationIds.length === 1 ? "" : "s"} in the same area + category`}
              />
            )}
            {props.activePermitId && (
              <Row
                badge="ACTIVE PERMIT"
                badgeClass="bg-blue-100 text-blue-800 border-blue-200"
                title={`Observed inside an active permit: ${props.activePermitNumber ?? props.activePermitId}`}
                detail={
                  props.permitReviewFlagged
                    ? "Flagged for review on closure (Rule 5)"
                    : "Linked but no review flagged"
                }
                href={`/ptw/${props.activePermitId}`}
              />
            )}
          </Section>
        )}

        {/* Spawned records (post-closure) */}
        {fired.length > 0 && (
          <Section title="Spawned by closure rules" icon={CheckCircle2}>
            {fired.map((evt) => {
              const Icon = (evt.spawnedRecordType && TYPE_ICON[evt.spawnedRecordType]) ?? Activity;
              const href =
                evt.spawnedRecordType && evt.spawnedRecordId
                  ? TYPE_TO_LINK[evt.spawnedRecordType]?.(evt.spawnedRecordId)
                  : undefined;
              return (
                <Row
                  key={evt.ruleId}
                  icon={Icon}
                  badge={evt.spawnedRecordType ?? "RULE"}
                  badgeClass="bg-emerald-100 text-emerald-800 border-emerald-200"
                  title={evt.ruleName}
                  detail={
                    evt.spawnedRecordNumber
                      ? `${evt.reason ?? ""} · ${evt.spawnedRecordNumber}`
                      : evt.reason ?? ""
                  }
                  href={href}
                />
              );
            })}
          </Section>
        )}

        {/* Coaching tasks (Rule 6) — surfaced separately so HR can see them all together */}
        {props.coachingTasks.length > 0 && (
          <Section title="Coaching / counselling tasks" icon={Users}>
            {props.coachingTasks.map((c) => (
              <Row
                key={c.id}
                badge={c.type === "FORMAL_COUNSELING" ? "FORMAL" : "COACHING"}
                badgeClass={
                  c.type === "FORMAL_COUNSELING"
                    ? "bg-rose-100 text-rose-800 border-rose-200"
                    : "bg-blue-100 text-blue-800 border-blue-200"
                }
                title={c.number}
                detail={`Status: ${c.status}`}
              />
            ))}
          </Section>
        )}

        {/* Contributed-to-incident */}
        {props.contributedToIncidentId && (
          <Section title="Contributed to incident" icon={ShieldAlert}>
            <Row
              badge="INCIDENT"
              badgeClass="bg-rose-100 text-rose-800 border-rose-200"
              title={props.contributedToIncidentNumber ?? props.contributedToIncidentId}
              detail="High-risk-score systemic CAPA suggested (Rule 7)"
              href={`/incidents/${props.contributedToIncidentId}`}
            />
          </Section>
        )}

        {/* Skipped rules (audit visibility) */}
        {skipped.length > 0 && (
          <Section title="Rules that did not fire" icon={XCircle} muted>
            {skipped.map((evt) => (
              <Row
                key={evt.ruleId}
                badge="SKIPPED"
                badgeClass="bg-slate-100 text-slate-600 border-slate-200"
                title={evt.ruleName}
                detail={evt.reason ?? ""}
                muted
              />
            ))}
          </Section>
        )}

        {/* Errored rules */}
        {errored.length > 0 && (
          <Section title="Rules that errored" icon={AlertTriangle}>
            {errored.map((evt) => (
              <Row
                key={evt.ruleId}
                badge="ERROR"
                badgeClass="bg-rose-100 text-rose-800 border-rose-200"
                title={evt.ruleName}
                detail={evt.error ?? "unknown error"}
              />
            ))}
          </Section>
        )}
      </CardContent>
    </Card>
  );
}

// ─── Internal pieces ──────────────────────────────────────────────────

function Section({
  title,
  icon: Icon,
  children,
  muted
}: {
  title: string;
  icon: any;
  children: React.ReactNode;
  muted?: boolean;
}) {
  return (
    <div>
      <div className={`flex items-center gap-2 mb-2 ${muted ? "text-slate-500" : "text-slate-700"}`}>
        <Icon size={14} />
        <span className="text-xs font-semibold uppercase tracking-wider">{title}</span>
      </div>
      <div className="space-y-1.5">{children}</div>
    </div>
  );
}

function Row({
  icon: Icon,
  badge,
  badgeClass,
  title,
  detail,
  href,
  muted
}: {
  icon?: any;
  badge: string;
  badgeClass: string;
  title: string;
  detail?: string;
  href?: string;
  muted?: boolean;
}) {
  const inner = (
    <div className={`flex items-start gap-3 rounded-md border bg-white px-3 py-2 ${muted ? "opacity-70" : ""}`}>
      {Icon && <Icon size={16} className="mt-0.5 text-slate-500 flex-shrink-0" />}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <Badge className={`text-[10px] ${badgeClass}`}>{badge}</Badge>
          <span className="text-sm font-medium text-slate-900 truncate">{title}</span>
        </div>
        {detail && <div className="text-xs text-slate-500 mt-0.5">{detail}</div>}
      </div>
    </div>
  );
  if (href) {
    return (
      <Link href={href} className="block hover:opacity-90 transition">
        {inner}
      </Link>
    );
  }
  return inner;
}

function ordinal(n: number): string {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return s[(v - 20) % 10] ?? s[v] ?? s[0];
}

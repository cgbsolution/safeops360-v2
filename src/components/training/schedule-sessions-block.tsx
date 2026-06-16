"use client";

import { useState } from "react";
import { CalendarDays, CheckCircle2, ClipboardList } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { AttendanceCapture } from "@/components/training/attendance-capture";
import { formatDateTime } from "@/lib/utils";

const ALLOWED_TRAINER_ROLES = [
  "TRAINER",
  "LD_MANAGER",
  "HSE_MANAGER",
  "ADMIN",
  "SYSTEM_ADMIN",
];

type Session = {
  id: string;
  sequence: number;
  title: string;
  startTime: string;
  endTime: string;
  conductedAt: string | null;
};

type Roster = {
  registrationId: string;
  userId: string;
  userName: string;
  userDesignation: string | null;
};

export function ScheduleSessionsBlock({
  scheduleId,
  sessions,
  roster,
  scheduleStatus,
  currentRole,
  isAssignedTrainer,
}: {
  scheduleId: string;
  sessions: Session[];
  roster: Roster[];
  scheduleStatus: string;
  currentRole: string;
  isAssignedTrainer: boolean;
}) {
  const [captureFor, setCaptureFor] = useState<Session | null>(null);

  const canCapture =
    (isAssignedTrainer || ALLOWED_TRAINER_ROLES.includes(currentRole)) &&
    scheduleStatus === "IN_PROGRESS";

  return (
    <>
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <CalendarDays size={16} /> Sessions ({sessions.length})
          </CardTitle>
          <CardDescription className="text-xs">
            {canCapture
              ? "You can capture attendance per session."
              : scheduleStatus === "IN_PROGRESS"
              ? "Only the assigned trainer or LD/HSE/Admin can capture attendance."
              : "Attendance capture opens once the schedule is started."}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {sessions.map((s) => (
            <div
              key={s.id}
              className="rounded-md border border-slate-200 bg-white p-3 flex items-start justify-between gap-3"
            >
              <div className="space-y-0.5">
                <div className="flex items-center gap-2">
                  <span className="bg-primary-600 text-white rounded-full w-6 h-6 flex items-center justify-center text-xs font-bold">
                    {s.sequence}
                  </span>
                  <span className="font-medium text-sm">{s.title}</span>
                  {s.conductedAt && (
                    <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200 text-[10px]">
                      <CheckCircle2 size={10} /> Conducted
                    </Badge>
                  )}
                </div>
                <div className="text-xs text-slate-500">
                  {formatDateTime(new Date(s.startTime))} → {formatDateTime(new Date(s.endTime))}
                </div>
                {s.conductedAt && (
                  <div className="text-[11px] text-emerald-700">
                    Captured at {formatDateTime(new Date(s.conductedAt))}
                  </div>
                )}
              </div>
              {canCapture && (
                <Button size="sm" variant="outline" onClick={() => setCaptureFor(s)}>
                  <ClipboardList size={14} />
                  {s.conductedAt ? "Update attendance" : "Capture attendance"}
                </Button>
              )}
            </div>
          ))}
        </CardContent>
      </Card>

      {captureFor && (
        <AttendanceCapture
          sessionId={captureFor.id}
          sessionTitle={captureFor.title}
          roster={roster}
          onClose={() => setCaptureFor(null)}
        />
      )}
    </>
  );
}

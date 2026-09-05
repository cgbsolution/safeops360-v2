"use client";

import { Paperclip, FileText, AlertTriangle } from "lucide-react";
import type { WizardSubmission } from "./wizard-types";
import { Alert } from "@/components/ui/alert";
import { Card } from "@/components/ui/card";

const SUGGESTED_DOCS: { category: string; label: string; required: boolean }[] = [
  { category: "ATTENDANCE_REPORT", label: "HR attendance system export", required: true },
  { category: "PAYROLL_EXPORT", label: "Payroll system export", required: true },
  { category: "CONTRACTOR_BILL", label: "Contractor invoices / muster rolls", required: false },
  { category: "STATUTORY_FORM", label: "Form 24 / Annual return supporting docs", required: false },
  { category: "OTHER", label: "Other supporting documents", required: false }
];

/**
 * Step 7 displays the suggested document list and any attachments
 * already on the submission. File-upload UX is intentionally NOT
 * implemented in C2 — the platform's attachment plumbing is uneven
 * across modules (some go through Python, some through Next), and
 * unifying it is its own work item. This step shows what was
 * uploaded so reviewers see the trail; uploads themselves can be
 * added later without changing the schema or wizard flow.
 */
export function StepAttachments({
  submission,
  isReadOnly
}: {
  submission: WizardSubmission;
  isReadOnly: boolean;
}) {
  const byCategory = new Map<string, typeof submission.attachments>();
  for (const a of submission.attachments) {
    const list = byCategory.get(a.category) ?? [];
    list.push(a);
    byCategory.set(a.category, list);
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-slate-900">Step 7 — Supporting Documents</h2>
        <p className="text-sm text-slate-500 mt-1">
          Attach the source documents that back this submission. Required documents help the Plant
          Head review faster and provide audit defensibility for statutory inspections.
        </p>
      </div>

      <Alert variant="warning" className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800 flex items-start gap-2">
        <AlertTriangle size={16} className="mt-0.5 flex-shrink-0" />
        <div>
          <div className="font-medium">File upload arrives in a follow-up</div>
          <div className="text-xs mt-1">
            The wizard tracks WHICH documents are needed and lists what's been uploaded by other
            channels — actual file picker / drag-drop lands once attachment infra is unified across
            modules. Submission can still proceed in Step 8 without uploads (with a notes warning).
          </div>
        </div>
      </Alert>

      <div className="space-y-3">
        {SUGGESTED_DOCS.map((doc) => {
          const items = byCategory.get(doc.category) ?? [];
          return (
            <Card key={doc.category} className="rounded-md border bg-white shadow-none">
              <div className="flex items-center justify-between border-b bg-slate-50 px-4 py-2">
                <div className="flex items-center gap-2">
                  <FileText size={14} className="text-slate-500" />
                  <span className="text-sm font-medium">{doc.label}</span>
                  {doc.required && <span className="text-[10px] uppercase tracking-wider text-rose-700">Recommended</span>}
                </div>
                <div className="text-xs text-slate-500">
                  {items.length} attachment{items.length === 1 ? "" : "s"}
                </div>
              </div>
              <div className="px-4 py-2">
                {items.length === 0 ? (
                  <div className="text-xs text-slate-400 italic">No documents uploaded for this category yet.</div>
                ) : (
                  <ul className="space-y-1">
                    {items.map((a) => (
                      <li key={a.id} className="flex items-center justify-between text-sm">
                        <a
                          href={a.fileUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="flex items-center gap-2 text-primary-700 hover:underline"
                        >
                          <Paperclip size={12} /> {a.fileName}
                        </a>
                        <span className="text-xs text-slate-500">
                          {new Date(a.uploadedAt).toLocaleDateString("en-IN")}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}

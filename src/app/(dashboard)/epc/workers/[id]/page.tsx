import Link from "next/link";
import { RosterStatusBadge } from "@/components/workforce/roster-status-badge";
import { backendFetch } from "@/lib/backend/fetch";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import {
  User,
  Phone,
  Heart,
  Shield,
  Building2,
  ClipboardCheck,
  ArrowLeft,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Stethoscope,
} from "lucide-react";
import CertificationsTab from "./CertificationsTab";
import { Card } from "@/components/ui/card";

export const dynamic = "force-dynamic";

type TrainingCert = {
  programCode: string;
  programName: string;
  issuedDate?: string;
  validUntil?: string;
  certificateUrl?: string;
  status?: string;
};

type CompetencyRecord = {
  competencyCode: string;
  competencyName: string;
  validFrom?: string;
  validUntil?: string;
  assessor?: string;
  status?: string;
};

type PpeIssuance = {
  ppeType: string;
  itemSerial?: string;
  issuedDate?: string;
  expiryDate?: string;
  status?: string;
};

type WorkerDetail = {
  id: string;
  workerCode: string;
  fullName: string;
  dateOfBirth: string | null;
  gender: string | null;
  bloodGroup: string | null;
  aadhaarLast4: string | null;
  panNumber: string | null;
  esicNumber: string | null;
  mobileNumber: string | null;
  emergencyContactName: string | null;
  emergencyContactPhone: string | null;
  homeState: string | null;
  primaryTrade: string;
  yearsExperience: number | null;
  educationLevel: string | null;
  status: string;
  // HSE safety hold from the Observation deroster workflow — a separate axis
  // from `status` (the EPC employment state).
  rosterStatus?: string;
  currentDerosterRef?: string | null;
  contractorCompanyName: string;
  contractorCompanyId: string;
  medicalFitnessValidUpto: string | null;
  medicalFitnessStatus: string | null;
  trainingCertificates?: TrainingCert[];
  competencyRecords?: CompetencyRecord[];
  ppeIssuances?: PpeIssuance[];
};

type MobilizationRecord = {
  id: string;
  mobilizationNumber: string;
  siteName: string;
  siteCode: string;
  trade: string;
  status: string;
  mobilisationDate: string | null;
  demobilisationDate: string | null;
};

type InductionRecord = {
  id: string;
  siteName: string;
  inductionDate: string;
  validUpto: string | null;
  status: string;
};

type GateEntry = {
  id: string;
  siteName: string;
  result: string;
  checkedAt: string;
  gatePassNumber: string | null;
};

function humanizeStatus(s: string): string {
  return s.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function statusBadgeClass(status: string): string {
  const s = status.toLowerCase();
  if (s === "active") return "bg-emerald-100 text-emerald-800 border-emerald-200";
  if (s === "suspended") return "bg-amber-100 text-amber-800 border-amber-200";
  if (s === "blacklisted") return "bg-rose-100 text-rose-800 border-rose-200";
  if (s === "pending_checks") return "bg-amber-100 text-amber-800 border-amber-200";
  if (s === "checks_complete_pending_approval") return "bg-blue-100 text-blue-800 border-blue-200";
  if (s === "demobilised") return "bg-slate-100 text-slate-600 border-slate-200";
  return "bg-slate-100 text-slate-600 border-slate-200";
}

function gateResultClass(result: string): string {
  const r = result.toLowerCase();
  if (r === "cleared") return "bg-emerald-100 text-emerald-800 border-emerald-200";
  if (r === "cleared_with_warnings") return "bg-amber-100 text-amber-800 border-amber-200";
  if (r === "not_cleared") return "bg-rose-100 text-rose-800 border-rose-200";
  return "bg-slate-100 text-slate-600 border-slate-200";
}

function medicalStatusIcon(status: string | null) {
  if (!status) return null;
  const s = status.toLowerCase();
  if (s === "valid" || s === "fit") return <CheckCircle2 size={14} className="text-emerald-500" />;
  if (s === "expiring_soon") return <AlertTriangle size={14} className="text-amber-500" />;
  return <XCircle size={14} className="text-rose-500" />;
}

function fmtDate(d: string | null): string {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

function fmtDateTime(d: string): string {
  return new Date(d).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
}

export default async function WorkerDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const [workerData, mobData, inductionData, gateData] = await Promise.all([
    backendFetch<{ worker: WorkerDetail } | WorkerDetail>(`/api/epc/workers/${id}`).catch(() => null),
    backendFetch<{ mobilizations: MobilizationRecord[] }>(`/api/epc/mobilization?workerId=${id}`).catch(() => null),
    backendFetch<{ inductions: InductionRecord[] }>(`/api/epc/inductions?workerId=${id}`).catch(() => null),
    backendFetch<{ entries: GateEntry[] }>(`/api/epc/gate/log?workerId=${id}`).catch(() => null),
  ]);

  const worker = workerData
    ? ("worker" in workerData ? workerData.worker : workerData)
    : null;
  const mobilizations = mobData?.mobilizations ?? [];
  const inductions = inductionData?.inductions ?? [];
  const gateHistory = gateData?.entries ?? [];

  if (!worker) {
    return (
      <Card className="rounded-xl border bg-white p-10 text-center text-sm text-slate-500 shadow-none">
        Worker not found or failed to load.
      </Card>
    );
  }

  return (
    <div>
      {/* Breadcrumb */}
      <div className="flex items-center text-xs text-slate-500 mb-3 gap-1">
        <Link href="/epc" className="hover:text-cyan-700">EPC</Link>
        <span>/</span>
        <Link href="/epc/workers" className="hover:text-cyan-700">Workers</Link>
        <span>/</span>
        <span className="text-slate-700 font-medium">{worker.workerCode}</span>
      </div>

      {/* Profile card */}
      <Card className="rounded-xl border bg-white shadow-sm p-5 mb-5">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-4">
            {/* Photo placeholder */}
            <div className="h-16 w-16 rounded-full bg-gradient-to-br from-cyan-400 to-cyan-700 flex items-center justify-center flex-shrink-0">
              <span className="text-2xl font-bold text-white">
                {worker.fullName.charAt(0).toUpperCase()}
              </span>
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2 flex-wrap">
                {worker.fullName}
                <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-semibold ${statusBadgeClass(worker.status)}`}>
                  {humanizeStatus(worker.status)}
                </span>
                <RosterStatusBadge status={worker.rosterStatus} />
              </h1>
              <p className="text-sm text-slate-500 mt-0.5">
                {worker.primaryTrade} &middot;{" "}
                <Link href={`/epc/contractors/${worker.contractorCompanyId}`} className="hover:text-cyan-700 hover:underline">
                  {worker.contractorCompanyName}
                </Link>
              </p>
              <p className="text-xs font-mono text-slate-400 mt-0.5">{worker.workerCode}</p>
            </div>
          </div>
          <Link href="/epc/workers" className="flex items-center gap-1 text-xs text-slate-500 hover:text-slate-700 flex-shrink-0">
            <ArrowLeft size={14} /> Back
          </Link>
        </div>

        {/* Quick stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-5 pt-4 border-t">
          <div>
            <p className="text-xs text-slate-500">Experience</p>
            <p className="text-sm font-semibold text-slate-900">{worker.yearsExperience != null ? `${worker.yearsExperience} yrs` : "—"}</p>
          </div>
          <div>
            <p className="text-xs text-slate-500">Education</p>
            <p className="text-sm font-semibold text-slate-900">{worker.educationLevel ? humanizeStatus(worker.educationLevel) : "—"}</p>
          </div>
          <div>
            <p className="text-xs text-slate-500">Home State</p>
            <p className="text-sm font-semibold text-slate-900">{worker.homeState ?? "—"}</p>
          </div>
          <div>
            <p className="text-xs text-slate-500">Medical Fitness</p>
            <p className="text-sm font-semibold text-slate-900 flex items-center gap-1">
              {medicalStatusIcon(worker.medicalFitnessStatus)}
              {fmtDate(worker.medicalFitnessValidUpto)}
            </p>
          </div>
        </div>
      </Card>

      {/* Identity + Contact cards */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-5">
        <Card className="rounded-xl border bg-white shadow-sm p-5">
          <h2 className="text-sm font-semibold text-slate-700 mb-3 flex items-center gap-2">
            <User size={14} /> Identity
          </h2>
          <dl className="space-y-2 text-sm">
            <InfoRow label="Date of Birth" value={fmtDate(worker.dateOfBirth)} />
            <InfoRow label="Gender" value={worker.gender ? humanizeStatus(worker.gender) : "—"} />
            <InfoRow label="Blood Group" value={worker.bloodGroup ?? "—"} />
            <InfoRow label="Aadhaar" value={worker.aadhaarLast4 ? `****-****-${worker.aadhaarLast4}` : "—"} />
            <InfoRow label="PAN" value={worker.panNumber ?? "—"} />
            <InfoRow label="ESIC No." value={worker.esicNumber ?? "—"} />
          </dl>
        </Card>

        <Card className="rounded-xl border bg-white shadow-sm p-5">
          <h2 className="text-sm font-semibold text-slate-700 mb-3 flex items-center gap-2">
            <Phone size={14} /> Contact
          </h2>
          <dl className="space-y-2 text-sm">
            <InfoRow label="Mobile" value={worker.mobileNumber ?? "—"} />
            <InfoRow label="Emergency Contact" value={worker.emergencyContactName ?? "—"} />
            <InfoRow label="Emergency Phone" value={worker.emergencyContactPhone ?? "—"} />
          </dl>
        </Card>

        <Card className="rounded-xl border bg-white shadow-sm p-5">
          <h2 className="text-sm font-semibold text-slate-700 mb-3 flex items-center gap-2">
            <Stethoscope size={14} /> Medical Fitness
          </h2>
          <div className="flex items-center gap-2 mb-3">
            {medicalStatusIcon(worker.medicalFitnessStatus)}
            <span className="text-sm font-semibold text-slate-900">
              {worker.medicalFitnessStatus ? humanizeStatus(worker.medicalFitnessStatus) : "No record"}
            </span>
          </div>
          <dl className="space-y-2 text-sm">
            <InfoRow label="Valid Until" value={fmtDate(worker.medicalFitnessValidUpto)} />
          </dl>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="mobilizations">
        <TabsList className="mb-4">
          <TabsTrigger value="mobilizations">Mobilizations</TabsTrigger>
          <TabsTrigger value="certifications">Certifications</TabsTrigger>
          <TabsTrigger value="inductions">Inductions</TabsTrigger>
          <TabsTrigger value="gate">Gate History</TabsTrigger>
        </TabsList>

        {/* Mobilizations */}
        <TabsContent value="mobilizations">
          <Card className="rounded-xl border bg-white shadow-sm overflow-hidden">
            <div className="px-4 py-3 border-b">
              <h3 className="text-sm font-semibold text-slate-700">Mobilization History ({mobilizations.length})</h3>
            </div>
            {mobilizations.length === 0 ? (
              <div className="p-10 text-center text-sm text-slate-500">
                <Building2 size={32} className="mx-auto mb-2 text-slate-300" />
                No mobilizations on record.
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Mob. No.</TableHead>
                    <TableHead>Site</TableHead>
                    <TableHead>Trade</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Start</TableHead>
                    <TableHead>End</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {mobilizations.map((m) => (
                    <TableRow key={m.id}>
                      <TableCell className="font-mono text-xs text-slate-500">{m.mobilizationNumber}</TableCell>
                      <TableCell className="font-medium text-slate-900">
                        {m.siteName} <span className="text-xs text-slate-400 font-normal">({m.siteCode})</span>
                      </TableCell>
                      <TableCell className="text-slate-600">{m.trade}</TableCell>
                      <TableCell>
                        <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-semibold ${statusBadgeClass(m.status)}`}>
                          {humanizeStatus(m.status)}
                        </span>
                      </TableCell>
                      <TableCell className="text-slate-600">{fmtDate(m.mobilisationDate)}</TableCell>
                      <TableCell className="text-slate-600">{fmtDate(m.demobilisationDate)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </Card>
        </TabsContent>

        {/* Certifications */}
        <TabsContent value="certifications">
          <CertificationsTab
            workerId={worker.id}
            trainingCertificates={worker.trainingCertificates ?? []}
            competencyRecords={worker.competencyRecords ?? []}
            ppeIssuances={worker.ppeIssuances ?? []}
          />
        </TabsContent>

        {/* Inductions */}
        <TabsContent value="inductions">
          <Card className="rounded-xl border bg-white shadow-sm overflow-hidden">
            <div className="px-4 py-3 border-b">
              <h3 className="text-sm font-semibold text-slate-700">Site Inductions ({inductions.length})</h3>
            </div>
            {inductions.length === 0 ? (
              <div className="p-10 text-center text-sm text-slate-500">
                <Shield size={32} className="mx-auto mb-2 text-slate-300" />
                No induction records found.
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Site</TableHead>
                    <TableHead>Induction Date</TableHead>
                    <TableHead>Valid Until</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {inductions.map((ind) => (
                    <TableRow key={ind.id}>
                      <TableCell className="font-medium text-slate-900">{ind.siteName}</TableCell>
                      <TableCell className="text-slate-600">{fmtDate(ind.inductionDate)}</TableCell>
                      <TableCell className="text-slate-600">{fmtDate(ind.validUpto)}</TableCell>
                      <TableCell>
                        <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-semibold ${statusBadgeClass(ind.status)}`}>
                          {humanizeStatus(ind.status)}
                        </span>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </Card>
        </TabsContent>

        {/* Gate History */}
        <TabsContent value="gate">
          <Card className="rounded-xl border bg-white shadow-sm overflow-hidden">
            <div className="px-4 py-3 border-b">
              <h3 className="text-sm font-semibold text-slate-700">Gate Clearance History ({gateHistory.length})</h3>
            </div>
            {gateHistory.length === 0 ? (
              <div className="p-10 text-center text-sm text-slate-500">
                <ClipboardCheck size={32} className="mx-auto mb-2 text-slate-300" />
                No gate activity on record.
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Time</TableHead>
                    <TableHead>Site</TableHead>
                    <TableHead>Result</TableHead>
                    <TableHead>Gate Pass</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {gateHistory.map((entry) => (
                    <TableRow key={entry.id}>
                      <TableCell className="text-xs text-slate-500 whitespace-nowrap">{fmtDateTime(entry.checkedAt)}</TableCell>
                      <TableCell className="font-medium text-slate-900">{entry.siteName}</TableCell>
                      <TableCell>
                        <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-semibold ${gateResultClass(entry.result)}`}>
                          {humanizeStatus(entry.result)}
                        </span>
                      </TableCell>
                      <TableCell className="font-mono text-xs text-slate-500">{entry.gatePassNumber ?? "—"}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-2 border-b pb-2 last:border-0 last:pb-0">
      <dt className="text-slate-500 text-xs flex-shrink-0 w-28">{label}</dt>
      <dd className="text-slate-900 font-medium text-right text-xs break-all">{value}</dd>
    </div>
  );
}

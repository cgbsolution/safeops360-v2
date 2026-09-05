"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Download,
  Upload,
  CheckCircle2,
  AlertTriangle,
  Users,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { SelectField } from "@/components/ui/select-field";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Alert } from "@/components/ui/alert";
import { Card } from "@/components/ui/card";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/table";

type ParsedRow = {
  fullName: string;
  primaryTrade: string;
  mobileNumber: string;
  aadhaarLast4?: string;
  dateOfBirth?: string;
  gender?: string;
  yearsExperience: number;
  educationLevel?: string;
  emergencyContactName?: string;
  emergencyContactPhone?: string;
  homeState?: string;
};

type ImportResult = {
  created: number;
  updated: number;
  errors: { row: number; name: string; error: string }[];
  total_processed: number;
};

const CSV_HEADERS = [
  "fullName",
  "primaryTrade",
  "mobileNumber",
  "aadhaarLast4",
  "dateOfBirth",
  "gender",
  "yearsExperience",
  "educationLevel",
  "emergencyContactName",
  "emergencyContactPhone",
  "homeState",
];

function parseCSV(text: string): ParsedRow[] {
  const lines = text.trim().split("\n").filter(Boolean);
  if (lines.length < 2) return [];
  const headers = lines[0].split(",").map((h) => h.trim().replace(/^"|"$/g, ""));
  return lines
    .slice(1)
    .map((line) => {
      const vals = line.split(",").map((v) => v.trim().replace(/^"|"$/g, ""));
      const obj: Record<string, string> = {};
      headers.forEach((h, i) => {
        obj[h] = vals[i] ?? "";
      });
      return {
        fullName: obj.fullName || "",
        primaryTrade: obj.primaryTrade || "",
        mobileNumber: obj.mobileNumber || "",
        aadhaarLast4: obj.aadhaarLast4 || undefined,
        dateOfBirth: obj.dateOfBirth || undefined,
        gender: obj.gender || undefined,
        yearsExperience: parseInt(obj.yearsExperience || "0", 10) || 0,
        educationLevel: obj.educationLevel || undefined,
        emergencyContactName: obj.emergencyContactName || undefined,
        emergencyContactPhone: obj.emergencyContactPhone || undefined,
        homeState: obj.homeState || undefined,
      };
    })
    .filter((r) => r.fullName);
}

function downloadTemplate() {
  const csv = [
    CSV_HEADERS.join(","),
    "Rajesh Sharma,Welder,9876543210,1234,1990-05-15,Male,8,iti,,9876543211,Rajasthan",
    "Suresh Kumar,Rigger,9123456789,5678,1985-11-20,Male,12,10th,Ramesh Kumar,9123456780,UP",
  ].join("\n");
  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "epc_worker_import_template.csv";
  a.click();
  URL.revokeObjectURL(url);
}

const STAGES = ["upload", "preview", "result"] as const;
type Stage = (typeof STAGES)[number];

export default function BulkImportPage() {
  const [stage, setStage] = useState<Stage>("upload");
  const [contractorCompanyId, setContractorCompanyId] = useState("");
  const [companies, setCompanies] = useState<
    { id: string; companyName: string; companyCode: string }[]
  >([]);
  const [csvText, setCsvText] = useState("");
  const [rows, setRows] = useState<ParsedRow[]>([]);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetch("/api/epc/contractors")
      .then((r) => r.json())
      .then((d) => setCompanies(d.contractors ?? d ?? []))
      .catch(() => {});
  }, []);

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => setCsvText((ev.target?.result as string) ?? "");
    reader.readAsText(file);
  }

  function handlePreview() {
    if (!contractorCompanyId) {
      setError("Select a contractor company first");
      return;
    }
    const parsed = parseCSV(csvText);
    if (parsed.length === 0) {
      setError("No valid rows found in CSV");
      return;
    }
    setError(null);
    setRows(parsed);
    setStage("preview");
  }

  async function handleImport() {
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/epc/workers/bulk-import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          workers: rows.map((r) => ({ ...r, contractorCompanyId })),
        }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.detail ?? `Error ${res.status}`);
      }
      const data: ImportResult = await res.json();
      setResult(data);
      setStage("result");
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Import failed");
    } finally {
      setSubmitting(false);
    }
  }

  const stageIndex = STAGES.indexOf(stage);

  return (
    <div className="max-w-3xl mx-auto">
      <div className="mb-5">
        <Link
          href="/epc/workers"
          className="flex items-center gap-1 text-xs text-slate-500 hover:text-slate-700 mb-3"
        >
          <ArrowLeft size={13} /> Back to Workers
        </Link>
        <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2">
          <Upload size={20} className="text-cyan-700" /> Bulk Worker Import
        </h1>
        <p className="text-sm text-slate-500 mt-1">
          Register multiple contractor workers at once using a CSV file
        </p>
      </div>

      {/* Stage indicators */}
      <div className="flex items-center gap-3 mb-6 text-xs font-medium">
        {STAGES.map((s, i) => (
          <div key={s} className="flex items-center gap-2">
            <div
              className={`h-6 w-6 rounded-full flex items-center justify-center text-[10px] font-bold ${
                stage === s
                  ? "bg-cyan-700 text-white"
                  : i < stageIndex
                  ? "bg-cyan-100 text-cyan-700 border border-cyan-300"
                  : "bg-slate-100 text-slate-400"
              }`}
            >
              {i + 1}
            </div>
            <span className={stage === s ? "text-cyan-700" : "text-slate-400"}>
              {s === "upload" ? "Upload" : s === "preview" ? "Preview" : "Results"}
            </span>
            {i < 2 && <div className="h-px w-8 bg-slate-200" />}
          </div>
        ))}
      </div>

      {error && (
        <Alert variant="destructive" className="mb-4 rounded-lg bg-rose-50 border border-rose-200 px-4 py-3 text-sm text-rose-700">
          {error}
        </Alert>
      )}

      {/* Stage 1: Upload */}
      {stage === "upload" && (
        <Card className="rounded-xl border bg-white shadow-sm p-6 space-y-5">
          <div>
            <div className="flex items-center justify-between mb-2">
              <Label>CSV Template</Label>
              <Button
                variant="ghost"
                onClick={downloadTemplate}
                className="inline-flex items-center gap-1.5 text-xs text-cyan-700 hover:underline"
              >
                <Download size={13} /> Download Template
              </Button>
            </div>
            <p className="text-xs text-slate-500">
              Fill in the template with worker details, then upload below. Required columns:{" "}
              <span className="font-mono">fullName</span>,{" "}
              <span className="font-mono">primaryTrade</span>,{" "}
              <span className="font-mono">mobileNumber</span>.
            </p>
          </div>

          <div>
            <Label htmlFor="company">Contractor Company *</Label>
            <SelectField
              id="company"
              value={contractorCompanyId}
              onChange={setContractorCompanyId}
              className="mt-1"
              placeholder="Select company..."
              options={companies.map((c) => ({ value: String(c.id), label: `${c.companyName} ${c.companyCode ? ` (${c.companyCode})` : ""}` }))}
            />
          </div>

          <div>
            <Label>Upload CSV File</Label>
            <Alert variant="info"
              className="mt-1 border-2 border-dashed border-slate-300 rounded-lg p-8 text-center cursor-pointer hover:border-cyan-400 transition-colors"
              onClick={() => fileRef.current?.click()}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                const file = e.dataTransfer.files?.[0];
                if (!file) return;
                const reader = new FileReader();
                reader.onload = (ev) => setCsvText((ev.target?.result as string) ?? "");
                reader.readAsText(file);
              }}>
              <Upload size={28} className="mx-auto mb-2 text-slate-400" />
              <p className="text-sm text-slate-600">Click to browse or drag CSV file here</p>
              <p className="text-xs text-slate-400 mt-1">Supports .csv files, up to 1000 rows</p>
            </Alert>
            <Input
              ref={fileRef}
              type="file"
              accept=".csv"
              onChange={handleFile}
              className="hidden" />
          </div>

          <div>
            <Label htmlFor="csv-paste">Or paste CSV data</Label>
            <Textarea
              id="csv-paste"
              rows={6}
              value={csvText}
              onChange={(e) => setCsvText(e.target.value)}
              placeholder={"fullName,primaryTrade,mobileNumber,...\nRajesh Sharma,Welder,9876543210,..."}
              className="mt-1 text-xs font-mono"
            />
          </div>

          <Button onClick={handlePreview} disabled={!csvText.trim()} className="w-full">
            Preview Import &rarr;
          </Button>
        </Card>
      )}

      {/* Stage 2: Preview */}
      {stage === "preview" && (
        <div className="space-y-4">
          <Card className="rounded-xl border bg-white shadow-sm p-5">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-sm font-semibold text-slate-700">
                  {rows.length} workers ready to import
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Showing first 10 rows. Existing workers (matched by Aadhaar + company) will be
                  updated.
                </p>
              </div>
              <Button
                variant="ghost"
                onClick={() => setStage("upload")}
                className="text-xs text-slate-500 hover:text-slate-700"
              >
                Edit CSV
              </Button>
            </div>
            <Table className="text-xs">
              <TableHeader>
                <TableRow className="bg-slate-50">
                  {["#", "Name", "Trade", "Mobile", "Aadhaar", "Experience", "State"].map(
                    (h) => (
                      <TableHead key={h}>
                        {h}
                      </TableHead>
                    )
                  )}
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.slice(0, 10).map((r, i) => (
                  <TableRow key={i}>
                    <TableCell className="text-slate-400">{i + 1}</TableCell>
                    <TableCell className="font-medium text-slate-900">{r.fullName}</TableCell>
                    <TableCell className="text-slate-600">{r.primaryTrade}</TableCell>
                    <TableCell className="text-slate-600">{r.mobileNumber}</TableCell>
                    <TableCell className="text-slate-500">
                      ****{r.aadhaarLast4 ?? "—"}
                    </TableCell>
                    <TableCell className="text-slate-600">{r.yearsExperience}y</TableCell>
                    <TableCell className="text-slate-600">{r.homeState ?? "—"}</TableCell>
                  </TableRow>
                ))}
                {rows.length > 10 && (
                  <TableRow>
                    <TableCell
                      colSpan={7}
                      className="text-slate-400 text-center"
                    >
                      ... and {rows.length - 10} more rows
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </Card>
          <Button onClick={handleImport} disabled={submitting} className="w-full">
            {submitting ? (
              <>
                <Loader2 size={14} className="mr-1.5 animate-spin" /> Importing {rows.length}{" "}
                workers...
              </>
            ) : (
              `Confirm — Import ${rows.length} Workers`
            )}
          </Button>
        </div>
      )}

      {/* Stage 3: Results */}
      {stage === "result" && result && (
        <div className="space-y-4">
          <div className="grid grid-cols-3 gap-4">
            <Alert variant="success" className="rounded-xl border bg-emerald-50 border-emerald-200 p-4 text-center">
              <CheckCircle2 size={24} className="mx-auto mb-1 text-emerald-600" />
              <p className="text-3xl font-bold text-emerald-700 tabular-nums">
                {result.created}
              </p>
              <p className="text-xs text-emerald-600 mt-1">Workers Created</p>
            </Alert>
            <Alert variant="info" className="rounded-xl border bg-blue-50 border-blue-200 p-4 text-center">
              <Users size={24} className="mx-auto mb-1 text-blue-600" />
              <p className="text-3xl font-bold text-blue-700 tabular-nums">{result.updated}</p>
              <p className="text-xs text-blue-600 mt-1">Workers Updated</p>
            </Alert>
            <div
              className={`rounded-xl border p-4 text-center ${
                result.errors.length > 0
                  ? "bg-rose-50 border-rose-200"
                  : "bg-slate-50 border-slate-200"
              }`}
            >
              <AlertTriangle
                size={24}
                className={`mx-auto mb-1 ${
                  result.errors.length > 0 ? "text-rose-500" : "text-slate-300"
                }`}
              />
              <p
                className={`text-3xl font-bold tabular-nums ${
                  result.errors.length > 0 ? "text-rose-700" : "text-slate-400"
                }`}
              >
                {result.errors.length}
              </p>
              <p
                className={`text-xs mt-1 ${
                  result.errors.length > 0 ? "text-rose-600" : "text-slate-400"
                }`}
              >
                Errors
              </p>
            </div>
          </div>

          {result.errors.length > 0 && (
            <Alert variant="destructive" className="rounded-xl border border-rose-200 bg-white shadow-sm overflow-hidden">
              <div className="px-4 py-3 border-b bg-rose-50">
                <h3 className="text-sm font-semibold text-rose-700">
                  Import Errors — Fix and Re-upload
                </h3>
              </div>
              <Table className="text-xs">
                <TableHeader>
                  <TableRow className="bg-slate-50">
                    <TableHead>Row</TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead>Error</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {result.errors.map((err, i) => (
                    <TableRow key={i}>
                      <TableCell className="tabular-nums text-slate-500">{err.row}</TableCell>
                      <TableCell className="text-slate-700">{err.name}</TableCell>
                      <TableCell className="text-rose-600">{err.error}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Alert>
          )}

          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setStage("upload");
                setResult(null);
                setCsvText("");
                setRows([]);
              }}
            >
              Import Another Batch
            </Button>
            <Button asChild size="sm">
              <Link href="/epc/workers">View All Workers &rarr;</Link>
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

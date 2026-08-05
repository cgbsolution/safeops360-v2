"use client";

import { useState, useEffect, useRef } from "react";
import {
  Search,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  User,
  ClipboardCheck,
  Loader2,
  Building2,
  Clock,
  RefreshCw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/table";

type Site = { id: string; siteName: string; siteCode: string };

type CheckItem = {
  key: string;
  label: string;
  status: "pass" | "warn" | "fail";
  detail: string;
};

type GateClearanceResult = {
  result: "cleared" | "cleared_with_warnings" | "not_cleared";
  workerCode: string;
  workerName: string;
  primaryTrade: string;
  contractorCompanyName: string;
  gatePassNumber: string | null;
  gatePassValidUntil: string | null;
  checks: CheckItem[];
  warnings: string[];
  blockingReasons: string[];
};

type GateLogEntry = {
  id: string;
  workerCode: string;
  workerName: string;
  result: string;
  checkedAt: string;
  gatePassNumber: string | null;
  checkMethod: string;
};

function humanizeStatus(s: string): string {
  return s.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function gateResultConfig(result: GateClearanceResult["result"]) {
  if (result === "cleared") {
    return {
      headerBg: "bg-emerald-600",
      headerText: "text-white",
      icon: <CheckCircle2 size={32} className="text-white" />,
      label: "CLEARED",
      labelBg: "bg-white/20",
    };
  }
  if (result === "cleared_with_warnings") {
    return {
      headerBg: "bg-amber-500",
      headerText: "text-white",
      icon: <AlertTriangle size={32} className="text-white" />,
      label: "CLEARED WITH WARNINGS",
      labelBg: "bg-white/20",
    };
  }
  return {
    headerBg: "bg-rose-600",
    headerText: "text-white",
    icon: <XCircle size={32} className="text-white" />,
    label: "NOT CLEARED",
    labelBg: "bg-white/20",
  };
}

function CheckRow({ check }: { check: CheckItem }) {
  if (check.status === "pass") {
    return (
      <div className="flex items-start gap-3 py-2 border-b last:border-0">
        <CheckCircle2 size={16} className="text-emerald-500 flex-shrink-0 mt-0.5" />
        <div>
          <span className="text-sm font-medium text-slate-800">{check.label}</span>
          {check.detail && <p className="text-xs text-slate-500">{check.detail}</p>}
        </div>
      </div>
    );
  }
  if (check.status === "warn") {
    return (
      <div className="flex items-start gap-3 py-2 border-b last:border-0">
        <AlertTriangle size={16} className="text-amber-500 flex-shrink-0 mt-0.5" />
        <div>
          <span className="text-sm font-medium text-amber-800">{check.label}</span>
          {check.detail && <p className="text-xs text-amber-700">{check.detail}</p>}
        </div>
      </div>
    );
  }
  return (
    <div className="flex items-start gap-3 py-2 border-b last:border-0">
      <XCircle size={16} className="text-rose-500 flex-shrink-0 mt-0.5" />
      <div>
        <span className="text-sm font-medium text-rose-800">{check.label}</span>
        {check.detail && <p className="text-xs text-rose-700">{check.detail}</p>}
      </div>
    </div>
  );
}

function fmtDateTime(d: string): string {
  return new Date(d).toLocaleString("en-IN", {
    day: "numeric", month: "short",
    hour: "2-digit", minute: "2-digit",
  });
}

export default function GateClearancePage() {
  const [sites, setSites] = useState<Site[]>([]);
  const [selectedSiteId, setSelectedSiteId] = useState("");
  const [query, setQuery] = useState("");
  const [checking, setChecking] = useState(false);
  const [result, setResult] = useState<GateClearanceResult | null>(null);
  const [checkError, setCheckError] = useState<string | null>(null);
  const [gateLog, setGateLog] = useState<GateLogEntry[]>([]);
  const [logLoading, setLogLoading] = useState(false);
  const [now, setNow] = useState(() => new Date());
  const inputRef = useRef<HTMLInputElement>(null);

  // Live clock
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 10_000);
    return () => clearInterval(t);
  }, []);

  // Load sites
  useEffect(() => {
    fetch("/api/epc/sites")
      .then((r) => r.json())
      .then((d) => {
        const s = d.sites ?? d ?? [];
        setSites(s);
        if (s.length > 0 && !selectedSiteId) setSelectedSiteId(s[0].id);
      })
      .catch(() => {});
  }, []);

  // Load gate log when site changes
  useEffect(() => {
    if (!selectedSiteId) return;
    setLogLoading(true);
    fetch(`/api/epc/gate/log?siteId=${selectedSiteId}`)
      .then((r) => r.json())
      .then((d) => setGateLog(d.entries ?? d ?? []))
      .catch(() => setGateLog([]))
      .finally(() => setLogLoading(false));
  }, [selectedSiteId, result]);

  async function handleCheck(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedSiteId || !query.trim()) return;
    setChecking(true);
    setResult(null);
    setCheckError(null);
    try {
      const res = await fetch("/api/epc/gate/check", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          siteId: selectedSiteId,
          workerIdentifier: query.trim(),
          checkMethod: "manual_search",
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.detail ?? data.error ?? `Error ${res.status}`);
      }
      setResult(data);
    } catch (e: any) {
      setCheckError(e.message ?? "Gate check failed");
    } finally {
      setChecking(false);
    }
  }

  function handleClear() {
    setResult(null);
    setCheckError(null);
    setQuery("");
    setTimeout(() => inputRef.current?.focus(), 50);
  }

  const selectedSite = sites.find((s) => s.id === selectedSiteId);
  const cfg = result ? gateResultConfig(result.result) : null;

  return (
    <div className="max-w-2xl mx-auto">
      {/* Header: site + clock */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2">
            <ClipboardCheck size={20} className="text-cyan-700" /> Gate Clearance
          </h1>
          <p className="text-xs text-slate-500 mt-0.5 flex items-center gap-1">
            <Clock size={11} />
            {now.toLocaleString("en-IN", { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
          </p>
        </div>
        {selectedSite && (
          <div className="text-right">
            <p className="text-sm font-semibold text-slate-800">{selectedSite.siteName}</p>
            <p className="text-xs font-mono text-slate-500">{selectedSite.siteCode}</p>
          </div>
        )}
      </div>

      {/* Site selector */}
      <div className="mb-4">
        <Label htmlFor="site-select" className="text-xs text-slate-600 font-medium">Select Site</Label>
        <Select
          id="site-select"
          value={selectedSiteId}
          onChange={(e) => { setSelectedSiteId(e.target.value); handleClear(); }}
          className="mt-1 font-medium"
        >
          <option value="">— Select a site —</option>
          {sites.map((s) => (
            <option key={s.id} value={s.id}>{s.siteName} ({s.siteCode})</option>
          ))}
        </Select>
      </div>

      {/* Search form */}
      <form onSubmit={handleCheck} className="mb-6">
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <Input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Enter worker code or name..."
              disabled={!selectedSiteId || checking}
              className="pl-10 pr-4 text-base font-medium disabled:bg-slate-50"
            />
          </div>
          <Button
            type="submit"
            disabled={!selectedSiteId || !query.trim() || checking}
            className="px-6 py-3.5 text-base font-semibold min-w-[100px] h-auto"
          >
            {checking ? <Loader2 size={18} className="animate-spin" /> : "Check"}
          </Button>
        </div>
        {!selectedSiteId && (
          <p className="mt-2 text-xs text-amber-700">Please select a site before checking.</p>
        )}
      </form>

      {/* Error */}
      {checkError && (
        <div className="mb-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800 flex items-start gap-2">
          <AlertTriangle size={16} className="flex-shrink-0 mt-0.5" />
          <div>
            <span className="font-semibold">Check failed: </span>{checkError}
          </div>
        </div>
      )}

      {/* Result card */}
      {result && cfg && (
        <div className="mb-6 rounded-2xl border overflow-hidden shadow-lg">
          {/* Colored header */}
          <div className={`${cfg.headerBg} px-6 py-5`}>
            <div className="flex items-center gap-4">
              {/* Worker avatar */}
              <div className="h-14 w-14 rounded-full bg-white/20 flex items-center justify-center flex-shrink-0">
                <span className="text-2xl font-bold text-white">
                  {result.workerName.charAt(0).toUpperCase()}
                </span>
              </div>
              <div className="flex-1 min-w-0">
                <h2 className="text-xl font-bold text-white leading-tight">{result.workerName}</h2>
                <p className="text-white/80 text-sm">{result.primaryTrade} &middot; {result.contractorCompanyName}</p>
                <p className="text-white/60 text-xs font-mono mt-0.5">{result.workerCode}</p>
              </div>
              <div className={`rounded-lg ${cfg.labelBg} px-3 py-2 text-center flex-shrink-0`}>
                {cfg.icon}
                <p className="text-white text-xs font-bold mt-1 leading-tight">{cfg.label}</p>
              </div>
            </div>
          </div>

          {/* Checks */}
          <div className="bg-white px-6 py-4">
            {(result.checks ?? []).map((check) => (
              <CheckRow key={check.key} check={check} />
            ))}

            {/* Warnings */}
            {(result.warnings ?? []).length > 0 && (
              <div className="mt-3 rounded-lg bg-amber-50 border border-amber-200 px-4 py-3">
                {result.warnings.map((w, i) => (
                  <p key={i} className="text-sm text-amber-800 flex items-start gap-2">
                    <AlertTriangle size={14} className="flex-shrink-0 mt-0.5" /> {w}
                  </p>
                ))}
              </div>
            )}

            {/* Blocking reasons */}
            {(result.blockingReasons ?? []).length > 0 && (
              <div className="mt-3 rounded-lg bg-rose-50 border border-rose-200 px-4 py-3">
                {result.blockingReasons.map((r, i) => (
                  <p key={i} className="text-sm text-rose-800 flex items-start gap-2">
                    <XCircle size={14} className="flex-shrink-0 mt-0.5" /> {r}
                  </p>
                ))}
              </div>
            )}

            {/* Gate pass / Deny footer */}
            {result.result !== "not_cleared" && result.gatePassNumber && (
              <div className="mt-4 pt-3 border-t">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-slate-500">Gate Pass</p>
                    <p className="font-mono text-sm font-bold text-slate-800">{result.gatePassNumber}</p>
                  </div>
                  {result.gatePassValidUntil && (
                    <div className="text-right">
                      <p className="text-xs text-slate-500">Valid until</p>
                      <p className="text-sm font-semibold text-slate-800">{result.gatePassValidUntil}</p>
                    </div>
                  )}
                </div>
                {/* QR Code for gate pass */}
                <div className="flex flex-col items-center mt-4 p-4 bg-white rounded-xl border border-emerald-200">
                  <p className="text-xs text-slate-500 mb-2 font-medium">Gate Pass QR Code</p>
                  <img
                    src={`https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(result.gatePassNumber)}&bgcolor=ffffff&color=000000`}
                    alt={`QR code for gate pass ${result.gatePassNumber}`}
                    className="rounded-lg"
                    width={180}
                    height={180}
                  />
                  <p className="text-xs font-mono text-slate-600 mt-2">{result.gatePassNumber}</p>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Valid until{" "}
                    {result.gatePassValidUntil
                      ? new Date(result.gatePassValidUntil).toLocaleTimeString("en-IN", {
                          hour: "2-digit",
                          minute: "2-digit",
                        })
                      : "end of shift"}
                  </p>
                </div>
              </div>
            )}

            {result.result === "not_cleared" && (
              <div className="mt-4 pt-3 border-t">
                <Button
                  variant="outline"
                  className="w-full border-rose-300 bg-rose-50 text-rose-800 hover:bg-rose-100 font-bold py-3 text-base h-auto"
                  onClick={handleClear}
                >
                  <XCircle size={18} className="mr-2" /> DENY ENTRY
                </Button>
              </div>
            )}
          </div>

          {/* New check */}
          <div className="bg-slate-50 px-6 py-3 border-t flex justify-between items-center">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleClear}
              className="gap-1"
            >
              <RefreshCw size={13} /> New Check
            </Button>
            <span className="text-xs text-slate-500">
              {humanizeStatus(result.result)}
            </span>
          </div>
        </div>
      )}

      {/* Today's Gate Log */}
      <div className="rounded-xl border bg-white shadow-sm overflow-hidden">
        <div className="px-4 py-3 border-b flex items-center justify-between">
          <h2 className="text-sm font-semibold text-slate-700 flex items-center gap-2">
            <ClipboardCheck size={14} /> Today&apos;s Gate Log
            {selectedSite && <span className="text-slate-400 font-normal">— {selectedSite.siteName}</span>}
          </h2>
          {logLoading && <Loader2 size={14} className="animate-spin text-slate-400" />}
        </div>

        {!selectedSiteId ? (
          <div className="p-8 text-center text-sm text-slate-500">
            <Building2 size={28} className="mx-auto mb-2 text-slate-300" />
            Select a site to view today&apos;s gate log.
          </div>
        ) : gateLog.length === 0 ? (
          <div className="p-8 text-center text-sm text-slate-500">
            No gate activity today for this site.
          </div>
        ) : (
          <Table className="text-sm">
            <TableHeader>
              <TableRow className="bg-slate-50 text-xs font-semibold text-slate-600 uppercase tracking-wide text-left">
                <TableHead>Time</TableHead>
                <TableHead>Worker</TableHead>
                <TableHead>Code</TableHead>
                <TableHead>Result</TableHead>
                <TableHead>Pass No.</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {gateLog.map((entry) => {
                const r = entry.result.toLowerCase();
                const cls =
                  r === "cleared" ? "bg-emerald-100 text-emerald-800 border-emerald-200"
                  : r === "cleared_with_warnings" ? "bg-amber-100 text-amber-800 border-amber-200"
                  : "bg-rose-100 text-rose-800 border-rose-200";
                return (
                  <TableRow key={entry.id}>
                    <TableCell className="text-xs text-slate-500 whitespace-nowrap">{fmtDateTime(entry.checkedAt)}</TableCell>
                    <TableCell className="font-medium text-slate-900">{entry.workerName}</TableCell>
                    <TableCell className="font-mono text-xs text-slate-500">{entry.workerCode}</TableCell>
                    <TableCell>
                      <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-semibold ${cls}`}>
                        {humanizeStatus(entry.result)}
                      </span>
                    </TableCell>
                    <TableCell className="font-mono text-xs text-slate-500">{entry.gatePassNumber ?? "—"}</TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </div>
    </div>
  );
}

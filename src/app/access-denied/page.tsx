import Link from "next/link";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getUserRoleCodes } from "@/lib/auth/permissions";
import { Card, CardContent } from "@/components/ui/card";
import { ShieldAlert, ArrowLeft } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function AccessDeniedPage(
  props: {
    searchParams: Promise<{ code?: string; reason?: string }>;
  }
) {
  const searchParams = await props.searchParams;
  const session = await getServerSession(authOptions);
  const userId = (session?.user as any)?.id ?? "";
  const roles = userId ? await getUserRoleCodes(userId) : [];
  const code = searchParams.code ?? "";
  const reason = searchParams.reason ?? "";

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
      <Card className="max-w-lg w-full">
        <CardContent className="p-8 text-center space-y-4">
          <div className="mx-auto w-14 h-14 rounded-full bg-rose-100 flex items-center justify-center">
            <ShieldAlert size={28} className="text-rose-700" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Access Denied</h1>
            <p className="text-slate-600 mt-1">You don't have permission to view this page.</p>
          </div>
          {code && (
            <Card className="text-left bg-slate-50 border rounded-md p-3 text-sm shadow-none">
              <div><span className="text-slate-500">Required:</span> <span className="font-mono">{code}</span></div>
              <div className="mt-1"><span className="text-slate-500">Your roles:</span> {roles.length ? roles.join(", ") : "—"}</div>
              {reason && <div className="mt-1 text-slate-500 italic">{reason}</div>}
            </Card>
          )}
          <p className="text-xs text-slate-500">
            If you believe this is a mistake, contact your HSE Manager or System Admin to grant the required permission.
          </p>
          <Link
            href="/inbox"
            className="inline-flex items-center gap-2 text-sm text-primary-700 hover:text-primary-900"
          >
            <ArrowLeft size={14} /> Back to my inbox
          </Link>
        </CardContent>
      </Card>
    </div>
  );
}

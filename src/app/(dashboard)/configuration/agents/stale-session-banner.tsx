"use client";

// Surfaced on the AI Agents landing page when the backend reports
// "User not found" — that means the NextAuth session cookie is still
// valid but the User row was wiped from the DB (common pattern: a
// `db:reset` ran after this session was minted). The fix is a fresh
// sign-in. We surface a one-click sign-out instead of leaving the
// raw 401 message visible.

import { signOut } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { LogOut, AlertTriangle } from "lucide-react";
import { Alert } from "@/components/ui/alert";

export function StaleSessionBanner() {
  return (
    <Alert variant="warning" className="rounded-md border border-amber-300 bg-amber-50 p-4 mb-4 flex items-start gap-3">
      <AlertTriangle className="text-amber-600 mt-0.5 flex-shrink-0" size={18} />
      <div className="flex-1 text-sm">
        <p className="font-semibold text-amber-900">Your session is stale</p>
        <p className="text-amber-800 mt-1 text-xs">
          You're signed in, but the backend can't find your user account. This
          usually means the database was reset after you logged in. Sign out
          and sign back in to refresh your session.
        </p>
        <Button
          size="sm"
          variant="outline"
          className="mt-3 border-amber-300 text-amber-900 hover:bg-amber-100"
          onClick={() => signOut({ callbackUrl: "/login" })}
        >
          <LogOut size={12} /> Sign out
        </Button>
      </div>
    </Alert>
  );
}

import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

// The link every notification email points at.
//
// An email link cannot assume a live session — the reader is in Outlook, and
// often enough their cookie has expired. A bare `/cams/audits/<id>` would bounce
// them to the login page, which then drops them on the dashboard having thrown
// away the one destination the email existed to deliver.
//
// `/go?to=/cams/audits/<id>` reads the session and does the right thing either
// way: signed in → straight to the record; signed out → login, and the login
// page carries them the rest of the way via `callbackUrl`. One URL, so the
// backend does not have to know (and could not know) which case applies.

export const dynamic = "force-dynamic";

/**
 * Only same-origin, absolute-path destinations are honoured.
 *
 * Without this, `/go?to=https://evil.example` turns a link the platform sends
 * from its own domain into an open redirect — the classic phishing primitive,
 * and notification emails are exactly where it would be most convincing.
 * `//host` is rejected too: browsers read a protocol-relative URL as off-site.
 */
function safePath(to: string | undefined): string {
  if (!to) return "/inbox";
  let decoded = to;
  try {
    decoded = decodeURIComponent(to);
  } catch {
    return "/inbox";
  }
  if (!decoded.startsWith("/") || decoded.startsWith("//") || decoded.startsWith("/\\")) {
    return "/inbox";
  }
  return decoded;
}

export default async function GoPage(props: {
  searchParams: Promise<{ to?: string }>;
}) {
  const { to } = await props.searchParams;
  const target = safePath(to);
  const session = await getServerSession(authOptions);
  if (!session) {
    redirect(`/login?callbackUrl=${encodeURIComponent(target)}`);
  }
  redirect(target);
}

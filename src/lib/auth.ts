import { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { invalidateUserPermissions } from "./auth/permissions";
import { prisma } from "./prisma";

// Python-only auth. NextAuth is now just the Next.js session manager;
// every login is verified by POSTing to Python's /api/auth/login. There
// is no Prisma fallback — if Python is unreachable, login simply fails.
// This is the contract: the frontend never touches the database, even
// for credentials.
const BACKEND_URL = process.env.BACKEND_URL ?? process.env.NEXT_PUBLIC_BACKEND_URL ?? "";

if (!BACKEND_URL) {
  // Fail loudly at module import time in dev so a misconfigured env is
  // obvious rather than producing mysterious 401s for every user.
  console.error("[auth] BACKEND_URL is unset. Login will return null for every request.");
}

async function authorizeViaBackend(email: string, password: string) {
  // Server-side log lines visible in `npm run dev` terminal — without this,
  // NextAuth's authorize() swallows the failure and the browser only sees a
  // generic 401. With it, you can tell whether Python is unreachable, the
  // user doesn't exist, or the password is wrong.
  const url = `${BACKEND_URL.replace(/\/$/, "")}/api/auth/login`;
  console.log(`[auth] -> ${url}  (email=${email.toLowerCase()})`);
  let r: Response;
  try {
    r = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: email.toLowerCase(), password }),
      cache: "no-store"
    });
  } catch (e: any) {
    console.error(`[auth] backend fetch FAILED (${e?.code ?? ""}): ${e?.message ?? e}`);
    console.error(`[auth] is the Python backend running at ${BACKEND_URL}?`);
    console.error(`[auth] try: curl ${BACKEND_URL.replace(/\/$/, "")}/health`);
    // Thrown error messages are propagated verbatim into signIn()'s res.error
    // (NextAuth v4 callback route encodes error.message into ?error=…). The
    // login page maps these codes to the right toast.
    throw new Error("BACKEND_UNREACHABLE");
  }
  if (!r.ok) {
    const body = await r.text().catch(() => "");
    console.error(`[auth] backend ${url} returned ${r.status}: ${body.slice(0, 300)}`);
    // 404 = no such account, 401 = account exists but wrong password. These
    // map to distinct toasts on the login page. Any other status is treated
    // as a generic credential failure.
    if (r.status === 404) throw new Error("USER_NOT_FOUND");
    if (r.status === 401) throw new Error("INVALID_CREDENTIALS");
    throw new Error("INVALID_CREDENTIALS");
  }
  const j = (await r.json()) as { access_token: string; user: any };
  console.log(`[auth] backend login OK for ${email.toLowerCase()} (id=${j.user.id})`);
  return {
    id: j.user.id,
    email: j.user.email,
    name: j.user.name,
    role: j.user.role,
    plantId: j.user.plantId ?? null,
    plantName: null,
    designation: j.user.designation ?? null,
    backendAccessToken: j.access_token
  } as any;
}

console.log(`[auth] BACKEND_URL=${BACKEND_URL || "(unset — login disabled)"}`);

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" }
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;
        if (!BACKEND_URL) {
          console.error("[auth] cannot authenticate: BACKEND_URL is unset");
          throw new Error("BACKEND_UNREACHABLE");
        }
        // Python is the only authentication path. If Python rejects the
        // credentials or is unreachable, login fails — there is no DB
        // fallback. The frontend has no direct database access.
        return authorizeViaBackend(credentials.email, credentials.password);
      }
    })
  ],
  session: { strategy: "jwt" },
  pages: { signIn: "/login" },
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.role = (user as any).role;
        token.plantId = (user as any).plantId;
        token.designation = (user as any).designation;
        if ((user as any).backendAccessToken) {
          (token as any).backendAccessToken = (user as any).backendAccessToken;
        }
        // Resolve plant name from DB so the header shows the real plant
        // instead of "All Plants" for every user.
        if ((user as any).plantId) {
          try {
            const plant = await prisma.plant.findUnique({
              where: { id: (user as any).plantId },
              select: { name: true },
            });
            token.plantName = plant?.name ?? null;
          } catch {
            token.plantName = null;
          }
        } else {
          token.plantName = null;
        }
        invalidateUserPermissions((user as any).id);
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        (session.user as any).id = token.sub;
        (session.user as any).role = token.role;
        (session.user as any).plantId = token.plantId;
        (session.user as any).plantName = token.plantName;
        (session.user as any).designation = token.designation;
        if ((token as any).backendAccessToken) {
          (session.user as any).backendAccessToken = (token as any).backendAccessToken;
        }
      }
      return session;
    }
  },
  secret: process.env.NEXTAUTH_SECRET
};

export type SessionUser = {
  id: string;
  email: string;
  name: string;
  role: string; // Role.code from the Role master table
  plantId: string | null;
  plantName: string | null;
  designation: string | null;
};

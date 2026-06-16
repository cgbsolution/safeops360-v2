import type { Metadata } from "next";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import "./globals.css";
import { Providers } from "@/components/providers";
import NextTopLoader from "nextjs-toploader";

export const metadata: Metadata = {
  title: "SafeOps360 — EHS Management System",
  description: "Digital EHS Management · Powered by Vizionforge Technologies"
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  // Pre-resolve the session server-side so SessionProvider hydrates with the
  // correct value immediately — no client-side /api/auth/session round-trip
  // on first paint of every navigation.
  const session = await getServerSession(authOptions);

  return (
    <html lang="en">
      <body className="antialiased">
        <NextTopLoader color="#1d4ed8" showSpinner={false} height={3} />
        <Providers session={session}>{children}</Providers>
      </body>
    </html>
  );
}

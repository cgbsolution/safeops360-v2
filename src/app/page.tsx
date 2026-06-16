import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export default async function Home() {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");
  // Inbox is the workflow front door — Dashboard is for executives via the sidebar
  redirect("/inbox");
}

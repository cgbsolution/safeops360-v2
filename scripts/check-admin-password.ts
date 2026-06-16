import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  const u = await prisma.user.findUnique({ where: { email: "admin@safeops360.in" } });
  if (!u) { console.log("admin@safeops360.in not found"); return; }
  const ok = await bcrypt.compare("demo123", u.passwordHash);
  console.log(`admin@safeops360.in / demo123 → passwordOK=${ok}`);
  console.log(`  name=${u.name}  role=${u.role}  plantId=${u.plantId ?? "NULL"}`);
}
main().finally(() => prisma.$disconnect());

import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  const nwPlant = await prisma.plant.findFirst({ where: { code: "NW" } });
  if (!nwPlant) throw new Error("NW plant not found — run seed-all first");

  const password = await bcrypt.hash("demo123", 10);

  const user = await prisma.user.upsert({
    where: { email: "deepak.rawat@cgbindia.com" },
    update: {
      role: "ADMIN",
      designation: "System Administrator",
      department: "IT",
      plantId: nwPlant.id,
      passwordHash: password,
    },
    create: {
      email: "deepak.rawat@cgbindia.com",
      name: "Deepak Rawat",
      passwordHash: password,
      role: "ADMIN",
      designation: "System Administrator",
      department: "IT",
      plantId: nwPlant.id,
    },
  });

  console.log("✅ Dev user upserted:", user.email, "| role:", user.role, "| plant: NW");
  console.log("   Login: deepak.rawat@cgbindia.com / demo123");
}

main()
  .catch(e => { console.error("❌", e); process.exit(1); })
  .finally(() => prisma.$disconnect());

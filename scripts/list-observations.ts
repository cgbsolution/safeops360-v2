import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

(async () => {
  const obs = await prisma.observation.findMany({
    include: {
      observer: { select: { name: true, email: true, department: true } },
      attachments: { select: { id: true, fileName: true, deletedAt: true } }
    },
    orderBy: { createdAt: "desc" }
  });
  for (const o of obs) {
    const att = o.attachments.filter((a) => !a.deletedAt);
    console.log(`${o.number}  status=${o.status}  observer=${o.observer.name} (${o.observer.email}, dept=${o.observer.department})  attachments=${att.length}`);
  }
})()
  .catch(console.error)
  .finally(() => prisma.$disconnect());

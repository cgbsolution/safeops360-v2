import { prisma, fail } from "./db.mjs";
try {
  const users = await prisma.user.findMany({ select:{ id:true,name:true,email:true,role:true,plantId:true,department:true }, orderBy:{ email:'asc' } });
  console.log("USERS:", users.length);
  for (const u of users) console.log(`${u.email}\t${u.name}\t${u.role}\t${u.plantId}\t${u.department||''}`);
} catch(e){ fail(e); } finally { await prisma.$disconnect(); }

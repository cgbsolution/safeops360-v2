import { PrismaClient } from "@prisma/client";
const p = new PrismaClient();
const plants = await p.plant.findMany({ select: { id:true, name:true, code:true } });
console.log("PLANTS:", JSON.stringify(plants));
const users = await p.user.findMany({ select: { id:true, name:true, email:true, role:true, plantId:true, isActive:true }, orderBy:{ email:'asc' } });
console.log("USERS:", users.length);
for (const u of users) console.log(`${u.email} | ${u.name} | ${u.role} | plant=${u.plantId} | active=${u.isActive}`);
await p.$disconnect();

import fs from "node:fs";
import { PrismaClient } from "@prisma/client";
const env = Object.fromEntries(fs.readFileSync(".env","utf8").split(/\r?\n/)
  .filter(l=>l && !l.startsWith("#") && l.includes("="))
  .map(l=>{const i=l.indexOf("="); return [l.slice(0,i).trim(), l.slice(i+1).trim()];}));
export const prisma = new PrismaClient({ datasources:{ db:{ url: env.DATABASE_URL_SYNC } }, log:["error"] });
export function fail(e){ console.error("ERR:", e?.code||"", (e?.message||String(e)).split("\n").slice(0,6).join(" | ")); process.exit(1); }

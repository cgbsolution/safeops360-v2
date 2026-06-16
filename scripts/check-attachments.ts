// Diagnoses why photos aren't showing on an observation detail page.
// Checks: storage env config, DB attachment rows, observation owner.
//
// Run with:  npx tsx scripts/check-attachments.ts SO-2026-LMS-0001
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const number = process.argv[2];
  if (!number) {
    console.log("Usage: npx tsx scripts/check-attachments.ts <observation-number>");
    return;
  }

  console.log(`\n=== Attachment diagnostic for ${number} ===\n`);

  // 1. Storage env
  const supaUrl = process.env.SUPABASE_URL;
  const supaKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const obsBucket = process.env.SUPABASE_OBSERVATION_BUCKET ?? "observation-attachments";
  console.log("Supabase Storage env:");
  console.log(`  SUPABASE_URL:                  ${supaUrl ? "✓ set" : "✗ MISSING"}`);
  console.log(`  SUPABASE_SERVICE_ROLE_KEY:     ${supaKey ? "✓ set" : "✗ MISSING"}`);
  console.log(`  SUPABASE_OBSERVATION_BUCKET:   ${obsBucket}`);
  if (!supaUrl || !supaKey) {
    console.log(`\n⚠️  Storage isn't configured. Photo upload returns 503.`);
    console.log(`   Set the env vars and create the '${obsBucket}' bucket in Supabase.\n`);
  }

  // 2. Observation
  const obs = await prisma.observation.findUnique({
    where: { number },
    include: { observer: true, attachments: { include: { uploadedBy: true } } }
  });
  if (!obs) {
    console.log(`\n✗ Observation ${number} not found.\n`);
    return;
  }

  console.log(`\nObservation:`);
  console.log(`  id:              ${obs.id}`);
  console.log(`  number:          ${obs.number}`);
  console.log(`  status:          ${obs.status}`);
  console.log(`  observer:        ${obs.observer.name} <${obs.observer.email}>`);
  console.log(`  plantId:         ${obs.plantId}`);

  // 3. Attachments
  console.log(`\nAttachments in DB: ${obs.attachments.length}`);
  if (obs.attachments.length === 0) {
    console.log(`\n  → No attachment rows. Upload either never started (storage 503) or`);
    console.log(`    failed before reaching the DB. Check browser network tab on next attempt.`);
  } else {
    for (const a of obs.attachments) {
      const status = a.deletedAt ? "DELETED" : "ACTIVE";
      console.log(`  - [${status}] ${a.category.padEnd(20)} ${a.fileName}`);
      console.log(`      storagePath:  ${a.storagePath}`);
      console.log(`      uploaded by:  ${a.uploadedBy.name}`);
      console.log(`      size:         ${(a.fileSize / 1024).toFixed(1)} KB · ${a.mimeType}`);
    }
    const active = obs.attachments.filter((a) => !a.deletedAt);
    console.log(`\n  Active (visible to UI): ${active.length}`);
    if (active.length === 0) {
      console.log(`  → All attachments are soft-deleted. UI correctly shows none.`);
    }
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());

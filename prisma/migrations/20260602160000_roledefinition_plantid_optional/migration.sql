-- Make RoleDefinition.plantId nullable to allow global role-definition
-- templates (plantId = NULL means "applies to all plants"), matching the
-- schema.prisma declaration (`plantId String?`) and the already-nullable
-- Competency.plantId. Required by prisma/seed-competency-library.ts which
-- seeds global role definitions.

-- AlterTable
ALTER TABLE "RoleDefinition" ALTER COLUMN "plantId" DROP NOT NULL;

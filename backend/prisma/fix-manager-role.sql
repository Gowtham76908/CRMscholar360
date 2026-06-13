-- Safe fix: convert any remaining MANAGER/TEAM_LEAD/AGENT rows to supported roles
UPDATE "User" SET role = 'ADMIN'    WHERE role::text = 'MANAGER';
UPDATE "User" SET role = 'EMPLOYEE' WHERE role::text IN ('TEAM_LEAD', 'AGENT');

-- Rebuild the Role enum only if MANAGER still exists in it
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_enum e
    JOIN pg_type t ON e.enumtypid = t.oid
    WHERE t.typname = 'Role' AND e.enumlabel = 'MANAGER'
  ) THEN
    CREATE TYPE "Role_new" AS ENUM ('SUPER_ADMIN', 'ADMIN', 'EMPLOYEE');

    -- Drop defaults before type change
    ALTER TABLE "User"       ALTER COLUMN role DROP DEFAULT;
    ALTER TABLE "Permission" ALTER COLUMN role DROP DEFAULT;

    ALTER TABLE "User"       ALTER COLUMN role TYPE "Role_new" USING role::text::"Role_new";
    ALTER TABLE "Permission" ALTER COLUMN role TYPE "Role_new" USING role::text::"Role_new";

    DROP TYPE "Role";
    ALTER TYPE "Role_new" RENAME TO "Role";

    -- Restore defaults with the renamed type
    ALTER TABLE "User"       ALTER COLUMN role SET DEFAULT 'EMPLOYEE'::"Role";
    ALTER TABLE "Permission" ALTER COLUMN role SET DEFAULT 'EMPLOYEE'::"Role";

    RAISE NOTICE 'Role enum rebuilt successfully';
  ELSE
    RAISE NOTICE 'Role enum already up to date — only data migration needed';
  END IF;
END $$;

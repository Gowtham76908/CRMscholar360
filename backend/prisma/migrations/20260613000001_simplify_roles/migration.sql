-- Migrate existing users with removed roles
UPDATE "User" SET role = 'ADMIN'    WHERE role = 'MANAGER';
UPDATE "User" SET role = 'EMPLOYEE' WHERE role IN ('TEAM_LEAD', 'AGENT');

-- Rebuild the Role enum with only 3 values
CREATE TYPE "Role_new" AS ENUM ('SUPER_ADMIN', 'ADMIN', 'EMPLOYEE');

ALTER TABLE "User"       ALTER COLUMN role TYPE "Role_new" USING role::text::"Role_new";
ALTER TABLE "Permission" ALTER COLUMN role TYPE "Role_new" USING role::text::"Role_new";

DROP TYPE "Role";
ALTER TYPE "Role_new" RENAME TO "Role";

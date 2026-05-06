-- Add index on User.phoneNormalized for exact-match webhook lookups
CREATE INDEX IF NOT EXISTS "User_phoneNormalized_idx" ON "User"("phoneNormalized");

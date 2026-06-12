-- CreateTable: ChatChannel
CREATE TABLE IF NOT EXISTS "ChatChannel" (
    "id"          TEXT NOT NULL,
    "name"        TEXT,
    "type"        TEXT NOT NULL DEFAULT 'team',
    "createdById" TEXT NOT NULL,
    "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ChatChannel_pkey" PRIMARY KEY ("id")
);

-- CreateTable: ChatMember
CREATE TABLE IF NOT EXISTS "ChatMember" (
    "id"        TEXT NOT NULL,
    "channelId" TEXT NOT NULL,
    "userId"    TEXT NOT NULL,
    "role"      TEXT NOT NULL DEFAULT 'member',
    "joinedAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ChatMember_pkey" PRIMARY KEY ("id")
);

-- CreateTable: ChatMessage
CREATE TABLE IF NOT EXISTS "ChatMessage" (
    "id"        TEXT NOT NULL,
    "channelId" TEXT NOT NULL,
    "authorId"  TEXT NOT NULL,
    "text"      TEXT NOT NULL,
    "parentId"  TEXT,
    "reactions" JSONB NOT NULL DEFAULT '{}',
    "editedAt"  TIMESTAMP(3),
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ChatMessage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "ChatChannel_createdById_idx" ON "ChatChannel"("createdById");
CREATE UNIQUE INDEX IF NOT EXISTS "ChatMember_channelId_userId_key" ON "ChatMember"("channelId", "userId");
CREATE INDEX IF NOT EXISTS "ChatMember_channelId_idx" ON "ChatMember"("channelId");
CREATE INDEX IF NOT EXISTS "ChatMember_userId_idx" ON "ChatMember"("userId");
CREATE INDEX IF NOT EXISTS "ChatMessage_channelId_createdAt_idx" ON "ChatMessage"("channelId", "createdAt");
CREATE INDEX IF NOT EXISTS "ChatMessage_authorId_idx" ON "ChatMessage"("authorId");
CREATE INDEX IF NOT EXISTS "ChatMessage_parentId_idx" ON "ChatMessage"("parentId");

-- AddForeignKey (idempotent)
DO $$ BEGIN
  ALTER TABLE "ChatChannel" ADD CONSTRAINT "ChatChannel_createdById_fkey"
      FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "ChatMember" ADD CONSTRAINT "ChatMember_channelId_fkey"
      FOREIGN KEY ("channelId") REFERENCES "ChatChannel"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "ChatMember" ADD CONSTRAINT "ChatMember_userId_fkey"
      FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "ChatMessage" ADD CONSTRAINT "ChatMessage_channelId_fkey"
      FOREIGN KEY ("channelId") REFERENCES "ChatChannel"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "ChatMessage" ADD CONSTRAINT "ChatMessage_authorId_fkey"
      FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "ChatMessage" ADD CONSTRAINT "ChatMessage_parentId_fkey"
      FOREIGN KEY ("parentId") REFERENCES "ChatMessage"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

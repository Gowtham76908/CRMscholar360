-- CreateTable
CREATE TABLE IF NOT EXISTS "Notification" (
    "id"        TEXT         NOT NULL,
    "userId"    TEXT         NOT NULL,
    "title"     TEXT         NOT NULL,
    "message"   TEXT         NOT NULL,
    "type"      TEXT         NOT NULL,
    "isRead"    BOOLEAN      NOT NULL DEFAULT false,
    "link"      TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Notification_userId_isRead_idx" ON "Notification"("userId", "isRead");

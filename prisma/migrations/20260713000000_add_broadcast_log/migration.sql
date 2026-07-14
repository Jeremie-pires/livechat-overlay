-- CreateTable
CREATE TABLE "BroadcastLog" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "runId" TEXT NOT NULL,
    "guildId" TEXT NOT NULL,
    "channelId" TEXT,
    "status" TEXT NOT NULL,
    "errorCode" TEXT,
    "errorReason" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateIndex
CREATE INDEX "BroadcastLog_runId_idx" ON "BroadcastLog"("runId");

-- CreateIndex
CREATE INDEX "BroadcastLog_guildId_idx" ON "BroadcastLog"("guildId");

-- CreateIndex
CREATE INDEX "BroadcastLog_status_idx" ON "BroadcastLog"("status");

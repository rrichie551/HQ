-- CreateTable
CREATE TABLE "Agent" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "icon" TEXT NOT NULL,
    "color" TEXT NOT NULL DEFAULT '#C0603C',
    "tint" TEXT NOT NULL DEFAULT '#F6E9E2',
    "status" TEXT NOT NULL DEFAULT 'idle',
    "lastActionAt" DATETIME,
    "uptimeSince" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "Event" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "agentId" TEXT NOT NULL,
    "actionType" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "metadata" TEXT,
    "minutesSaved" REAL NOT NULL DEFAULT 0,
    "revenueEvent" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Event_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "Agent" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Draft" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "agentId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "originalMessage" TEXT NOT NULL,
    "draftText" TEXT NOT NULL,
    "editedText" TEXT,
    "priority" TEXT NOT NULL DEFAULT 'MED',
    "channel" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "approvedAt" DATETIME,
    "approvedBy" TEXT,
    "slackMessageTs" TEXT,
    "slackChannelId" TEXT,
    "sentAt" DATETIME,
    "metadata" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Draft_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "Agent" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AgentComm" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "fromAgentId" TEXT NOT NULL,
    "toAgentId" TEXT NOT NULL,
    "topic" TEXT NOT NULL,
    "question" TEXT NOT NULL,
    "answer" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AgentComm_fromAgentId_fkey" FOREIGN KEY ("fromAgentId") REFERENCES "Agent" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "AgentComm_toAgentId_fkey" FOREIGN KEY ("toAgentId") REFERENCES "Agent" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "MemorySnapshot" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "memoryMdChars" INTEGER NOT NULL,
    "memoryMdLimit" INTEGER NOT NULL DEFAULT 4000,
    "userMdChars" INTEGER NOT NULL,
    "userMdLimit" INTEGER NOT NULL DEFAULT 1375,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "WeeklyMetrics" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "weekStart" DATETIME NOT NULL,
    "messagesHandled" INTEGER NOT NULL DEFAULT 0,
    "draftsCreated" INTEGER NOT NULL DEFAULT 0,
    "approvalsCompleted" INTEGER NOT NULL DEFAULT 0,
    "avgResponseSecs" REAL NOT NULL DEFAULT 0,
    "minutesSaved" REAL NOT NULL DEFAULT 0,
    "revenueEvents" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateIndex
CREATE UNIQUE INDEX "Agent_slug_key" ON "Agent"("slug");

-- CreateIndex
CREATE INDEX "Event_agentId_idx" ON "Event"("agentId");

-- CreateIndex
CREATE INDEX "Event_actionType_idx" ON "Event"("actionType");

-- CreateIndex
CREATE INDEX "Event_createdAt_idx" ON "Event"("createdAt");

-- CreateIndex
CREATE INDEX "Draft_status_idx" ON "Draft"("status");

-- CreateIndex
CREATE INDEX "Draft_createdAt_idx" ON "Draft"("createdAt");

-- CreateIndex
CREATE INDEX "AgentComm_createdAt_idx" ON "AgentComm"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "WeeklyMetrics_weekStart_key" ON "WeeklyMetrics"("weekStart");

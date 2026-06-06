-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Agent" (
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
    "schedule" TEXT,
    "task" TEXT,
    "skill" TEXT,
    "cronId" TEXT,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "requiresApproval" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
INSERT INTO "new_Agent" ("color", "createdAt", "cronId", "enabled", "icon", "id", "lastActionAt", "name", "role", "schedule", "skill", "slug", "status", "task", "tint", "uptimeSince") SELECT "color", "createdAt", "cronId", "enabled", "icon", "id", "lastActionAt", "name", "role", "schedule", "skill", "slug", "status", "task", "tint", "uptimeSince" FROM "Agent";
DROP TABLE "Agent";
ALTER TABLE "new_Agent" RENAME TO "Agent";
CREATE UNIQUE INDEX "Agent_slug_key" ON "Agent"("slug");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

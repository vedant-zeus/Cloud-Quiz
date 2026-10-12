-- CreateEnum
CREATE TYPE "SessionStatus" AS ENUM ('WAITING', 'QUESTION_ACTIVE', 'QUESTION_CLOSED', 'COMPLETED');

-- AlterTable
ALTER TABLE "quiz_sessions" DROP COLUMN "status",
ADD COLUMN     "status" "SessionStatus" NOT NULL DEFAULT 'WAITING';

-- CreateIndex
CREATE UNIQUE INDEX "participants_sessionId_displayName_key" ON "participants"("sessionId", "displayName");

-- CreateIndex
CREATE INDEX "quiz_sessions_roomCode_idx" ON "quiz_sessions"("roomCode");

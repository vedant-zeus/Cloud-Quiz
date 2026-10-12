-- AlterTable
ALTER TABLE "quiz_sessions" ADD COLUMN "startedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "answers" ADD COLUMN "responseTimeMs" INTEGER;

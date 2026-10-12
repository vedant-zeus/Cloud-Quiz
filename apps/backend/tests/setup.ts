import { beforeAll, afterAll } from 'vitest';
import { prisma } from '../src/config/prisma.js';

beforeAll(async () => {
  // Clear any existing test data in clean order
  await cleanDatabase();
});

afterAll(async () => {
  await cleanDatabase();
  await prisma.$disconnect();
});

export async function cleanDatabase(): Promise<void> {
  const tablenames = ['answers', 'participants', 'quiz_sessions', 'questions', 'quizzes', 'users'];
  for (const table of tablenames) {
    try {
      await prisma.$executeRawUnsafe(`TRUNCATE TABLE "${table}" CASCADE;`);
    } catch {
      // Ignore if table doesn't exist yet
    }
  }
}

import http from 'http';
import { app } from './app.js';
import { env } from './config/env.js';
import { connectDatabase, disconnectDatabase } from './config/prisma.js';
import { initSocketServer } from './socket/socketServer.js';
import { sessionService } from './services/sessionService.js';
import { timerManager } from './socket/timerManager.js';

let server: http.Server | null = null;

async function startServer(): Promise<void> {
  try {
    // Ensure database connection is established
    await connectDatabase();
    console.log('✅ Connected to PostgreSQL database');

    // Create single HTTP server and attach Socket.IO
    server = http.createServer(app);
    initSocketServer(server);

    // Reconcile any active session timers from before restart
    await sessionService.reconcileActiveSessionsOnStartup();

    server.listen(env.PORT, '0.0.0.0', () => {
      console.log(`🚀 CloudQuiz API running in ${env.NODE_ENV} mode on port ${env.PORT} (0.0.0.0)`);
      console.log(`📍 Health checks: http://0.0.0.0:${env.PORT}${env.API_PREFIX}/health`);
    });

    const handleShutdown = async (signal: string) => {
      console.log(`\n🛑 Received ${signal}. Gracefully shutting down...`);
      timerManager.clearAllTimers();
      if (server) {
        server.close(async () => {
          console.log('🔌 HTTP server closed.');
          await disconnectDatabase();
          console.log('🗄️ Database disconnected.');
          process.exit(0);
        });
      } else {
        await disconnectDatabase();
        process.exit(0);
      }
    };

    process.on('SIGTERM', () => handleShutdown('SIGTERM'));
    process.on('SIGINT', () => handleShutdown('SIGINT'));
  } catch (error) {
    console.error('❌ Failed to start CloudQuiz server:', error);
    timerManager.clearAllTimers();
    await disconnectDatabase().catch(() => {});
    process.exit(1);
  }
}

startServer();

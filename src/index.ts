import Fastify from 'fastify';
import cors from '@fastify/cors';
import { config } from './config';
import { webhookHandler } from './handlers/webhook.handler';
import { reminderWorker } from './workers/reminder.worker';
import { databaseService } from './services/database.service';
import { redisService } from './services/memory-session.service';
import { timeslotInitService } from './services/timeslot-init.service';

const fastify = Fastify({
  logger: {
    level: config.server.nodeEnv === 'production' ? 'warn' : 'info',
  },
});

async function start() {
  try {
    await fastify.register(cors, {
      origin: true,
      methods: ['GET', 'POST'],
    });

    fastify.setErrorHandler((error, request, reply) => {
      fastify.log.error(error);
      reply.status(500).send({
        error: 'Internal Server Error',
        message: config.server.nodeEnv === 'production' 
          ? 'Something went wrong' 
          : error.message,
      });
    });

    fastify.get('/health', async (request, reply) => {
      const dbHealth = await databaseService.healthCheck();
      const redisHealth = await redisService.healthCheck();

      return { 
        status: 'ok', 
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        database: dbHealth ? 'connected' : 'disconnected',
        redis: redisHealth ? 'connected' : 'disconnected',
      };
    });

    fastify.post('/webhook', webhookHandler);

    // データベース初期化とタイムスロット作成
    await databaseService.initialize();
    await timeslotInitService.initializeTimeSlots();
    console.log('Database and time slots initialized');

    reminderWorker.start();

    const port = parseInt(process.env.PORT || '3000', 10);
    const address = await fastify.listen({
      port: port,
      host: '0.0.0.0',
    });

    fastify.log.info(`Server listening at ${address}`);
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
}

process.on('SIGTERM', async () => {
  console.log('Received SIGTERM, shutting down gracefully...');
  reminderWorker.stop();
  await databaseService.close();
  await redisService.disconnect();
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('Received SIGINT, shutting down gracefully...');
  reminderWorker.stop();
  await databaseService.close();
  await redisService.disconnect();
  process.exit(0);
});

if (require.main === module) {
  start();
}

export default fastify;
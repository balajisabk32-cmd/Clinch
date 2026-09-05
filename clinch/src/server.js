const app = require('./app');
const config = require('./config/env');
const prisma = require('./config/db');

const server = app.listen(config.port, () => {
  console.log(`=========================================`);
  console.log(`🚀 DealFlow360 Backend API Server Running`);
  console.log(`📡 Environment : ${config.nodeEnv}`);
  console.log(`🌐 Port        : ${config.port}`);
  console.log(`🩺 Healthcheck : http://localhost:${config.port}/health`);
  console.log(`=========================================`);
});

// Graceful shutdown handling
const shutdown = async (signal) => {
  console.log(`\nReceived ${signal}. Shutting down gracefully...`);
  server.close(async () => {
    try {
      await prisma.$disconnect();
      console.log('Prisma disconnected. Server closed cleanly.');
      process.exit(0);
    } catch (err) {
      console.error('Error during shutdown:', err);
      process.exit(1);
    }
  });
};

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));

module.exports = server;

import 'dotenv/config';
import app from './app';
import { testConnection } from './database/connection';
import { logger } from './utils/logger';

const PORT = parseInt(process.env.PORT || '5000', 10);

async function bootstrap() {
  await testConnection();

  app.listen(PORT, () => {
    logger.info(`🚀  Server running on port ${PORT} [${process.env.NODE_ENV}]`);
  });
}

bootstrap().catch((err) => {
  logger.error('Fatal startup error', err);
  process.exit(1);
});

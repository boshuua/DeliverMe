import dotenv from 'dotenv';
import path from 'path';

dotenv.config();

export const config = {
  port: parseInt(process.env.PORT || '5000', 10),
  databaseUrl: process.env.DATABASE_URL || 'postgresql://postgres@localhost:5432/delivery_app',
  jwtSecret: process.env.JWT_SECRET || 'deliverme-super-secure-jwt-key-change-in-production-2026',
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '8h',
  storageDir: path.resolve(process.cwd(), process.env.STORAGE_DIR || './uploads'),
  corsOrigin: process.env.CORS_ORIGIN || 'http://localhost:4200',
};

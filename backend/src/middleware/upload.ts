import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { randomUUID } from 'crypto';
import { config } from '../config/index.js';

// Ensure upload directory exists
const uploadDir = path.join(config.storageDir, 'pod');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, uploadDir);
  },
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase() || '.png';
    const uniqueName = `${Date.now()}-${randomUUID()}${ext}`;
    cb(null, uniqueName);
  },
});

const allowedMimes = ['image/jpeg', 'image/png', 'image/webp'];

export const podUpload = multer({
  storage,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10 MB limit
  },
  fileFilter: (_req, file, cb) => {
    if (allowedMimes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error(`Invalid file type: ${file.mimetype}. Allowed types: JPEG, PNG, WEBP.`));
    }
  },
});

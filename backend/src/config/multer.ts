import path from 'path';
import os from 'os';
import type { Request } from 'express';
import multer from 'multer';
import { ApiError } from '../utils/ApiError';

const ALLOWED_MIME_TYPES = new Set(['text/csv', 'application/vnd.ms-excel']);

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, os.tmpdir());
  },
  filename: (_req, _file, cb) => {
    cb(null, `${crypto.randomUUID()}.csv`);
  }
});

const fileFilter: multer.Options['fileFilter'] = (_req: Request, file, cb) => {
  const ext = path.extname(file.originalname || '').toLowerCase();
  const mimeType = (file.mimetype || '').toLowerCase();

  if (ALLOWED_MIME_TYPES.has(mimeType) || ext === '.csv') {
    cb(null, true);
    return;
  }

  cb(new ApiError(400, 'Only CSV files are allowed'));
};

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter
}).single('file');

export const csvUpload: import('express').RequestHandler = (req, res, next) => {
  upload(req, res, (error?: unknown) => {
    if (!error) {
      next();
      return;
    }

    if (error instanceof multer.MulterError && error.code === 'LIMIT_FILE_SIZE') {
      next(new ApiError(400, 'File size exceeds 5MB limit'));
      return;
    }

    next(error);
  });
};

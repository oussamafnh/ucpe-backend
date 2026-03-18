import { Request, Response } from 'express';
import { asyncHandler }         from '../utils/asyncHandler';

export const uploadFiles = asyncHandler(async (req: Request, res: Response) => {
  if (!req.files || !(req.files as Express.Multer.File[]).length) {
    res.status(400).json({ success: false, message: 'No files uploaded' });
    return;
  }

  const files = (req.files as Express.Multer.File[]).map((f) => ({
    filename:   f.filename,
    originalName: f.originalname,
    mimetype:   f.mimetype,
    size:       f.size,
    url:        `/uploads/${f.filename}`,
  }));

  res.status(201).json({ success: true, data: files });
});
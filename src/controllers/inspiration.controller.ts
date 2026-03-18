import { Request, Response } from 'express';
import { asyncHandler }      from '../utils/asyncHandler';
import { InspirationModel }  from '../models/inspiration.model';
import fs                    from 'fs';
import path                  from 'path';

// GET /api/inspiration — public
export const listInspirations = asyncHandler(async (_req: Request, res: Response) => {
  const items = await InspirationModel.findAll();
  res.json({ success: true, data: items });
});

// POST /api/inspiration — admin only
// Expects multipart/form-data with field "images" (one or more files)
export const addInspirations = asyncHandler(async (req: Request, res: Response) => {
  if (!req.files || !(req.files as Express.Multer.File[]).length) {
    res.status(400).json({ success: false, message: 'No files uploaded' });
    return;
  }

  const alt = typeof req.body.alt === 'string' ? req.body.alt : null;

  const created = await Promise.all(
    (req.files as Express.Multer.File[]).map(async (f) => {
      const insertId = await InspirationModel.create({
        url:      `/uploads/${f.filename}`,
        filename: f.filename,
        alt:      alt ?? f.originalname,
      });
      return InspirationModel.findById(insertId);
    })
  );

  res.status(201).json({ success: true, data: created });
});

// DELETE /api/inspiration/:id — admin only
export const deleteInspiration = asyncHandler(async (req: Request, res: Response) => {
  const id = Number((req.params.id as string));

  const item = await InspirationModel.findById(id);
  if (!item) {
    res.status(404).json({ success: false, message: 'Not found' });
    return;
  }

  // Remove physical file from disk
  const filePath = path.join(__dirname, '../../public', item.url);
  if (fs.existsSync(filePath)) fs.unlinkSync(filePath);

  await InspirationModel.delete(id);
  res.json({ success: true, message: 'Deleted' });
});

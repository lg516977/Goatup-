import { Router, type Request, type Response } from "express";
import { requireAuth } from "../lib/auth";
import { upload } from "../lib/upload";

const router = Router();

// POST /api/files/upload
router.post(
  "/files/upload",
  requireAuth,
  upload.single("file"),
  async (req: Request, res: Response): Promise<void> => {
    if (!req.file) {
      res.status(400).json({ error: "No file provided" });
      return;
    }

    const url = `/api/uploads/${req.file.filename}`;
    res.status(201).json({ url });
  }
);

export default router;

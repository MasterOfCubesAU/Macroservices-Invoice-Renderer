import { Request, Response } from "express";
import express from "express";

const router = express.Router();

router.get("/", (req: Request, res: Response) => {
  res.json({ "status": "Running!" });
});

export default router;

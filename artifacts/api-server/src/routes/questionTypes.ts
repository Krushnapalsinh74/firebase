import { Router } from "express";
import { db } from "@workspace/db";
import { questionTypesTable } from "@workspace/db";
import { requireAuth } from "../lib/auth.js";

const router = Router();

router.get("/question-types", requireAuth, async (req, res) => {
  try {
    const types = await db.select().from(questionTypesTable).orderBy(questionTypesTable.name);
    res.json(types);
  } catch (err) {
    req.log.error({ err }, "List question types error");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;

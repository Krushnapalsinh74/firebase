import { Router } from "express";
import { db, sqlite } from "@workspace/db";
import {
  questionsTable, subjectsTable, chaptersTable, topicsTable,
  boardsTable, standardsTable, aiProvidersTable, papersTable,
  generationJobsTable, activityLogsTable,
} from "@workspace/db";
import { count, sql, avg, gte, and } from "drizzle-orm";
import { requireAuth } from "../lib/auth.js";

const router = Router();

router.get("/analytics/dashboard", requireAuth, async (req, res) => {
  try {
    const [{ totalQuestions }] = await db.select({ totalQuestions: count() }).from(questionsTable);
    const [{ totalSubjects }] = await db.select({ totalSubjects: count() }).from(subjectsTable);
    const [{ totalChapters }] = await db.select({ totalChapters: count() }).from(chaptersTable);
    const [{ totalTopics }] = await db.select({ totalTopics: count() }).from(topicsTable);
    const [{ totalBoards }] = await db.select({ totalBoards: count() }).from(boardsTable);
    const [{ totalStandards }] = await db.select({ totalStandards: count() }).from(standardsTable);
    const [{ activeProviders }] = await db.select({ activeProviders: count() }).from(aiProvidersTable);
    const [{ totalPapers }] = await db.select({ totalPapers: count() }).from(papersTable);

    const today = new Date(); today.setHours(0, 0, 0, 0);
    const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);

    const [{ questionsToday }] = await db.select({ questionsToday: count() })
      .from(questionsTable).where(gte(questionsTable.generatedAt, today));
    const [{ questionsThisMonth }] = await db.select({ questionsThisMonth: count() })
      .from(questionsTable).where(gte(questionsTable.generatedAt, monthStart));

    const [{ avgQualityScore }] = await db.select({ avgQualityScore: avg(questionsTable.qualityScore) }).from(questionsTable);

    const [{ totalJobsRunning }] = await db.select({ totalJobsRunning: count() })
      .from(generationJobsTable).where(sql`${generationJobsTable.status} IN ('pending', 'processing')`);
      
    const [{ totalInputTokens, totalOutputTokens, totalCost }] = await db.select({
      totalInputTokens: sql<number>`SUM(${generationJobsTable.inputTokens})`,
      totalOutputTokens: sql<number>`SUM(${generationJobsTable.outputTokens})`,
      totalCost: sql<number>`SUM(${generationJobsTable.totalCostInr})`
    }).from(generationJobsTable);

    res.json({
      totalQuestions: Number(totalQuestions),
      totalSubjects: Number(totalSubjects),
      totalChapters: Number(totalChapters),
      totalTopics: Number(totalTopics),
      questionsToday: Number(questionsToday),
      questionsThisMonth: Number(questionsThisMonth),
      totalBoards: Number(totalBoards),
      totalStandards: Number(totalStandards),
      activeProviders: Number(activeProviders),
      totalPapers: Number(totalPapers),
      avgQualityScore: parseFloat(String(avgQualityScore ?? 0)),
      totalJobsRunning: Number(totalJobsRunning),
      totalInputTokens: Number(totalInputTokens ?? 0),
      totalOutputTokens: Number(totalOutputTokens ?? 0),
      totalCostInr: parseFloat(String(totalCost ?? 0)),
    });
  } catch (err) {
    req.log.error({ err }, "Dashboard stats error");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/analytics/questions-by-subject", requireAuth, async (req, res) => {
  try {
    const rows = await db
      .select({ subjectName: subjectsTable.name, count: count() })
      .from(questionsTable)
      .leftJoin(subjectsTable, sql`${questionsTable.subjectId} = ${subjectsTable.id}`)
      .groupBy(subjectsTable.name)
      .orderBy(sql`count(*) DESC`)
      .limit(10);
    res.json(rows.map(r => ({ subjectName: r.subjectName ?? "Unknown", count: Number(r.count) })));
  } catch (err) {
    req.log.error({ err }, "Questions by subject error");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/analytics/questions-by-difficulty", requireAuth, async (req, res) => {
  try {
    const rows = await db
      .select({ difficulty: questionsTable.difficulty, count: count() })
      .from(questionsTable)
      .groupBy(questionsTable.difficulty)
      .orderBy(questionsTable.difficulty);
    res.json(rows.map(r => ({ difficulty: r.difficulty, count: Number(r.count) })));
  } catch (err) {
    req.log.error({ err }, "Questions by difficulty error");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/analytics/model-usage", requireAuth, async (req, res) => {
  try {
    const rows = await db
      .select({
        model: questionsTable.modelUsed,
        count: count(),
        avgQualityScore: avg(questionsTable.qualityScore),
      })
      .from(questionsTable)
      .where(sql`${questionsTable.modelUsed} IS NOT NULL`)
      .groupBy(questionsTable.modelUsed)
      .orderBy(sql`count(*) DESC`)
      .limit(10);
    res.json(rows.map(r => ({
      model: r.model ?? "Unknown",
      provider: "github_models",
      count: Number(r.count),
      avgQualityScore: parseFloat(String(r.avgQualityScore ?? 0)),
    })));
  } catch (err) {
    req.log.error({ err }, "Model usage error");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/analytics/recent-activity", requireAuth, async (req, res) => {
  try {
    const limit = Math.min(50, parseInt((req.query["limit"] as string) ?? "10"));
    const logs = await db.select().from(activityLogsTable).orderBy(sql`${activityLogsTable.createdAt} DESC`).limit(limit);
    res.json(logs.map(l => ({
      id: l.id,
      jobId: l.jobId,
      action: l.action,
      description: l.description,
      questionsGenerated: l.questionsGenerated,
      model: l.model,
      createdAt: l.createdAt,
    })));
  } catch (err) {
    req.log.error({ err }, "Recent activity error");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/analytics/monthly-report", requireAuth, async (req, res) => {
  try {
    const result = await sqlite.execute(`
      SELECT
        CAST(strftime('%m', generated_at / 1000, 'unixepoch') AS INTEGER) AS month,
        CAST(strftime('%Y', generated_at / 1000, 'unixepoch') AS INTEGER) AS year,
        COUNT(*) AS count,
        ROUND(AVG(quality_score), 2) AS avg_quality_score
      FROM questions
      WHERE generated_at >= (strftime('%s', 'now', '-12 months') * 1000)
      GROUP BY month, year
      ORDER BY year, month
    `);
    const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    res.json(result.rows.map((row: any) => ({
      month: Number(row.month),
      year: Number(row.year),
      label: `${months[Number(row.month) - 1]} ${row.year}`,
      count: Number(row.count),
      avgQualityScore: parseFloat(String(row.avg_quality_score ?? 0)),
    })));
  } catch (err) {
    req.log.error({ err }, "Monthly report error");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/analytics/topic-coverage", requireAuth, async (req, res) => {
  try {
    const result = await sqlite.execute(`
      SELECT
        t.id            AS topic_id,
        t.name          AS topic_name,
        c.name          AS chapter_name,
        s.name          AS subject_name,
        COUNT(q.id)     AS total,
        SUM(CASE WHEN q.difficulty = 'easy'     THEN 1 ELSE 0 END) AS easy,
        SUM(CASE WHEN q.difficulty = 'medium'   THEN 1 ELSE 0 END) AS medium,
        SUM(CASE WHEN q.difficulty = 'hard'     THEN 1 ELSE 0 END) AS hard,
        SUM(CASE WHEN q.difficulty = 'advanced' THEN 1 ELSE 0 END) AS advanced,
        ROUND(AVG(q.quality_score), 2) AS avg_quality
      FROM topics t
      LEFT JOIN chapters  c ON c.id = t.chapter_id
      LEFT JOIN subjects  s ON s.id = c.subject_id
      LEFT JOIN questions q ON q.topic_id = t.id
      WHERE t.is_active = 1
      GROUP BY t.id, t.name, c.name, s.name
      ORDER BY total DESC, t.name
    `);
    res.json(result.rows.map((row: any) => ({
      topicId:     Number(row.topic_id),
      topicName:   String(row.topic_name ?? ""),
      chapterName: String(row.chapter_name ?? ""),
      subjectName: String(row.subject_name ?? ""),
      total:       Number(row.total),
      easy:        Number(row.easy),
      medium:      Number(row.medium),
      hard:        Number(row.hard),
      advanced:    Number(row.advanced),
      avgQuality:  parseFloat(String(row.avg_quality ?? "0")),
    })));
  } catch (err) {
    req.log.error({ err }, "Topic coverage error");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/analytics/quality-distribution", requireAuth, async (req, res) => {
  try {
    const result = await sqlite.execute(`
      SELECT
        CASE
          WHEN quality_score >= 0.9  THEN 'Excellent (0.9–1.0)'
          WHEN quality_score >= 0.75 THEN 'Good (0.75–0.9)'
          WHEN quality_score >= 0.5  THEN 'Fair (0.5–0.75)'
          ELSE                            'Poor (<0.5)'
        END AS band,
        CASE
          WHEN quality_score >= 0.9  THEN 1
          WHEN quality_score >= 0.75 THEN 2
          WHEN quality_score >= 0.5  THEN 3
          ELSE                            4
        END AS sort_order,
        COUNT(*) AS count
      FROM questions
      GROUP BY band, sort_order
      ORDER BY sort_order
    `);
    res.json(result.rows.map((row: any) => ({
      band: String(row.band),
      count: Number(row.count)
    })));
  } catch (err) {
    req.log.error({ err }, "Quality distribution error");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;

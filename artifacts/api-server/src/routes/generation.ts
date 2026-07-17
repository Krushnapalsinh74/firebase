/**
 * generation.ts — API Endpoints for Question Generation
 */

import { Router } from "express";
import { db } from "@workspace/db";
import {
  generationJobsTable, questionsTable, aiProvidersTable,
  topicsTable, chaptersTable, subjectsTable, boardsTable,
  standardsTable, activityLogsTable,
} from "@workspace/db";
import { eq, count, desc } from "drizzle-orm";
import { requireAuth, simpleDecrypt } from "../lib/auth.js";
import { randomUUID } from "crypto";
import { runJEEPipeline, GenerationRequest, QUALITY, isJeeGenerationAllowedContext } from "../lib/pipeline.js";

const router = Router();
const activeControllers = new Map<string, AbortController>();

// ═══════════════════════════════════════════════════════════════════════════════
// ROUTES (API-compatible)
// ═══════════════════════════════════════════════════════════════════════════════

router.post("/generation/start", requireAuth, async (req, res) => {
  try {
    const params = req.body as GenerationRequest;
    const jobId = randomUUID();

    const boardIdNum = typeof params.boardId === "number" ? params.boardId : parseInt(params.boardId);
    const standardIdNum = typeof params.standardId === "number" ? params.standardId : parseInt(params.standardId);
    const subjectIdNum = typeof params.subjectId === "number" ? params.subjectId : parseInt(params.subjectId);
    const chapterIdNum = typeof params.chapterId === "number" ? params.chapterId : parseInt(params.chapterId);
    const topicIdNum = typeof params.topicId === "number" ? params.topicId : parseInt(params.topicId);
    const providerIdNum = typeof params.providerId === "number" ? params.providerId : parseInt(params.providerId);

    const [topic]    = await db.select().from(topicsTable).where(eq(topicsTable.id, topicIdNum)).limit(1);
    const [chapter]  = await db.select().from(chaptersTable).where(eq(chaptersTable.id, chapterIdNum)).limit(1);
    const [subject]  = await db.select().from(subjectsTable).where(eq(subjectsTable.id, subjectIdNum)).limit(1);
    const [board]    = await db.select().from(boardsTable).where(eq(boardsTable.id, boardIdNum)).limit(1);
    const [standard] = await db.select().from(standardsTable).where(eq(standardsTable.id, standardIdNum)).limit(1);
    const [provider] = await db.select().from(aiProvidersTable).where(eq(aiProvidersTable.id, providerIdNum)).limit(1);

    if (!provider) { res.status(400).json({ error: "AI provider not found" }); return; }
    if (params.jeeAdvancedOnly) {
      if (!isJeeGenerationAllowedContext({
        topicName: topic?.name ?? "",
        chapterName: chapter?.name ?? "",
        subjectName: subject?.name ?? "",
      })) {
        res.status(400).json({
          error: "Off-syllabus request: JEE Advanced generation is limited to Physics, Chemistry, and Mathematics topics.",
        });
        return;
      }
    }

    await db.insert(generationJobsTable).values({
      jobId, status: "pending",
      totalRequested: params.count,
      boardId: boardIdNum, standardId: standardIdNum,
      subjectId: subjectIdNum, chapterId: chapterIdNum, topicId: topicIdNum,
      topicName: topic?.name ?? "Unknown",
      subjectName: subject?.name ?? "Unknown",
      chapterName: chapter?.name ?? "Unknown",
      questionType: params.questionType,
      difficulty: params.difficulty,
      providerId: providerIdNum,
      model: params.model,
      requestParams: params,
    });

    res.status(202).json({ jobId, status: "pending", totalRequested: params.count, createdAt: new Date() });

    setImmediate(async () => {
      try {
        await db.update(generationJobsTable).set({ status: "processing" }).where(eq(generationJobsTable.jobId, jobId));

        const token = simpleDecrypt(provider.encryptedToken);
        const ctx = {
          topicName:   topic?.name ?? "Topic",
          chapterName: chapter?.name ?? "Chapter",
          subjectName: subject?.name ?? "Subject",
          boardName:   board?.name ?? "Board",
          standardName: standard?.name ?? "Standard",
        };

        const controller = new AbortController();
        activeControllers.set(jobId, controller);

        const { results, agentLog, inputTokens, outputTokens } = await runJEEPipeline(token, params.model, provider.providerType, params, ctx, (currentLog) => {
          // Fire and forget live log update to DB
          db.update(generationJobsTable)
            .set({ agentLogs: currentLog })
            .where(eq(generationJobsTable.jobId, jobId))
            .catch(() => {}); // ignore transient lock/write errors
        }, controller.signal);

        const costPerInput = (0.075 / 1000000) * 83; // approx for gemini-1.5-flash
        const costPerOutput = (0.30 / 1000000) * 83;
        const totalCostInr = (inputTokens * costPerInput) + (outputTokens * costPerOutput);

        if (results.length > 0) {
          await db.insert(questionsTable).values(results.map(r => ({
            question: r.question,
            questionType: params.questionType,
            difficulty: params.difficulty,
            difficultyScore: r.difficultyScore,
            correctAnswer: r.correctAnswer,
            options: r.options ?? null,
            explanation: r.explanation,
            qualityScore: r.qualityScore,
            estimatedSolveTime: r.estimatedSolveTime,
            learningObjective: r.learningObjective,
            topicId: topicIdNum,
            chapterId: chapterIdNum,
            subjectId: subjectIdNum,
            boardId: boardIdNum,
            standardId: standardIdNum,
            providerId: providerIdNum,
            modelUsed: params.model,
            jobId,
          })));
        }

        await db.update(generationJobsTable).set({
          status: "completed",
          totalGenerated: results.length,
          agentLogs: agentLog,
          inputTokens,
          outputTokens,
          totalCostInr,
          completedAt: new Date(),
        }).where(eq(generationJobsTable.jobId, jobId));

        await db.insert(activityLogsTable).values({
          jobId,
          action: "generation_completed",
          description: `JEE Pipeline: ${results.length} ${params.difficulty} ${params.questionType} questions. Avg score: ${results.length > 0 ? (results.reduce((s, r) => s + (r.overallScore ?? 0), 0) / results.length).toFixed(1) : 0}/10`,
          questionsGenerated: results.length,
          model: params.model,
        });

        activeControllers.delete(jobId);
      } catch (err) {
        activeControllers.delete(jobId);
        await db.update(generationJobsTable).set({
          status: "failed",
          errorMessage: (err as Error).message,
          completedAt: new Date(),
        }).where(eq(generationJobsTable.jobId, jobId));
        await db.insert(activityLogsTable).values({
          jobId, action: "generation_failed",
          description: `Pipeline failed: ${(err as Error).message.slice(0, 200)}`,
          questionsGenerated: 0, model: params.model,
        }).catch(() => {});
      }
    });

  } catch (err) {
    req.log.error({ err }, "Start generation error");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/generation/jobs", requireAuth, async (req, res) => {
  try {
    const { page = "1", limit = "20" } = req.query as Record<string, string>;
    const pageNum = Math.max(1, parseInt(page));
    const limitNum = Math.min(100, parseInt(limit));
    const offset = (pageNum - 1) * limitNum;

    const [{ total }] = await db.select({ total: count() }).from(generationJobsTable);
    const jobs = await db.select().from(generationJobsTable)
      .orderBy(desc(generationJobsTable.createdAt)).limit(limitNum).offset(offset);

    res.json({
      data: jobs.map(j => ({
        jobId: j.jobId, status: j.status,
        totalRequested: j.totalRequested, totalGenerated: j.totalGenerated,
        topicName: j.topicName, subjectName: j.subjectName,
        difficulty: j.difficulty, questionType: j.questionType,
        model: j.model, createdAt: j.createdAt, completedAt: j.completedAt,
      })),
      total: Number(total), page: pageNum, limit: limitNum,
    });
  } catch (err) {
    req.log.error({ err }, "List generation jobs error");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/generation/jobs/:jobId/cancel", requireAuth, async (req, res) => {
  try {
    const jobId = req.params.jobId as string;
    
    // First update the database so UI reflects it immediately
    await db.update(generationJobsTable)
      .set({ status: "failed", errorMessage: "Cancelled by user", completedAt: new Date() })
      .where(eq(generationJobsTable.jobId, jobId!));

    // Abort if actively running in memory on this instance
    const controller = activeControllers.get(jobId!);
    if (controller) {
      controller.abort();
      activeControllers.delete(jobId!);
    }
    
    res.json({ success: true, message: "Job cancelled" });
  } catch (err) {
    req.log.error({ err }, "Cancel job error");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/generation/jobs/:jobId", requireAuth, async (req, res) => {
  try {
    const jobId = req.params.jobId as string;
    const [job] = await db.select().from(generationJobsTable).where(eq(generationJobsTable.jobId, jobId!)).limit(1);
    if (!job) { res.status(404).json({ error: "Job not found" }); return; }
    const questions = await db.select().from(questionsTable).where(eq(questionsTable.jobId, jobId!));
    res.json({
      jobId: job.jobId, status: job.status,
      totalRequested: job.totalRequested, totalGenerated: job.totalGenerated,
      agentLogs: job.agentLogs, errorMessage: job.errorMessage,
      inputTokens: job.inputTokens, outputTokens: job.outputTokens,
      totalCostInr: job.totalCostInr,
      questions, createdAt: job.createdAt, completedAt: job.completedAt,
      pipelineInfo: { stages: 10, qualityThreshold: QUALITY.minOverall, weights: QUALITY.weights },
    });
  } catch (err) {
    req.log.error({ err }, "Get generation job error");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;

/**
 * generation.ts — API Endpoints for Question Generation (Firestore backend)
 */

import { Router } from "express";
import { firestore, nextId, nextNIds, docToObj, snapshotToArr, nowTs } from "@workspace/db";
import { requireAuth, simpleDecrypt } from "../lib/auth.js";
import { randomUUID } from "crypto";
import { runJEEPipeline, GenerationRequest, QUALITY, isJeeGenerationAllowedContext } from "../lib/pipeline.js";

const router = Router();
const activeControllers = new Map<string, AbortController>();

// ═══════════════════════════════════════════════════════════════════════════════
// ROUTES
// ═══════════════════════════════════════════════════════════════════════════════

router.post("/generation/start", requireAuth, async (req, res) => {
  try {
    const params = req.body as GenerationRequest;
    const jobId = randomUUID();

    // Use IDs as-is (string or number) for Firestore lookups so that both
    // numeric sequential IDs and Firestore auto-generated IDs work correctly.
    const boardId    = String(params.boardId);
    const standardId = String(params.standardId);
    const subjectId  = String(params.subjectId);
    const chapterId  = String(params.chapterId);
    const topicId    = String(params.topicId);
    const providerId = String(params.providerId);

    // Keep numeric copies for storing on the job document (backward compat).
    const boardIdNum    = isNaN(Number(boardId))    ? boardId    : Number(boardId);
    const standardIdNum = isNaN(Number(standardId)) ? standardId : Number(standardId);
    const subjectIdNum  = isNaN(Number(subjectId))  ? subjectId  : Number(subjectId);
    const chapterIdNum  = isNaN(Number(chapterId))  ? chapterId  : Number(chapterId);
    const topicIdNum    = isNaN(Number(topicId))    ? topicId    : Number(topicId);
    const providerIdNum = isNaN(Number(providerId)) ? providerId : Number(providerId);

    const [topicDoc, chapterDoc, subjectDoc, boardDoc, standardDoc, providerDoc] = await Promise.all([
      firestore.collection("topics").doc(topicId).get(),
      firestore.collection("chapters").doc(chapterId).get(),
      firestore.collection("subjects").doc(subjectId).get(),
      firestore.collection("boards").doc(boardId).get(),
      firestore.collection("standards").doc(standardId).get(),
      firestore.collection("aiProviders").doc(providerId).get(),
    ]);

    const topic    = topicDoc.exists    ? topicDoc.data()    as any : null;
    const chapter  = chapterDoc.exists  ? chapterDoc.data()  as any : null;
    const subject  = subjectDoc.exists  ? subjectDoc.data()  as any : null;
    const board    = boardDoc.exists    ? boardDoc.data()    as any : null;
    const standard = standardDoc.exists ? standardDoc.data() as any : null;
    const provider = providerDoc.exists ? providerDoc.data() as any : null;

    if (!provider) { res.status(400).json({ error: "AI provider not found" }); return; }

    if (params.jeeAdvancedOnly) {
      if (!isJeeGenerationAllowedContext({
        topicName:   topic?.name   ?? "",
        chapterName: chapter?.name ?? "",
        subjectName: subject?.name ?? "",
      })) {
        res.status(400).json({ error: "Off-syllabus request: JEE Advanced generation is limited to Physics, Chemistry, and Mathematics topics." });
        return;
      }
    }

    const now = nowTs();
    const jobData: Record<string, unknown> = {
      jobId, status: "pending",
      totalRequested: params.count,
      totalGenerated: 0,
      boardId: boardIdNum, standardId: standardIdNum,
      subjectId: subjectIdNum, chapterId: chapterIdNum, topicId: topicIdNum,
      topicName:    topic?.name    ?? "Unknown",
      subjectName:  subject?.name  ?? "Unknown",
      chapterName:  chapter?.name  ?? "Unknown",
      questionType: params.questionType,
      difficulty:   params.difficulty,
      providerId:   providerIdNum,
      model:        params.model,
      requestParams: params,
      inputTokens: 0, outputTokens: 0, totalCostInr: 0,
      agentLogs: null, errorMessage: null, completedAt: null,
      createdAt: now,
    };

    await firestore.collection("generationJobs").doc(jobId).set(jobData);
    res.status(202).json({ jobId, status: "pending", totalRequested: params.count, createdAt: now.toDate().toISOString() });

    setImmediate(async () => {
      try {
        await firestore.collection("generationJobs").doc(jobId).update({ status: "processing" });

        const token = simpleDecrypt(provider.encryptedToken);
        const ctx = {
          topicName:    topic?.name    ?? "Topic",
          chapterName:  chapter?.name  ?? "Chapter",
          subjectName:  subject?.name  ?? "Subject",
          boardName:    board?.name    ?? "Board",
          standardName: standard?.name ?? "Standard",
        };

        const controller = new AbortController();
        activeControllers.set(jobId, controller);

        const { results, agentLog, inputTokens, outputTokens } = await runJEEPipeline(
          token, params.model, provider.providerType, params, ctx,
          (currentLog) => {
            firestore.collection("generationJobs").doc(jobId)
              .update({ agentLogs: currentLog })
              .catch(() => {});
          },
          controller.signal,
        );

        const costPerInput  = (0.075 / 1_000_000) * 83;
        const costPerOutput = (0.30  / 1_000_000) * 83;
        const totalCostInr  = inputTokens * costPerInput + outputTokens * costPerOutput;

        if (results.length > 0) {
          const qIds = await nextNIds("questions", results.length);
          const qNow = nowTs();
          const batch = firestore.batch();
          results.forEach((r, i) => {
            const qId = qIds[i]!;
            batch.set(firestore.collection("questions").doc(String(qId)), {
              id: qId,
              question:           r.question,
              questionType:       params.questionType,
              difficulty:         params.difficulty,
              difficultyScore:    r.difficultyScore,
              correctAnswer:      r.correctAnswer,
              options:            r.options ?? null,
              explanation:        r.explanation,
              qualityScore:       r.qualityScore,
              estimatedSolveTime: r.estimatedSolveTime,
              learningObjective:  r.learningObjective,
              topicId:    topicIdNum,
              chapterId:  chapterIdNum,
              subjectId:  subjectIdNum,
              boardId:    boardIdNum,
              standardId: standardIdNum,
              providerId: providerIdNum,
              modelUsed:  params.model,
              jobId,
              generatedAt: qNow,
              updatedAt:   qNow,
            });
          });
          await batch.commit();
        }

        const completedAt = nowTs();
        await firestore.collection("generationJobs").doc(jobId).update({
          status: "completed",
          totalGenerated: results.length,
          agentLogs: agentLog,
          inputTokens, outputTokens, totalCostInr,
          completedAt,
        });

        const logId = await nextId("activityLogs");
        await firestore.collection("activityLogs").doc(String(logId)).set({
          id: logId,
          jobId,
          action: "generation_completed",
          description: `JEE Pipeline: ${results.length} ${params.difficulty} ${params.questionType} questions. Avg score: ${results.length > 0 ? (results.reduce((s, r) => s + (r.overallScore ?? 0), 0) / results.length).toFixed(1) : 0}/10`,
          questionsGenerated: results.length,
          model: params.model,
          userId: null,
          createdAt: nowTs(),
        });

        activeControllers.delete(jobId);
      } catch (err) {
        activeControllers.delete(jobId);
        await firestore.collection("generationJobs").doc(jobId).update({
          status: "failed",
          errorMessage: (err as Error).message,
          completedAt: nowTs(),
        });
        const logId = await nextId("activityLogs");
        await firestore.collection("activityLogs").doc(String(logId)).set({
          id: logId,
          jobId, action: "generation_failed",
          description: `Pipeline failed: ${(err as Error).message.slice(0, 200)}`,
          questionsGenerated: 0,
          model: params.model,
          userId: null,
          createdAt: nowTs(),
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

    const snap = await firestore.collection("generationJobs").orderBy("createdAt", "desc").get();
    const jobs = snapshotToArr(snap);
    const total = jobs.length;
    const page_jobs = jobs.slice((pageNum - 1) * limitNum, pageNum * limitNum);

    res.json({
      data: page_jobs.map((j: any) => ({
        jobId: j.jobId, status: j.status,
        totalRequested: j.totalRequested, totalGenerated: j.totalGenerated,
        topicName: j.topicName, chapterName: j.chapterName, subjectName: j.subjectName,
        difficulty: j.difficulty, questionType: j.questionType,
        model: j.model, createdAt: j.createdAt, completedAt: j.completedAt,
      })),
      total, page: pageNum, limit: limitNum,
    });
  } catch (err) {
    req.log.error({ err }, "List generation jobs error");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/generation/jobs/:jobId/cancel", requireAuth, async (req, res) => {
  try {
    const jobId = req.params.jobId as string;
    await firestore.collection("generationJobs").doc(jobId).update({
      status: "failed",
      errorMessage: "Cancelled by user",
      completedAt: nowTs(),
    });
    const controller = activeControllers.get(jobId);
    if (controller) {
      controller.abort();
      activeControllers.delete(jobId);
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
    const [jobDoc, questionsSnap] = await Promise.all([
      firestore.collection("generationJobs").doc(jobId).get(),
      firestore.collection("questions").where("jobId", "==", jobId).get(),
    ]);

    if (!jobDoc.exists) { res.status(404).json({ error: "Job not found" }); return; }
    const job = docToObj(jobDoc) as any;
    const questions = snapshotToArr(questionsSnap);

    res.json({
      jobId:          job.jobId,
      status:         job.status,
      totalRequested: job.totalRequested,
      totalGenerated: job.totalGenerated,
      agentLogs:      job.agentLogs,
      errorMessage:   job.errorMessage,
      inputTokens:    job.inputTokens,
      outputTokens:   job.outputTokens,
      totalCostInr:   job.totalCostInr,
      questions,
      createdAt:      job.createdAt,
      completedAt:    job.completedAt,
      pipelineInfo: { stages: 10, qualityThreshold: QUALITY.minOverall, weights: QUALITY.weights },
    });
  } catch (err) {
    req.log.error({ err }, "Get generation job error");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;

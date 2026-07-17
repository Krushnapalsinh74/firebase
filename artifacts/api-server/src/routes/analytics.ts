import { Router } from "express";
import { firestore, snapshotToArr } from "@workspace/db";
import { requireAuth } from "../lib/auth.js";

const router = Router();

router.get("/analytics/dashboard", requireAuth, async (req, res) => {
  try {
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);

    const [
      qSnap, subSnap, chapSnap, topSnap, boardSnap, stdSnap, provSnap, paperSnap,
      jobSnap, actSnap,
    ] = await Promise.all([
      firestore.collection("questions").get(),
      firestore.collection("subjects").get(),
      firestore.collection("chapters").get(),
      firestore.collection("topics").get(),
      firestore.collection("boards").get(),
      firestore.collection("standards").get(),
      firestore.collection("aiProviders").get(),
      firestore.collection("papers").get(),
      firestore.collection("generationJobs").get(),
      firestore.collection("activityLogs").get(),
    ]);

    const questions = snapshotToArr(qSnap) as any[];
    const jobs      = snapshotToArr(jobSnap) as any[];

    const todayMs       = today.getTime();
    const monthStartMs  = monthStart.getTime();
    const questionsToday      = questions.filter((q) => new Date(q.generatedAt).getTime() >= todayMs).length;
    const questionsThisMonth  = questions.filter((q) => new Date(q.generatedAt).getTime() >= monthStartMs).length;
    const avgQualityScore     = questions.length > 0
      ? questions.reduce((s, q) => s + (q.qualityScore ?? 0), 0) / questions.length
      : 0;
    const totalJobsRunning    = jobs.filter((j) => j.status === "pending" || j.status === "processing").length;
    const totalInputTokens    = jobs.reduce((s, j) => s + (j.inputTokens  ?? 0), 0);
    const totalOutputTokens   = jobs.reduce((s, j) => s + (j.outputTokens ?? 0), 0);
    const totalCostInr        = jobs.reduce((s, j) => s + (j.totalCostInr ?? 0), 0);

    res.json({
      totalQuestions:   qSnap.size,
      totalSubjects:    subSnap.size,
      totalChapters:    chapSnap.size,
      totalTopics:      topSnap.size,
      questionsToday,
      questionsThisMonth,
      totalBoards:      boardSnap.size,
      totalStandards:   stdSnap.size,
      activeProviders:  provSnap.size,
      totalPapers:      paperSnap.size,
      avgQualityScore:  parseFloat(avgQualityScore.toFixed(4)),
      totalJobsRunning,
      totalInputTokens,
      totalOutputTokens,
      totalCostInr:     parseFloat(totalCostInr.toFixed(4)),
    });
  } catch (err) {
    req.log.error({ err }, "Dashboard stats error");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/analytics/questions-by-subject", requireAuth, async (req, res) => {
  try {
    const snap = await firestore.collection("questions").get();
    const questions = snapshotToArr(snap) as any[];

    const subjectIds = [...new Set(questions.map((q) => q.subjectId).filter(Boolean))];
    const subjectDocs = await Promise.all(
      subjectIds.map((id) => firestore.collection("subjects").doc(String(id)).get())
    );
    const subjectMap: Record<number, string> = {};
    subjectDocs.forEach((d) => { if (d.exists) subjectMap[parseInt(d.id)] = d.data()?.name ?? "Unknown"; });

    const counts: Record<string, number> = {};
    questions.forEach((q) => {
      const name = q.subjectId ? (subjectMap[q.subjectId] ?? "Unknown") : "Unknown";
      counts[name] = (counts[name] ?? 0) + 1;
    });

    const rows = Object.entries(counts)
      .map(([subjectName, count]) => ({ subjectName, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    res.json(rows);
  } catch (err) {
    req.log.error({ err }, "Questions by subject error");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/analytics/questions-by-difficulty", requireAuth, async (req, res) => {
  try {
    const snap = await firestore.collection("questions").get();
    const questions = snapshotToArr(snap) as any[];

    const counts: Record<string, number> = {};
    questions.forEach((q) => {
      const d = q.difficulty ?? "unknown";
      counts[d] = (counts[d] ?? 0) + 1;
    });

    const rows = Object.entries(counts)
      .map(([difficulty, count]) => ({ difficulty, count }))
      .sort((a, b) => a.difficulty.localeCompare(b.difficulty));

    res.json(rows);
  } catch (err) {
    req.log.error({ err }, "Questions by difficulty error");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/analytics/model-usage", requireAuth, async (req, res) => {
  try {
    const snap = await firestore.collection("questions").get();
    const questions = snapshotToArr(snap) as any[];

    const modelData: Record<string, { count: number; totalQuality: number }> = {};
    questions.forEach((q) => {
      const m = q.modelUsed;
      if (!m) return;
      if (!modelData[m]) modelData[m] = { count: 0, totalQuality: 0 };
      modelData[m]!.count++;
      modelData[m]!.totalQuality += q.qualityScore ?? 0;
    });

    const rows = Object.entries(modelData)
      .map(([model, { count, totalQuality }]) => ({
        model,
        provider: "github_models",
        count,
        avgQualityScore: parseFloat((totalQuality / count).toFixed(4)),
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    res.json(rows);
  } catch (err) {
    req.log.error({ err }, "Model usage error");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/analytics/recent-activity", requireAuth, async (req, res) => {
  try {
    const limit = Math.min(50, parseInt((req.query["limit"] as string) ?? "10"));
    const snap = await firestore.collection("activityLogs").orderBy("createdAt", "desc").limit(limit).get();
    res.json(snapshotToArr(snap).map((l: any) => ({
      id: l.id, jobId: l.jobId, action: l.action, description: l.description,
      questionsGenerated: l.questionsGenerated, model: l.model, createdAt: l.createdAt,
    })));
  } catch (err) {
    req.log.error({ err }, "Recent activity error");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/analytics/monthly-report", requireAuth, async (req, res) => {
  try {
    const cutoff = new Date();
    cutoff.setFullYear(cutoff.getFullYear() - 1);

    const snap = await firestore.collection("questions").get();
    const questions = snapshotToArr(snap) as any[];

    const monthly: Record<string, { count: number; totalQuality: number }> = {};
    questions.forEach((q) => {
      const d = q.generatedAt ? new Date(q.generatedAt) : null;
      if (!d || d < cutoff) return;
      const key = `${d.getFullYear()}-${d.getMonth() + 1}`;
      if (!monthly[key]) monthly[key] = { count: 0, totalQuality: 0 };
      monthly[key]!.count++;
      monthly[key]!.totalQuality += q.qualityScore ?? 0;
    });

    const monthNames = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
    const rows = Object.entries(monthly).map(([key, { count, totalQuality }]) => {
      const [year, month] = key.split("-").map(Number);
      return {
        month, year: year!,
        label: `${monthNames[(month ?? 1) - 1]} ${year}`,
        count,
        avgQualityScore: parseFloat((totalQuality / count).toFixed(2)),
      };
    }).sort((a, b) => a.year !== b.year ? a.year - b.year : (a.month ?? 0) - (b.month ?? 0));

    res.json(rows);
  } catch (err) {
    req.log.error({ err }, "Monthly report error");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/analytics/topic-coverage", requireAuth, async (req, res) => {
  try {
    const [topicsSnap, questionsSnap] = await Promise.all([
      firestore.collection("topics").where("isActive", "==", true).get(),
      firestore.collection("questions").get(),
    ]);

    const topics  = snapshotToArr(topicsSnap) as any[];
    const questions = snapshotToArr(questionsSnap) as any[];

    // Index questions by topicId
    const byTopic: Record<number, any[]> = {};
    questions.forEach((q) => {
      if (!q.topicId) return;
      if (!byTopic[q.topicId]) byTopic[q.topicId] = [];
      byTopic[q.topicId]!.push(q);
    });

    // Fetch chapters and subjects for enrichment (batch)
    const chapterIds = [...new Set(topics.map((t) => t.chapterId).filter(Boolean))];
    const chapterDocs = await Promise.all(chapterIds.map((id) => firestore.collection("chapters").doc(String(id)).get()));
    const chapterMap: Record<number, any> = {};
    chapterDocs.forEach((d) => { if (d.exists) chapterMap[parseInt(d.id)] = d.data(); });

    const subjectIds = [...new Set(Object.values(chapterMap).map((c: any) => c.subjectId).filter(Boolean))];
    const subjectDocs = await Promise.all(subjectIds.map((id) => firestore.collection("subjects").doc(String(id)).get()));
    const subjectMap: Record<number, any> = {};
    subjectDocs.forEach((d) => { if (d.exists) subjectMap[parseInt(d.id)] = d.data(); });

    const rows = topics.map((t) => {
      const tqs = byTopic[t.id] ?? [];
      const chapter = chapterMap[t.chapterId];
      const subject  = chapter ? subjectMap[chapter.subjectId] : null;
      const totalQuality = tqs.reduce((s, q) => s + (q.qualityScore ?? 0), 0);
      return {
        topicId:     t.id,
        topicName:   t.name ?? "",
        chapterName: chapter?.name ?? "",
        subjectName: subject?.name ?? "",
        total:    tqs.length,
        easy:     tqs.filter((q) => q.difficulty === "easy").length,
        medium:   tqs.filter((q) => q.difficulty === "medium").length,
        hard:     tqs.filter((q) => q.difficulty === "hard").length,
        advanced: tqs.filter((q) => q.difficulty === "advanced").length,
        avgQuality: tqs.length > 0 ? parseFloat((totalQuality / tqs.length).toFixed(2)) : 0,
      };
    }).sort((a, b) => b.total - a.total || a.topicName.localeCompare(b.topicName));

    res.json(rows);
  } catch (err) {
    req.log.error({ err }, "Topic coverage error");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/analytics/quality-distribution", requireAuth, async (req, res) => {
  try {
    const snap = await firestore.collection("questions").get();
    const questions = snapshotToArr(snap) as any[];

    const bands: Record<string, number> = {
      "Excellent (0.9–1.0)": 0,
      "Good (0.75–0.9)":     0,
      "Fair (0.5–0.75)":     0,
      "Poor (<0.5)":         0,
    };
    questions.forEach((q) => {
      const s = q.qualityScore ?? 0;
      if (s >= 0.9)  bands["Excellent (0.9–1.0)"]!++;
      else if (s >= 0.75) bands["Good (0.75–0.9)"]!++;
      else if (s >= 0.5)  bands["Fair (0.5–0.75)"]!++;
      else                bands["Poor (<0.5)"]!++;
    });

    res.json(Object.entries(bands).map(([band, count]) => ({ band, count })));
  } catch (err) {
    req.log.error({ err }, "Quality distribution error");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;

import { Router } from "express";
import { firestore, docToObj, snapshotToArr, nextId, nextNIds, nowTs } from "@workspace/db";
import { requireAuth } from "../lib/auth.js";
import { logActivity } from "../lib/audit.js";

const router = Router();

export interface ApprovalRequestDoc {
  id: number;
  subAdminId: number;
  subAdminName: string;
  subAdminEmail: string;
  actionType: "CREATE_QUESTIONS" | "UPDATE_QUESTION" | "DELETE_QUESTION" | "IMPORT_PDF_EXTRACT" | "CREATE_PAPER" | "CREATE_HIERARCHY";
  entityType: "questions" | "papers" | "hierarchy" | "chapters" | "topics";
  payload: any;
  summary: string;
  status: "pending" | "approved" | "rejected";
  reviewedBy?: number | null;
  reviewedByName?: string | null;
  reviewNote?: string | null;
  createdAt: string;
  reviewedAt?: string | null;
}

// ─── 0. Create / Submit New Approval Request (Sub-Admin) ──────────────────────
router.post("/approvals/submit", requireAuth, async (req, res) => {
  try {
    const caller = (req as any).user;
    const {
      actionType = "CREATE_QUESTIONS",
      entityType = "questions",
      payload = {},
      summary,
    } = req.body;

    const reqId = await nextId("approvalRequests");
    const now = nowTs();

    const title = summary || `${caller.email} submitted ${actionType.replace(/_/g, " ").toLowerCase()} for approval`;

    const requestDoc: ApprovalRequestDoc = {
      id: reqId,
      subAdminId: Number(caller.userId),
      subAdminName: caller.email?.split("@")[0] || "Sub-Admin",
      subAdminEmail: caller.email || "",
      actionType,
      entityType,
      payload,
      summary: title,
      status: "pending",
      createdAt: now,
    };

    await firestore.collection("approvalRequests").doc(String(reqId)).set(requestDoc);

    await logActivity({
      userId: caller.userId,
      userName: caller.email,
      userEmail: caller.email,
      userRole: caller.role,
      action: "SUBMIT_APPROVAL_REQUEST",
      resource: entityType || "approvalRequests",
      details: { requestId: reqId, actionType, summary: title },
      ipAddress: req.ip,
    });

    res.json({
      success: true,
      requestId: reqId,
      message: "Approval request submitted successfully! Super Admin has been notified.",
    });
  } catch (err: any) {
    req.log?.error?.({ err }, "Submit approval request error");
    res.status(500).json({ error: err.message || "Internal server error" });
  }
});

// ─── 1. List Approval Requests (Filtered by Status) ──────────────────────────
router.get("/approvals", requireAuth, async (req, res) => {
  try {
    const { status = "all", page = "1", limit = "50" } = req.query as Record<string, string>;
    const user = (req as any).user;

    let query: FirebaseFirestore.Query = firestore.collection("approvalRequests");

    if (user.role === "subadmin") {
      // Sub-admins only see their own requests
      query = query.where("subAdminId", "==", Number(user.userId));
    }

    if (status && status !== "all") {
      query = query.where("status", "==", status);
    }

    const snap = await query.get();
    let requests = snapshotToArr(snap) as ApprovalRequestDoc[];

    // Sort newest first
    requests.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    // Calculate pending count for badges
    const allSnap = await firestore.collection("approvalRequests").where("status", "==", "pending").get();
    const pendingCount = allSnap.size;

    const pageNum = Math.max(1, parseInt(page) || 1);
    const limitNum = Math.min(100, parseInt(limit) || 50);
    const paged = requests.slice((pageNum - 1) * limitNum, pageNum * limitNum);

    res.json({
      requests: paged,
      total: requests.length,
      pendingCount,
    });
  } catch (err: any) {
    req.log?.error?.({ err }, "List approvals error");
    res.status(500).json({ error: err.message || "Internal server error" });
  }
});

// ─── 2. Get Single Approval Request Details ──────────────────────────────────
router.get("/approvals/:id", requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const doc = await firestore.collection("approvalRequests").doc(String(id)).get();
    if (!doc.exists) {
      return res.status(404).json({ error: "Approval request not found" });
    }

    const requestData = docToObj(doc) as ApprovalRequestDoc;
    res.json({ request: requestData });
  } catch (err: any) {
    req.log?.error?.({ err }, "Get approval details error");
    res.status(500).json({ error: err.message || "Internal server error" });
  }
});

// ─── 3. Approve Request (Applies Staged Changes to Database) ─────────────────
router.post("/approvals/:id/approve", requireAuth, async (req, res) => {
  try {
    const caller = (req as any).user;
    if (caller.role !== "admin" && caller.role !== "superadmin") {
      return res.status(403).json({ error: "Access denied. Only Super Admin can approve requests." });
    }

    const { id } = req.params;
    const docRef = firestore.collection("approvalRequests").doc(String(id));
    const docSnap = await docRef.get();

    if (!docSnap.exists) {
      return res.status(404).json({ error: "Approval request not found" });
    }

    const reqData = docToObj(docSnap) as ApprovalRequestDoc;
    if (reqData.status === "approved") {
      return res.status(400).json({ error: "Request is already approved." });
    }

    const now = nowTs();
    const payload = reqData.payload || {};

    // ── Apply staged changes based on actionType ──────────────────────────────
    if (reqData.actionType === "IMPORT_PDF_EXTRACT" || reqData.actionType === "CREATE_QUESTIONS") {
      const {
        boardId,
        standardId,
        subjectId,
        chapters = [],
        topics = [],
        questions = [],
        providerId,
        modelUsed,
      } = payload;

      // 1. Process Chapters
      const existingChaptersSnap = subjectId
        ? await firestore.collection("chapters").where("subjectId", "==", Number(subjectId)).get()
        : await firestore.collection("chapters").get();

      const chapterMap = new Map<string, number>();
      existingChaptersSnap.docs.forEach((doc) => {
        const data = doc.data();
        if (data.name) chapterMap.set(data.name.trim().toLowerCase(), data.id);
      });

      for (const chap of chapters) {
        const key = chap.name.trim().toLowerCase();
        if (!chapterMap.has(key)) {
          const cId = await nextId("chapters");
          const chapData = {
            id: cId,
            name: chap.name.trim(),
            description: chap.description || null,
            orderIndex: chap.orderIndex ?? 1,
            subjectId: subjectId ? Number(subjectId) : null,
            isActive: true,
            createdAt: now,
            updatedAt: now,
          };
          await firestore.collection("chapters").doc(String(cId)).set(chapData);
          chapterMap.set(key, cId);
        }
      }

      // 2. Process Topics
      const topicMap = new Map<string, number>();
      const existingTopicsSnap = await firestore.collection("topics").get();
      existingTopicsSnap.docs.forEach((doc) => {
        const data = doc.data();
        if (data.name && data.chapterId) {
          topicMap.set(`${data.chapterId}:${data.name.trim().toLowerCase()}`, data.id);
        }
      });

      for (const top of topics) {
        const chapKey = top.chapterName.trim().toLowerCase();
        const chapId = chapterMap.get(chapKey) || Array.from(chapterMap.values())[0] || null;
        if (!chapId) continue;

        const topKey = `${chapId}:${top.name.trim().toLowerCase()}`;
        if (!topicMap.has(topKey)) {
          const tId = await nextId("topics");
          const topData = {
            id: tId,
            name: top.name.trim(),
            description: top.description || null,
            chapterId: chapId,
            chapterName: top.chapterName,
            isActive: true,
            createdAt: now,
            updatedAt: now,
          };
          await firestore.collection("topics").doc(String(tId)).set(topData);
          topicMap.set(topKey, tId);
        }
      }

      // 3. Batch Insert Questions
      if (questions.length > 0) {
        const qIds = await nextNIds("questions", questions.length);
        const batchSize = 400;

        for (let i = 0; i < questions.length; i += batchSize) {
          const batch = firestore.batch();
          const chunk = questions.slice(i, i + batchSize);

          chunk.forEach((q: any, chunkIdx: number) => {
            const globalIdx = i + chunkIdx;
            const qId = qIds[globalIdx]!;

            const chapKey = (q.chapterName || "").trim().toLowerCase();
            const chapId = chapterMap.get(chapKey) || Array.from(chapterMap.values())[0] || null;
            const topKey = chapId && q.topicName ? `${chapId}:${q.topicName.trim().toLowerCase()}` : "";
            const topId = topicMap.get(topKey) || (chapId ? Array.from(topicMap.entries()).find(([k]) => k.startsWith(`${chapId}:`))?.[1] : null) || null;

            const docData = {
              id: qId,
              question: q.question,
              questionType: q.questionType || "single_choice",
              difficulty: q.difficulty || "medium",
              difficultyScore: q.difficultyScore || 5,
              correctAnswer: q.correctAnswer ?? null,
              options: q.options ?? null,
              explanation: q.explanation || null,
              marks: q.marks ?? 4,
              imageUrl: q.imageUrl || null,
              translations: q.translations || null,
              topicId: topId,
              chapterId: chapId,
              subjectId: subjectId ? Number(subjectId) : null,
              standardId: standardId ? Number(standardId) : null,
              boardId: boardId ? Number(boardId) : null,
              providerId: providerId ? Number(providerId) : null,
              modelUsed: modelUsed || null,
              jobId: null,
              approvedBy: caller.userId,
              generatedAt: now,
              updatedAt: now,
            };

            batch.set(firestore.collection("questions").doc(String(qId)), docData);
          });

          await batch.commit();
        }
      }
    } else if (reqData.actionType === "CREATE_PAPER") {
      const paperId = await nextId("papers");
      const paperData = {
        ...payload,
        id: paperId,
        approvedBy: caller.userId,
        createdAt: now,
        updatedAt: now,
      };
      await firestore.collection("papers").doc(String(paperId)).set(paperData);
    } else if (reqData.actionType === "DELETE_QUESTION") {
      const { questionId } = payload;
      if (questionId) {
        await firestore.collection("questions").doc(String(questionId)).delete();
      }
    }

    // Mark Request Approved
    await docRef.update({
      status: "approved",
      reviewedBy: caller.userId,
      reviewedByName: caller.email,
      reviewedAt: now,
    });

    await logActivity({
      userId: caller.userId,
      userName: caller.email,
      userEmail: caller.email,
      userRole: caller.role,
      action: "APPROVE_CHANGE_REQUEST",
      resource: "approvalRequests",
      details: { requestId: id, actionType: reqData.actionType, subAdminEmail: reqData.subAdminEmail },
      ipAddress: req.ip,
    });

    res.json({
      success: true,
      message: "Request approved and changes applied to the database!",
    });
  } catch (err: any) {
    req.log?.error?.({ err }, "Approve request error");
    res.status(500).json({ error: err.message || "Internal server error" });
  }
});

// ─── 4. Reject Request ───────────────────────────────────────────────────────
router.post("/approvals/:id/reject", requireAuth, async (req, res) => {
  try {
    const caller = (req as any).user;
    if (caller.role !== "admin" && caller.role !== "superadmin") {
      return res.status(403).json({ error: "Access denied. Only Super Admin can reject requests." });
    }

    const { id } = req.params;
    const { note = "" } = req.body;

    const docRef = firestore.collection("approvalRequests").doc(String(id));
    const docSnap = await docRef.get();

    if (!docSnap.exists) {
      return res.status(404).json({ error: "Approval request not found" });
    }

    const now = nowTs();
    await docRef.update({
      status: "rejected",
      reviewedBy: caller.userId,
      reviewedByName: caller.email,
      reviewNote: String(note || "").trim(),
      reviewedAt: now,
    });

    await logActivity({
      userId: caller.userId,
      userName: caller.email,
      userEmail: caller.email,
      userRole: caller.role,
      action: "REJECT_CHANGE_REQUEST",
      resource: "approvalRequests",
      details: { requestId: id, note },
      ipAddress: req.ip,
    });

    res.json({ success: true, message: "Request rejected." });
  } catch (err: any) {
    req.log?.error?.({ err }, "Reject request error");
    res.status(500).json({ error: err.message || "Internal server error" });
  }
});

export default router;

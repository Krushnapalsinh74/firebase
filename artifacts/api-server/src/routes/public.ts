import { Router } from "express";
import { firestore, snapshotToArr } from "@workspace/db";

const router = Router();

router.get("/public/data", async (req, res) => {
  try {
    const lang = req.query.lang as string;

    const [
      boardsSnap,
      standardsSnap,
      subjectsSnap,
      chaptersSnap,
      topicsSnap,
      questionsSnap
    ] = await Promise.all([
      firestore.collection("boards").get(),
      firestore.collection("standards").get(),
      firestore.collection("subjects").get(),
      firestore.collection("chapters").get(),
      firestore.collection("topics").get(),
      firestore.collection("questions").get()
    ]);

    const boards = snapshotToArr(boardsSnap);
    const standards = snapshotToArr(standardsSnap);
    const subjects = snapshotToArr(subjectsSnap);
    const chapters = snapshotToArr(chaptersSnap);
    const topics = snapshotToArr(topicsSnap);
    let questions = snapshotToArr(questionsSnap) as any[];

    // If a specific language is requested, swap out the main fields with the translated ones
    if (lang && lang !== "en") {
      questions = questions.map(q => {
        const translated = q.translations?.[lang];
        if (translated) {
          if (translated.question) q.question = translated.question;
          if (translated.options) q.options = translated.options;
          if (translated.correctAnswer) q.correctAnswer = translated.correctAnswer;
          if (translated.explanation) q.explanation = translated.explanation;
        }
        // Remove translations object to keep the payload lightweight for the mobile app
        delete q.translations;
        return q;
      });
    }

    const data = {
      boards,
      standards,
      subjects,
      chapters,
      topics,
      questions
    };

    res.json(data);
  } catch (err) {
    req.log.error({ err }, "Public data export error");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;

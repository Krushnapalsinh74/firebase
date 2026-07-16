import { Router, type IRouter } from "express";
import healthRouter from "./health.js";
import authRouter from "./auth.js";
import boardsRouter from "./boards.js";
import standardsRouter from "./standards.js";
import subjectsRouter from "./subjects.js";
import chaptersRouter from "./chapters.js";
import topicsRouter from "./topics.js";
import questionTypesRouter from "./questionTypes.js";
import questionsRouter from "./questions.js";
import aiProvidersRouter from "./aiProviders.js";
import generationRouter from "./generation.js";
import papersRouter from "./papers.js";
import analyticsRouter from "./analytics.js";
import translateRouter from "./translate.js";

const router: IRouter = Router();

router.use(healthRouter);
router.use(authRouter);
router.use(boardsRouter);
router.use(standardsRouter);
router.use(subjectsRouter);
router.use(chaptersRouter);
router.use(topicsRouter);
router.use(questionTypesRouter);
router.use(questionsRouter);
router.use(aiProvidersRouter);
router.use(generationRouter);
router.use(papersRouter);
router.use(analyticsRouter);
router.use(translateRouter);

export default router;

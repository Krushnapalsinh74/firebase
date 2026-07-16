import bcrypt from "bcryptjs";
import { db } from "@workspace/db";
import {
  usersTable,
  questionTypesTable,
  boardsTable,
  standardsTable,
  subjectsTable,
  chaptersTable,
  topicsTable,
} from "@workspace/db";
import { eq, count } from "drizzle-orm";
import { logger } from "./logger.js";

const ADMIN_EMAIL = "admin@123.com";
const ADMIN_PASSWORD = "admin123";

async function seedAdmin() {
  const [{ total }] = await db.select({ total: count() }).from(usersTable).where(eq(usersTable.email, ADMIN_EMAIL));
  if (Number(total) > 0) return;

  const passwordHash = await bcrypt.hash(ADMIN_PASSWORD, 10);
  await db.insert(usersTable).values({
    email: ADMIN_EMAIL,
    name: "Yunora Admin",
    passwordHash,
    role: "admin",
    isActive: true,
  });
  logger.info("Seeded admin user: admin@123.com / admin123");
}

async function seedQuestionTypes() {
  const [{ total }] = await db.select({ total: count() }).from(questionTypesTable);
  if (Number(total) > 0) return;

  await db.insert(questionTypesTable).values([
    { name: "Multiple Choice Question", slug: "mcq", description: "Questions with 4 options, one correct answer" },
    { name: "True or False", slug: "true-false", description: "Binary choice questions" },
    { name: "Fill in the Blank", slug: "fill-blank", description: "Complete the sentence" },
    { name: "One Word Answer", slug: "one-word", description: "Single word answer required" },
    { name: "Very Short Answer", slug: "very-short", description: "Answer in 1-2 sentences" },
    { name: "Short Answer", slug: "short-answer", description: "Answer in 3-5 sentences" },
    { name: "Long Answer", slug: "long-answer", description: "Detailed descriptive answer" },
    { name: "Assertion Reason", slug: "assertion-reason", description: "Evaluate assertion and reason" },
    { name: "Match the Following", slug: "match-following", description: "Match column A with column B" },
    { name: "HOTS Questions", slug: "hots", description: "Higher Order Thinking Skills" },
    { name: "Case Study", slug: "case-study", description: "Based on a given scenario" },
    { name: "Numerical", slug: "numerical", description: "Mathematical calculation required" },
  ]);
  logger.info("Seeded 12 question types");
}

async function seedBoards() {
  const [{ total }] = await db.select({ total: count() }).from(boardsTable);
  if (Number(total) > 0) return;

  const [cbse] = await db.insert(boardsTable).values([
    { name: "Central Board of Secondary Education", code: "CBSE", description: "National board for secondary education in India", isActive: true },
    { name: "Indian Certificate of Secondary Education", code: "ICSE", description: "All India board managed by CISCE", isActive: true },
    { name: "Maharashtra State Board", code: "MHSB", description: "Maharashtra state secondary and higher secondary board", isActive: true },
  ]).returning();

  const boards = await db.select().from(boardsTable).where(eq(boardsTable.code, "CBSE")).limit(1);
  const cbseId = boards[0]?.id;
  if (!cbseId) return;

  const standards = await db.insert(standardsTable).values([
    { name: "Class 9", level: 9, boardId: cbseId, isActive: true },
    { name: "Class 10", level: 10, boardId: cbseId, isActive: true },
    { name: "Class 11", level: 11, boardId: cbseId, isActive: true },
    { name: "Class 12", level: 12, boardId: cbseId, isActive: true },
  ]).returning();

  const class10 = standards.find(s => s.level === 10);
  if (!class10) return;

  const subjects = await db.insert(subjectsTable).values([
    { name: "Mathematics", code: "MATH", standardId: class10.id, isActive: true },
    { name: "Science", code: "SCI", standardId: class10.id, isActive: true },
    { name: "Social Science", code: "SST", standardId: class10.id, isActive: true },
    { name: "English", code: "ENG", standardId: class10.id, isActive: true },
  ]).returning();

  const math = subjects.find(s => s.code === "MATH");
  if (!math) return;

  const chapters = await db.insert(chaptersTable).values([
    { name: "Real Numbers", orderIndex: 1, subjectId: math.id, isActive: true },
    { name: "Polynomials", orderIndex: 2, subjectId: math.id, isActive: true },
    { name: "Quadratic Equations", orderIndex: 3, subjectId: math.id, isActive: true },
    { name: "Triangles", orderIndex: 4, subjectId: math.id, isActive: true },
    { name: "Introduction to Trigonometry", orderIndex: 5, subjectId: math.id, isActive: true },
  ]).returning();

  const realNumbers = chapters.find(c => c.name === "Real Numbers");
  if (!realNumbers) return;

  await db.insert(topicsTable).values([
    { name: "Euclid's Division Lemma", description: "Divisibility and GCD using Euclidean algorithm", chapterId: realNumbers.id, isActive: true },
    { name: "Fundamental Theorem of Arithmetic", description: "Prime factorization theorem", chapterId: realNumbers.id, isActive: true },
    { name: "Irrational Numbers", description: "Proving irrationality of numbers like √2", chapterId: realNumbers.id, isActive: true },
    { name: "Decimal Expansions", description: "Terminating and non-terminating decimals", chapterId: realNumbers.id, isActive: true },
  ]);

  logger.info("Seeded CBSE boards, standards, subjects, chapters, topics");
}

export async function runSeed() {
  try {
    await seedAdmin();
    await seedQuestionTypes();
    await seedBoards();
    logger.info("Database seed complete");
  } catch (err) {
    logger.error({ err }, "Database seed failed — continuing startup");
  }
}

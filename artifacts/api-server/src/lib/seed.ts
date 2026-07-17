import bcrypt from "bcryptjs";
import { firestore, nextId, nowTs } from "@workspace/db";
import { logger } from "./logger.js";

const ADMIN_EMAIL    = "admin@yunora.ai";
const ADMIN_PASSWORD = "admin123";

async function isEmpty(collection: string): Promise<boolean> {
  const snap = await firestore.collection(collection).limit(1).get();
  return snap.empty;
}

async function seedAdmin() {
  const snap = await firestore.collection("users").where("email", "==", ADMIN_EMAIL).limit(1).get();
  if (!snap.empty) return;

  const passwordHash = await bcrypt.hash(ADMIN_PASSWORD, 10);
  const id = await nextId("users");
  const now = nowTs();
  await firestore.collection("users").doc(String(id)).set({
    id, email: ADMIN_EMAIL, name: "Yunora Admin",
    passwordHash, role: "admin", isActive: true,
    createdAt: now, updatedAt: now,
  });
  logger.info("Seeded admin user: admin@yunora.ai / admin123");
}

async function seedQuestionTypes() {
  if (!(await isEmpty("questionTypes"))) return;

  const types = [
    { name: "Multiple Choice Question",  slug: "mcq",              description: "Questions with 4 options, one correct answer" },
    { name: "True or False",             slug: "true-false",        description: "Binary choice questions" },
    { name: "Fill in the Blank",         slug: "fill-blank",        description: "Complete the sentence" },
    { name: "One Word Answer",           slug: "one-word",          description: "Single word answer required" },
    { name: "Very Short Answer",         slug: "very-short",        description: "Answer in 1-2 sentences" },
    { name: "Short Answer",              slug: "short-answer",      description: "Answer in 3-5 sentences" },
    { name: "Long Answer",               slug: "long-answer",       description: "Detailed descriptive answer" },
    { name: "Assertion Reason",          slug: "assertion-reason",  description: "Evaluate assertion and reason" },
    { name: "Match the Following",       slug: "match-following",   description: "Match column A with column B" },
    { name: "HOTS Questions",            slug: "hots",              description: "Higher Order Thinking Skills" },
    { name: "Case Study",                slug: "case-study",        description: "Based on a given scenario" },
    { name: "Numerical",                 slug: "numerical",         description: "Mathematical calculation required" },
  ];

  const batch = firestore.batch();
  for (let i = 0; i < types.length; i++) {
    const id = i + 1; // sequential IDs
    batch.set(firestore.collection("questionTypes").doc(String(id)), { id, ...types[i]! });
  }
  // Set counter
  batch.set(firestore.collection("_counters").doc("questionTypes"), { value: types.length });
  await batch.commit();
  logger.info("Seeded 12 question types");
}

async function seedBoards() {
  if (!(await isEmpty("boards"))) return;

  const now = nowTs();
  const batch = firestore.batch();

  // Boards
  const boardDefs = [
    { id: 1, name: "Central Board of Secondary Education",   code: "CBSE", description: "National board for secondary education in India",       isActive: true },
    { id: 2, name: "Indian Certificate of Secondary Education", code: "ICSE", description: "All India board managed by CISCE",                  isActive: true },
    { id: 3, name: "Maharashtra State Board",                code: "MHSB", description: "Maharashtra state secondary and higher secondary board", isActive: true },
  ];
  boardDefs.forEach((b) => batch.set(firestore.collection("boards").doc(String(b.id)), { ...b, createdAt: now, updatedAt: now }));
  batch.set(firestore.collection("_counters").doc("boards"), { value: boardDefs.length });

  // Standards (CBSE only)
  const stdDefs = [
    { id: 1, name: "Class 9",  level: 9,  boardId: 1, isActive: true },
    { id: 2, name: "Class 10", level: 10, boardId: 1, isActive: true },
    { id: 3, name: "Class 11", level: 11, boardId: 1, isActive: true },
    { id: 4, name: "Class 12", level: 12, boardId: 1, isActive: true },
  ];
  stdDefs.forEach((s) => batch.set(firestore.collection("standards").doc(String(s.id)), { ...s, createdAt: now, updatedAt: now }));
  batch.set(firestore.collection("_counters").doc("standards"), { value: stdDefs.length });

  // Subjects (Class 10)
  const subjectDefs = [
    { id: 1, name: "Mathematics",    code: "MATH", standardId: 2, isActive: true },
    { id: 2, name: "Science",        code: "SCI",  standardId: 2, isActive: true },
    { id: 3, name: "Social Science", code: "SST",  standardId: 2, isActive: true },
    { id: 4, name: "English",        code: "ENG",  standardId: 2, isActive: true },
  ];
  subjectDefs.forEach((s) => batch.set(firestore.collection("subjects").doc(String(s.id)), { ...s, createdAt: now, updatedAt: now }));
  batch.set(firestore.collection("_counters").doc("subjects"), { value: subjectDefs.length });

  // Chapters (Math)
  const chapterDefs = [
    { id: 1, name: "Real Numbers",                   orderIndex: 1, subjectId: 1, isActive: true, syllabus: null },
    { id: 2, name: "Polynomials",                    orderIndex: 2, subjectId: 1, isActive: true, syllabus: null },
    { id: 3, name: "Quadratic Equations",            orderIndex: 3, subjectId: 1, isActive: true, syllabus: null },
    { id: 4, name: "Triangles",                      orderIndex: 4, subjectId: 1, isActive: true, syllabus: null },
    { id: 5, name: "Introduction to Trigonometry",   orderIndex: 5, subjectId: 1, isActive: true, syllabus: null },
  ];
  chapterDefs.forEach((c) => batch.set(firestore.collection("chapters").doc(String(c.id)), { ...c, createdAt: now, updatedAt: now }));
  batch.set(firestore.collection("_counters").doc("chapters"), { value: chapterDefs.length });

  // Topics (Real Numbers)
  const topicDefs = [
    { id: 1, name: "Euclid's Division Lemma",            description: "Divisibility and GCD using Euclidean algorithm", chapterId: 1, chapterName: "Real Numbers", isActive: true },
    { id: 2, name: "Fundamental Theorem of Arithmetic",  description: "Prime factorization theorem",                    chapterId: 1, chapterName: "Real Numbers", isActive: true },
    { id: 3, name: "Irrational Numbers",                 description: "Proving irrationality of numbers like √2",       chapterId: 1, chapterName: "Real Numbers", isActive: true },
    { id: 4, name: "Decimal Expansions",                 description: "Terminating and non-terminating decimals",       chapterId: 1, chapterName: "Real Numbers", isActive: true },
  ];
  topicDefs.forEach((t) => batch.set(firestore.collection("topics").doc(String(t.id)), { ...t, createdAt: now, updatedAt: now }));
  batch.set(firestore.collection("_counters").doc("topics"), { value: topicDefs.length });

  await batch.commit();
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

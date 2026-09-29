import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { Question } from "../api/studentApi";

export type QuestionState =
  | "NOT_VISITED"
  | "NOT_ANSWERED"
  | "ANSWERED"
  | "MARKED_FOR_REVIEW"
  | "ANSWERED_AND_MARKED";

export type SessionType = "practice" | "mock";

export interface ExamSession {
  sessionId: string;
  sessionType: SessionType;
  testId?: number;
  testTitle?: string;
  questions: Question[];
  currentIndex: number;
  answers: Record<number, string | string[]>;
  visited: Record<number, boolean>;
  markedForReview: Record<number, boolean>;
  timeSpentPerQuestion: Record<number, number>;
  startTime: number; // epoch ms
  remainingSeconds: number;
  totalSeconds: number;
  isActive: boolean;
  isSubmitted: boolean;
  subjectId?: number;
  chapterId?: number;
  topicId?: number;
  difficulty?: string;
  questionType?: string;
  lang?: string;
}

interface ExamStore {
  session: ExamSession | null;

  // Session lifecycle
  startSession: (
    type: SessionType,
    questions: Question[],
    durationSeconds: number,
    meta?: Partial<Pick<ExamSession, "testId" | "testTitle" | "subjectId" | "chapterId" | "topicId" | "difficulty" | "questionType" | "lang">>
  ) => void;
  endSession: () => void;
  clearSession: () => void;

  // Navigation
  setCurrentIndex: (index: number) => void;
  markVisited: (questionId: number) => void;

  // Answering
  setAnswer: (questionId: number, answer: string | string[]) => void;
  clearAnswer: (questionId: number) => void;
  toggleMarkForReview: (questionId: number) => void;

  // Timer
  tickTimer: () => void;
  setRemainingSeconds: (s: number) => void;

  // Time tracking
  addTimeSpent: (questionId: number, seconds: number) => void;

  // Submit
  markSubmitted: () => void;

  // Derived helpers
  getQuestionState: (questionId: number) => QuestionState;
  getAnsweredCount: () => number;
  getNotAnsweredCount: () => number;
  getMarkedCount: () => number;
  getNotVisitedCount: () => number;
}

let _sessionCounter = 0;

export const useExamStore = create<ExamStore>()(
  persist(
    (set, get) => ({
      session: null,

      startSession: (type, questions, durationSeconds, meta = {}) => {
        _sessionCounter++;
        const sessionId = `${type}_${Date.now()}_${_sessionCounter}`;
        set({
          session: {
            sessionId,
            sessionType: type,
            questions,
            currentIndex: 0,
            answers: {},
            visited: { [questions[0]?.id]: true },
            markedForReview: {},
            timeSpentPerQuestion: {},
            startTime: Date.now(),
            remainingSeconds: durationSeconds,
            totalSeconds: durationSeconds,
            isActive: true,
            isSubmitted: false,
            ...meta,
          },
        });
      },

      endSession: () => set((s) => s.session ? { session: { ...s.session, isActive: false } } : {}),
      clearSession: () => set({ session: null }),

      setCurrentIndex: (index) =>
        set((s) => {
          if (!s.session) return {};
          const q = s.session.questions[index];
          const visited = { ...s.session.visited };
          if (q) visited[q.id] = true;
          return { session: { ...s.session, currentIndex: index, visited } };
        }),

      markVisited: (questionId) =>
        set((s) => s.session ? { session: { ...s.session, visited: { ...s.session.visited, [questionId]: true } } } : {}),

      setAnswer: (questionId, answer) =>
        set((s) => s.session ? {
          session: {
            ...s.session,
            answers: { ...s.session.answers, [questionId]: answer },
            visited: { ...s.session.visited, [questionId]: true },
          },
        } : {}),

      clearAnswer: (questionId) =>
        set((s) => {
          if (!s.session) return {};
          const answers = { ...s.session.answers };
          delete answers[questionId];
          return { session: { ...s.session, answers } };
        }),

      toggleMarkForReview: (questionId) =>
        set((s) => {
          if (!s.session) return {};
          const marked = { ...s.session.markedForReview };
          marked[questionId] = !marked[questionId];
          return { session: { ...s.session, markedForReview: marked } };
        }),

      tickTimer: () =>
        set((s) => {
          if (!s.session || !s.session.isActive || s.session.remainingSeconds <= 0) return {};
          return { session: { ...s.session, remainingSeconds: s.session.remainingSeconds - 1 } };
        }),

      setRemainingSeconds: (remaining) =>
        set((s) => s.session ? { session: { ...s.session, remainingSeconds: remaining } } : {}),

      addTimeSpent: (questionId, seconds) =>
        set((s) => {
          if (!s.session) return {};
          const prev = s.session.timeSpentPerQuestion[questionId] ?? 0;
          return {
            session: {
              ...s.session,
              timeSpentPerQuestion: { ...s.session.timeSpentPerQuestion, [questionId]: prev + seconds },
            },
          };
        }),

      markSubmitted: () =>
        set((s) => s.session ? { session: { ...s.session, isSubmitted: true, isActive: false } } : {}),

      getQuestionState: (questionId) => {
        const s = get().session;
        if (!s) return "NOT_VISITED";
        const visited = s.visited[questionId];
        const answered = s.answers[questionId] !== undefined && s.answers[questionId] !== "" && (Array.isArray(s.answers[questionId]) ? (s.answers[questionId] as string[]).length > 0 : true);
        const marked = s.markedForReview[questionId];
        if (!visited) return "NOT_VISITED";
        if (answered && marked) return "ANSWERED_AND_MARKED";
        if (answered) return "ANSWERED";
        if (marked) return "MARKED_FOR_REVIEW";
        return "NOT_ANSWERED";
      },

      getAnsweredCount: () => {
        const s = get().session;
        if (!s) return 0;
        return s.questions.filter((q) => {
          const a = s.answers[q.id];
          if (a === undefined || a === "") return false;
          if (Array.isArray(a)) return a.length > 0;
          return true;
        }).length;
      },

      getNotAnsweredCount: () => {
        const s = get().session;
        if (!s) return 0;
        return s.questions.filter((q) => {
          const a = s.answers[q.id];
          if (a === undefined || a === "") return true;
          if (Array.isArray(a)) return a.length === 0;
          return false;
        }).length;
      },

      getMarkedCount: () => {
        const s = get().session;
        if (!s) return 0;
        return Object.values(s.markedForReview).filter(Boolean).length;
      },

      getNotVisitedCount: () => {
        const s = get().session;
        if (!s) return 0;
        return s.questions.filter((q) => !s.visited[q.id]).length;
      },
    }),
    {
      name: "kpark_exam_session",
      partialize: (state) => ({ session: state.session }),
    }
  )
);

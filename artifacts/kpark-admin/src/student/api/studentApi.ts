// Centralized Student API Service
const BASE_URL =
  (import.meta as any).env?.VITE_API_URL ??
  "https://api-ngogm3kh4a-el.a.run.app/api";

let _tokenGetter: (() => string | null) | null = null;
export function setStudentTokenGetter(fn: () => string | null) {
  _tokenGetter = fn;
}
function getToken(): string | null {
  return _tokenGetter ? _tokenGetter() : null;
}

async function apiFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = getToken();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...((options.headers as Record<string, string>) ?? {}),
  };
  if (token) headers["Authorization"] = `Bearer ${token}`;
  const res = await fetch(`${BASE_URL}${path}`, { ...options, headers });
  if (!res.ok) {
    let msg = `API error ${res.status}`;
    try { const b = await res.json(); msg = b.error ?? b.message ?? msg; } catch { /* */ }
    throw new Error(msg);
  }
  return res.json() as Promise<T>;
}

export interface Board { id: number; name: string; code?: string; }
export interface Standard { id: number; name: string; boardId?: number; }
export interface Topic { id: number; name: string; chapterId?: number; }
export interface Chapter { id: number; name: string; description?: string | null; questionCount: number; topics: Topic[]; }
export interface Subject { id: number; name: string; code?: string | null; totalQuestions: number; chaptersCount: number; chapters: Chapter[]; }
export interface Question {
  id: number;
  question: string;
  questionType: "SINGLE_CHOICE" | "MULTIPLE_CHOICE" | "TRUE_FALSE" | "NUMERICAL";
  difficulty: "EASY" | "MEDIUM" | "HARD";
  options?: string[];
  correctAnswer?: string;
  explanation?: string;
  imageUrl?: string | null;
  subjectId?: number;
  chapterId?: number;
  topicId?: number;
  subjectName?: string;
  chapterName?: string;
}
export interface BootstrapData { boards: Board[]; standards: Standard[]; subjects: Subject[]; chapters: Chapter[]; topics: Topic[]; totalQuestions: number; }
export interface StudentStats { totalAttempted: number; correctCount: number; accuracy: number; streakDays: number; }
export interface MockTest { id: number; title?: string; name?: string; totalMarks?: number; durationMinutes?: number; subjectId?: number; standardId?: number; boardId?: number; createdAt?: string; questions?: Question[]; questionCount?: number; }
export interface QuestionsResponse { data: Question[]; total: number; page: number; limit: number; }
export interface AttemptPayload { userId?: number | null; questionId: number; selectedOption: string; isCorrect: boolean; timeSpentSec: number; chapterId?: number | null; subjectId?: number | null; }
export interface LoginPayload { email: string; name: string; photoUrl?: string | null; boardId?: number | null; standardId?: number | null; }
export interface LoginResponse { token: string; user: { id: number; email: string; name: string; photoUrl?: string | null; role: string; boardId?: number | null; standardId?: number | null; }; }

export const studentApi = {
  bootstrap(): Promise<BootstrapData> { return apiFetch("/student/bootstrap"); },
  getCurriculum(p?: { boardId?: number; standardId?: number }): Promise<{ data: Subject[] }> {
    const qs = new URLSearchParams();
    if (p?.boardId) qs.set("boardId", String(p.boardId));
    if (p?.standardId) qs.set("standardId", String(p.standardId));
    const q = qs.toString();
    return apiFetch(`/student/curriculum-tree${q ? `?${q}` : ""}`);
  },
  getQuestions(p: { boardId?: number; standardId?: number; subjectId?: number; chapterId?: number; topicId?: number; difficulty?: string; questionType?: string; search?: string; lang?: string; page?: number; limit?: number; }): Promise<QuestionsResponse> {
    const qs = new URLSearchParams();
    Object.entries(p).forEach(([k, v]) => { if (v !== undefined && v !== null && v !== "") qs.set(k, String(v)); });
    return apiFetch(`/student/questions?${qs.toString()}`);
  },
  getStats(userId?: number): Promise<StudentStats> {
    const qs = userId ? `?userId=${userId}` : "";
    return apiFetch(`/student/stats${qs}`);
  },
  getMockTests(p?: { boardId?: number; standardId?: number; subjectId?: number }): Promise<{ data: MockTest[] }> {
    const qs = new URLSearchParams();
    if (p?.boardId) qs.set("boardId", String(p.boardId));
    if (p?.standardId) qs.set("standardId", String(p.standardId));
    if (p?.subjectId) qs.set("subjectId", String(p.subjectId));
    const q = qs.toString();
    return apiFetch(`/student/mock-tests${q ? `?${q}` : ""}`);
  },
  submitAttempt(payload: AttemptPayload): Promise<{ success: boolean; attemptId: number }> {
    return apiFetch("/student/submit-attempt", { method: "POST", body: JSON.stringify(payload) });
  },
  savePreferences(prefs: { boardId?: number | null; standardId?: number | null; preferredLanguage?: string; }): Promise<{ success: boolean }> {
    return apiFetch("/student/preferences", { method: "POST", body: JSON.stringify(prefs) });
  },
  loginGoogle(payload: LoginPayload): Promise<LoginResponse> {
    return apiFetch("/student/auth/google", { method: "POST", body: JSON.stringify(payload) });
  },
};

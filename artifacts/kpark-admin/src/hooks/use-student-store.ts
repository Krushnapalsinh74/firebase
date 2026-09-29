import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface StudentUser {
  id: number;
  email: string;
  name: string;
  photoUrl?: string | null;
  role: 'student' | 'user';
  boardId?: number | null;
  standardId?: number | null;
}

interface StudentState {
  token: string | null;
  student: StudentUser | null;
  selectedBoardId: number | null;
  selectedBoardName: string | null;
  selectedStandardId: number | null;
  selectedStandardName: string | null;
  preferredLanguage: string;
  hasCompletedOnboarding: boolean;
  streakDays: number;
  solvedCount: number;
  correctCount: number;

  setToken: (token: string | null) => void;
  setStudent: (student: StudentUser | null) => void;
  setBoardAndStandard: (boardId: number, boardName: string, standardId: number, standardName: string) => void;
  setPreferredLanguage: (lang: string) => void;
  recordAttempt: (isCorrect: boolean) => void;
  logoutStudent: () => void;
}

export const useStudentStore = create<StudentState>()(
  persist(
    (set) => ({
      token: null,
      student: null,
      selectedBoardId: null,
      selectedBoardName: null,
      selectedStandardId: null,
      selectedStandardName: null,
      preferredLanguage: 'en',
      hasCompletedOnboarding: false,
      streakDays: 0,
      solvedCount: 0,
      correctCount: 0,

      setToken: (token) => set({ token }),
      setStudent: (student) => set({ student }),
      setBoardAndStandard: (boardId, boardName, standardId, standardName) =>
        set({
          selectedBoardId: boardId,
          selectedBoardName: boardName,
          selectedStandardId: standardId,
          selectedStandardName: standardName,
          hasCompletedOnboarding: true,
        }),
      setPreferredLanguage: (preferredLanguage) => set({ preferredLanguage }),
      recordAttempt: (isCorrect) =>
        set((state) => ({
          solvedCount: state.solvedCount + 1,
          correctCount: state.correctCount + (isCorrect ? 1 : 0),
        })),
      logoutStudent: () => {
        try {
          localStorage.removeItem('kpark_student_storage');
          sessionStorage.clear();
        } catch (_) {}
        set({
          token: null,
          student: null,
          selectedBoardId: null,
          selectedBoardName: null,
          selectedStandardId: null,
          selectedStandardName: null,
          hasCompletedOnboarding: false,
          streakDays: 0,
          solvedCount: 0,
          correctCount: 0,
        });
      },
    }),
    {
      name: 'kpark_student_storage',
    }
  )
);

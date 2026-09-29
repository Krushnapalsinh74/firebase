import { create } from 'zustand';

export interface StudentUser {
  id: number;
  email: string;
  name: string;
  photoUrl?: string | null;
  role: string;
  boardId?: number | null;
  standardId?: number | null;
}

interface AuthState {
  token: string | null;
  user: StudentUser | null;
  setAuth: (token: string, user: StudentUser) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  token: null,
  user: null,
  setAuth: (token, user) => set({ token, user }),
  logout: () => set({ token: null, user: null }),
}));

export const API_BASE = 'https://api-ngogm3kh4a-el.a.run.app/api';

export interface AuthResponse {
  token: string;
  user: {
    id: number;
    email: string;
    name: string;
    photoUrl?: string | null;
    role: 'student' | 'user';
    boardId?: number | null;
    standardId?: number | null;
  };
}

export async function loginGoogleApi(payload: { email: string; name?: string; photoUrl?: string | null }): Promise<AuthResponse> {
  const res = await fetch(`${API_BASE}/student/auth/google`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || 'Google authentication failed');
  }

  return await res.json();
}

export async function loginEmailApi(payload: { email: string; password?: string }): Promise<AuthResponse> {
  const res = await fetch(`${API_BASE}/student/auth/google`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: payload.email,
      name: payload.email.split('@')[0],
    }),
  });

  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || 'Authentication failed');
  }

  return await res.json();
}

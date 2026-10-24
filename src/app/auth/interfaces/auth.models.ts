// Espejo de backend/src/auth/context.ts y backend/src/auth/session.ts.

export interface AuthContext {
  userId: string;
  role: 'admin' | 'client' | 'vendedor';
  clientId: number | null;
  fullName: string;
}

export interface SessionResult {
  accessToken: string;
  refreshToken: string;
  expiresAt: number | null;
  user: AuthContext;
}

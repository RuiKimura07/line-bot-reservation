// Redisの代わりにメモリでセッション管理（Render.com無料版用）
export interface SessionData {
  userId: string;
  state: 'selecting_date' | 'selecting_time' | 'confirming' | 'editing';
  selectedDate?: string;
  selectedTime?: string;
  guestCount?: number;
  specialRequests?: string;
  reservationId?: string;
  expiresAt: number;
}

class MemorySessionService {
  private sessions: Map<string, SessionData> = new Map();
  private cleanupInterval: NodeJS.Timeout;

  constructor() {
    // 30分ごとに期限切れセッションをクリーンアップ
    this.cleanupInterval = setInterval(() => {
      this.cleanup();
    }, 30 * 60 * 1000);
  }

  private cleanup(): void {
    const now = Date.now();
    for (const [key, session] of this.sessions.entries()) {
      if (session.expiresAt < now) {
        this.sessions.delete(key);
      }
    }
  }

  private getSessionKey(userId: string): string {
    return `session:${userId}`;
  }

  async setSession(userId: string, data: Omit<SessionData, 'expiresAt'>, ttl: number = 1800): Promise<void> {
    const key = this.getSessionKey(userId);
    const sessionData: SessionData = {
      ...data,
      expiresAt: Date.now() + (ttl * 1000)
    };
    this.sessions.set(key, sessionData);
  }

  async getSession(userId: string): Promise<SessionData | null> {
    const key = this.getSessionKey(userId);
    const session = this.sessions.get(key);
    
    if (!session) {
      return null;
    }

    if (session.expiresAt < Date.now()) {
      this.sessions.delete(key);
      return null;
    }

    return session;
  }

  async deleteSession(userId: string): Promise<void> {
    const key = this.getSessionKey(userId);
    this.sessions.delete(key);
  }

  async updateSession(userId: string, updates: Partial<SessionData>): Promise<SessionData | null> {
    const currentSession = await this.getSession(userId);
    if (!currentSession) {
      return null;
    }

    const updatedSession = { ...currentSession, ...updates };
    const key = this.getSessionKey(userId);
    this.sessions.set(key, updatedSession);
    return updatedSession;
  }

  async extendSession(userId: string, ttl: number = 1800): Promise<boolean> {
    const session = await this.getSession(userId);
    if (!session) {
      return false;
    }

    session.expiresAt = Date.now() + (ttl * 1000);
    const key = this.getSessionKey(userId);
    this.sessions.set(key, session);
    return true;
  }

  async healthCheck(): Promise<boolean> {
    return true;
  }

  async connect(): Promise<void> {
    // メモリ版なので接続不要
  }

  async disconnect(): Promise<void> {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
  }
}

export const memorySessionService = new MemorySessionService();

// Redis互換のエクスポート
export const redisService = memorySessionService;
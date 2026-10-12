/**
 * In-Memory Timer Registry (Single-Process Phase 2 Implementation)
 *
 * Coordinates question countdown deadlines using exact server timestamps.
 * When a question starts, a timeout is registered. If the timeout triggers
 * before the host explicitly closes the question, it triggers automatic closure.
 *
 * NOTE: Single-process only. Phase 3 introduces distributed Redis scheduling.
 */

type TimerCallback = (roomCode: string) => Promise<void> | void;

export class TimerManager {
  private timers = new Map<string, NodeJS.Timeout>();
  private onExpireCallback: TimerCallback | null = null;

  setExpirationHandler(callback: TimerCallback): void {
    this.onExpireCallback = callback;
  }

  scheduleQuestionTimer(roomCode: string, deadline: Date): void {
    this.clearTimer(roomCode);

    const now = Date.now();
    const delay = Math.max(0, deadline.getTime() - now);

    const timer = setTimeout(async () => {
      this.timers.delete(roomCode);
      if (this.onExpireCallback) {
        try {
          await this.onExpireCallback(roomCode);
        } catch (error) {
          console.error(`Error in automated timer expiration for room ${roomCode}:`, error);
        }
      }
    }, delay);

    this.timers.set(roomCode, timer);
  }

  clearTimer(roomCode: string): void {
    const existing = this.timers.get(roomCode);
    if (existing) {
      clearTimeout(existing);
      this.timers.delete(roomCode);
    }
  }

  clearAllTimers(): void {
    for (const [roomCode, timer] of this.timers.entries()) {
      clearTimeout(timer);
      this.timers.delete(roomCode);
    }
  }

  hasActiveTimer(roomCode: string): boolean {
    return this.timers.has(roomCode);
  }
}

export const timerManager = new TimerManager();

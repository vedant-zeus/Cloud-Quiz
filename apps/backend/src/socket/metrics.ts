export interface SocketMetrics {
  connectedSockets: number;
  activeSessions: number;
  connectedParticipants: number;
  acceptedAnswers: number;
  rejectedAnswers: number;
  invalidStateTransitions: number;
}

class MetricsRegistry {
  private metrics: SocketMetrics = {
    connectedSockets: 0,
    activeSessions: 0,
    connectedParticipants: 0,
    acceptedAnswers: 0,
    rejectedAnswers: 0,
    invalidStateTransitions: 0,
  };

  increment(key: keyof SocketMetrics, amount = 1): void {
    this.metrics[key] += amount;
  }

  decrement(key: keyof SocketMetrics, amount = 1): void {
    this.metrics[key] = Math.max(0, this.metrics[key] - amount);
  }

  getMetrics(): Readonly<SocketMetrics> {
    return { ...this.metrics };
  }

  reset(): void {
    this.metrics = {
      connectedSockets: 0,
      activeSessions: 0,
      connectedParticipants: 0,
      acceptedAnswers: 0,
      rejectedAnswers: 0,
      invalidStateTransitions: 0,
    };
  }
}

export const socketMetrics = new MetricsRegistry();

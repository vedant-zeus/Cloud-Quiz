import { io, Socket } from 'socket.io-client';
import { SafeRoomState, SafeQuestion, LeaderboardEntry, AnswerStats } from '../types';

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || 'http://localhost:4000';

class SocketService {
  private socket: Socket | null = null;

  connect(auth?: Record<string, unknown>): Socket {
    if (!this.socket || !this.socket.connected) {
      this.socket = io(SOCKET_URL, {
        withCredentials: true,
        transports: ['websocket', 'polling'],
        autoConnect: true,
        reconnection: true,
        reconnectionAttempts: 10,
        reconnectionDelay: 1000,
        auth: auth || {},
      });

      this.socket.on('connect', () => {
        console.log('✅ Connected to CloudQuiz live socket server:', this.socket?.id);
      });

      this.socket.on('disconnect', (reason) => {
        console.log('🔌 Disconnected from CloudQuiz socket:', reason);
      });

      this.socket.on('connect_error', (err) => {
        console.warn('⚠️ Socket connection error:', err.message);
      });
    } else if (auth) {
      this.socket.auth = auth;
    }

    return this.socket;
  }

  getSocket(): Socket | null {
    return this.socket;
  }

  disconnect(): void {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
  }

  // Promise-based event emission with acknowledgements
  private emitWithAck<T = unknown>(event: string, payload: unknown): Promise<T> {
    return new Promise((resolve, reject) => {
      if (!this.socket) {
        return reject(new Error('Socket is not connected'));
      }

      this.socket.emit(
        event,
        payload,
        (response: { success: boolean; data?: T; error?: { code: string; message: string } }) => {
          if (!response) {
            return resolve(undefined as T);
          }
          if (response.success) {
            resolve(response.data as T);
          } else {
            reject(new Error(response.error?.message || 'Operation failed'));
          }
        }
      );
    });
  }

  async joinRoom(roomCode: string, displayName: string): Promise<{
    participantId: string;
    token: string;
    roomState: SafeRoomState;
  }> {
    return this.emitWithAck('room:join', { roomCode, displayName });
  }

  async syncRoom(roomCode: string, token?: string): Promise<{ roomState: SafeRoomState }> {
    return this.emitWithAck('room:sync', { roomCode, token });
  }

  async startQuiz(roomCode: string): Promise<{ question: SafeQuestion; deadline: string }> {
    return this.emitWithAck('quiz:start', { roomCode });
  }

  async submitAnswer(
    roomCode: string,
    questionId: string,
    selectedOption: number,
    submissionId: string,
    token: string
  ): Promise<{ isCorrect: boolean; pointsAwarded: number }> {
    return this.emitWithAck('answer:submit', {
      roomCode,
      questionId,
      selectedOption,
      submissionId,
      token,
    });
  }

  async closeQuestion(roomCode: string): Promise<unknown> {
    return this.emitWithAck('question:close', { roomCode });
  }

  async nextQuestion(roomCode: string): Promise<{ isComplete: boolean; question?: SafeQuestion; leaderboard?: LeaderboardEntry[] }> {
    return this.emitWithAck('question:next', { roomCode });
  }

  async endQuiz(roomCode: string): Promise<{ leaderboard: LeaderboardEntry[] }> {
    return this.emitWithAck('quiz:end', { roomCode });
  }

  // Listener subscriptions
  onParticipantCount(callback: (data: { count: number }) => void): () => void {
    this.socket?.on('room:participant-count', callback);
    return () => this.socket?.off('room:participant-count', callback);
  }

  onRoomState(callback: (state: SafeRoomState) => void): () => void {
    this.socket?.on('room:state', callback);
    return () => this.socket?.off('room:state', callback);
  }

  onQuizStarted(callback: (data: { roomCode: string }) => void): () => void {
    this.socket?.on('quiz:started', callback);
    return () => this.socket?.off('quiz:started', callback);
  }

  onQuestionStarted(callback: (question: SafeQuestion) => void): () => void {
    this.socket?.on('question:started', callback);
    return () => this.socket?.off('question:started', callback);
  }

  onQuestionEnded(
    callback: (data: {
      questionId: string;
      correctAnswer: number;
      stats: AnswerStats;
      questionNumber: number;
      totalQuestions: number;
    }) => void
  ): () => void {
    this.socket?.on('question:ended', callback);
    return () => this.socket?.off('question:ended', callback);
  }

  onLeaderboardUpdate(callback: (data: { leaderboard: LeaderboardEntry[] }) => void): () => void {
    this.socket?.on('leaderboard:update', callback);
    return () => this.socket?.off('leaderboard:update', callback);
  }

  onQuizEnded(callback: (data: { roomCode: string; leaderboard: LeaderboardEntry[] }) => void): () => void {
    this.socket?.on('quiz:ended', callback);
    return () => this.socket?.off('quiz:ended', callback);
  }

  onError(callback: (error: { code: string; message: string }) => void): () => void {
    this.socket?.on('server:error', callback);
    return () => this.socket?.off('server:error', callback);
  }
}

export const socketService = new SocketService();

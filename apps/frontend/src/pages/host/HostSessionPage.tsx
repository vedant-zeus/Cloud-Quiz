import React, { useState, useEffect, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  Users,
  Copy,
  Check,
  Play,
  StopCircle,
  Clock,
  Award,
  ChevronRight,
  Sparkles,
  ArrowLeft,
  Trophy,
  AlertCircle,
  Medal,
} from 'lucide-react';
import { socketService } from '../../services/socketService';
import { sessionApi } from '../../services/sessionApi';
import { SafeRoomState, AnswerStats } from '../../types';
import { Card } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { LoadingSkeleton } from '../../components/ui/LoadingSkeleton';

export const HostSessionPage: React.FC = () => {
  const { roomCode } = useParams<{ roomCode: string }>();

  const [roomState, setRoomState] = useState<SafeRoomState | null>(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Synchronized countdown timer state
  const [timeLeft, setTimeLeft] = useState<number | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const cleanRoomCode = (roomCode || '').toUpperCase();

  // Connect socket and sync room state
  useEffect(() => {
    if (!cleanRoomCode) return;

    socketService.connect();

    // Sync room initial state
    socketService
      .syncRoom(cleanRoomCode)
      .then((data) => {
        setRoomState(data.roomState);
        setLoading(false);
      })
      .catch((err) => {
        setErrorMessage(err.message || 'Failed to sync room state');
        setLoading(false);
      });

    // Listeners
    const unsubCount = socketService.onParticipantCount((data) => {
      setRoomState((prev) => (prev ? { ...prev, participantCount: data.count } : null));
    });

    const unsubState = socketService.onRoomState((state) => {
      setRoomState(state);
    });

    const unsubQStart = socketService.onQuestionStarted((question) => {
      setRoomState((prev) =>
        prev
          ? {
              ...prev,
              status: 'QUESTION_ACTIVE',
              currentQuestion: question,
              currentQuestionIndex: question.questionNumber - 1,
              questionDeadline: question.questionDeadline,
              closedQuestion: null,
            }
          : null
      );
    });

    const unsubQEnd = socketService.onQuestionEnded((data) => {
      setRoomState((prev) =>
        prev
          ? {
              ...prev,
              status: 'QUESTION_CLOSED',
              questionDeadline: null,
              closedQuestion: {
                questionId: data.questionId,
                correctAnswer: data.correctAnswer,
                stats: data.stats,
              },
            }
          : null
      );
    });

    const unsubLb = socketService.onLeaderboardUpdate((data) => {
      setRoomState((prev) => (prev ? { ...prev, leaderboard: data.leaderboard } : null));
    });

    const unsubEnd = socketService.onQuizEnded((data) => {
      setRoomState((prev) =>
        prev
          ? {
              ...prev,
              status: 'COMPLETED',
              questionDeadline: null,
              leaderboard: data.leaderboard,
            }
          : null
      );
    });

    const unsubErr = socketService.onError((err) => {
      setErrorMessage(err.message);
    });

    return () => {
      unsubCount();
      unsubState();
      unsubQStart();
      unsubQEnd();
      unsubLb();
      unsubEnd();
      unsubErr();
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [cleanRoomCode]);

  // Handle countdown calculation based on server questionDeadline
  useEffect(() => {
    if (timerRef.current) clearInterval(timerRef.current);

    if (roomState?.status === 'QUESTION_ACTIVE' && roomState.questionDeadline) {
      const deadlineMs = new Date(roomState.questionDeadline).getTime();

      const updateTimer = () => {
        const remaining = Math.max(0, Math.ceil((deadlineMs - Date.now()) / 1000));
        setTimeLeft(remaining);
        if (remaining <= 0 && timerRef.current) {
          clearInterval(timerRef.current);
        }
      };

      updateTimer();
      timerRef.current = setInterval(updateTimer, 500);
    } else {
      setTimeLeft(null);
    }

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [roomState?.status, roomState?.questionDeadline]);

  const handleCopyCode = () => {
    if (!cleanRoomCode) return;
    navigator.clipboard.writeText(cleanRoomCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleStartQuiz = async () => {
    try {
      setActionLoading(true);
      setErrorMessage(null);
      await socketService.startQuiz(cleanRoomCode);
    } catch (err: unknown) {
      setErrorMessage((err as Error).message || 'Failed to start quiz');
    } finally {
      setActionLoading(false);
    }
  };

  const handleCloseQuestion = async () => {
    try {
      setActionLoading(true);
      setErrorMessage(null);
      await socketService.closeQuestion(cleanRoomCode);
    } catch (err: unknown) {
      setErrorMessage((err as Error).message || 'Failed to close question');
    } finally {
      setActionLoading(false);
    }
  };

  const handleNextQuestion = async () => {
    try {
      setActionLoading(true);
      setErrorMessage(null);
      await socketService.nextQuestion(cleanRoomCode);
    } catch (err: unknown) {
      setErrorMessage((err as Error).message || 'Failed to advance question');
    } finally {
      setActionLoading(false);
    }
  };

  const handleEndQuiz = async () => {
    if (!window.confirm('Are you sure you want to end this competition session now?')) return;
    try {
      setActionLoading(true);
      setErrorMessage(null);
      await socketService.endQuiz(cleanRoomCode);
    } catch (err: unknown) {
      setErrorMessage((err as Error).message || 'Failed to end competition');
    } finally {
      setActionLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="max-w-5xl mx-auto space-y-6 animate-pulse p-4">
        <LoadingSkeleton className="h-10 w-1/3" />
        <LoadingSkeleton className="h-64 w-full rounded-2xl" />
      </div>
    );
  }

  if (!roomState) {
    return (
      <Card className="p-8 text-center bg-white max-w-lg mx-auto">
        <h3 className="text-lg font-bold text-slate-900">Room not found</h3>
        <p className="text-sm text-slate-500 mt-1">Unable to locate competition room "{cleanRoomCode}".</p>
        <Link to="/quizzes" className="mt-4 inline-block">
          <Button variant="primary">Return to Quizzes</Button>
        </Link>
      </Card>
    );
  }

  const { status, quizTitle, participantCount, currentQuestion, closedQuestion, leaderboard } = roomState;
  const isLastQuestion = (roomState.currentQuestionIndex + 1) >= roomState.totalQuestions;

  return (
    <div className="max-w-5xl mx-auto space-y-6 pb-12 animate-in fade-in duration-200">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-sm">
        <div className="flex items-center gap-3">
          <Link
            to="/quizzes"
            className="p-2 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition"
          >
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-lg font-bold text-slate-900 tracking-tight">{quizTitle}</h1>
              <Badge status={status} />
            </div>
            <p className="text-xs text-slate-500 flex items-center gap-2 mt-0.5">
              <span>Room Code: <strong className="text-indigo-600 font-mono tracking-wider">{cleanRoomCode}</strong></span>
              <span>•</span>
              <span className="flex items-center gap-1">
                <Users className="h-3.5 w-3.5 text-slate-400" />
                {participantCount} {participantCount === 1 ? 'Player' : 'Players'}
              </span>
            </p>
          </div>
        </div>

        {status !== 'COMPLETED' && (
          <Button
            variant="outline"
            size="sm"
            onClick={handleEndQuiz}
            loading={actionLoading}
            icon={<StopCircle className="h-4 w-4 text-rose-500" />}
            className="text-rose-600 hover:bg-rose-50 hover:border-rose-300 self-start sm:self-auto"
          >
            End Competition
          </Button>
        )}
      </div>

      {/* Error Alert */}
      {errorMessage && (
        <div className="flex items-center justify-between gap-2 p-3.5 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700">
          <div className="flex items-center gap-2">
            <AlertCircle className="h-4 w-4 shrink-0 text-rose-600" />
            <span>{errorMessage}</span>
          </div>
          <button onClick={() => setErrorMessage(null)} className="font-semibold underline">
            Dismiss
          </button>
        </div>
      )}

      {/* ========================================================================= */}
      {/* PHASE 1: WAITING / LOBBY SCREEN                                           */}
      {/* ========================================================================= */}
      {status === 'WAITING' && (
        <div className="space-y-6">
          {/* Hero Lobby Card */}
          <Card className="p-8 sm:p-12 text-center bg-white border border-slate-200 shadow-md">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-indigo-50 text-indigo-700 text-xs font-semibold mb-3 border border-indigo-100">
              <Sparkles className="h-3.5 w-3.5" />
              <span>Live Room Lobby</span>
            </div>

            <h2 className="text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight">
              Join Code for Competitors
            </h2>
            <p className="text-sm text-slate-500 mt-1 max-w-md mx-auto">
              Share this 6-character room code on the stage screen or projector:
            </p>

            {/* Room Code Big Display */}
            <div className="my-8 inline-flex items-center gap-4 bg-slate-900 text-white px-8 py-5 rounded-2xl shadow-xl">
              <span className="font-mono text-4xl sm:text-5xl font-black tracking-widest text-indigo-300">
                {cleanRoomCode}
              </span>
              <button
                onClick={handleCopyCode}
                className="p-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition"
                title="Copy Room Code"
              >
                {copied ? <Check className="h-5 w-5 text-emerald-400" /> : <Copy className="h-5 w-5" />}
              </button>
            </div>

            {/* Participant Status */}
            <div className="flex items-center justify-center gap-2 text-sm text-slate-600 font-medium mb-6">
              <Users className="h-4 w-4 text-indigo-600" />
              <span>
                <strong>{participantCount}</strong> participant{participantCount === 1 ? '' : 's'} joined and waiting
              </span>
            </div>

            {/* Start Button */}
            <div>
              <Button
                variant="primary"
                size="lg"
                onClick={handleStartQuiz}
                loading={actionLoading}
                icon={<Play className="h-5 w-5 fill-current" />}
                className="px-8 py-3 text-base font-bold shadow-lg shadow-indigo-500/25"
              >
                Start Quiz Now
              </Button>
            </div>
          </Card>
        </div>
      )}

      {/* ========================================================================= */}
      {/* PHASE 2: QUESTION ACTIVE SCREEN                                           */}
      {/* ========================================================================= */}
      {status === 'QUESTION_ACTIVE' && currentQuestion && (
        <div className="space-y-6">
          <Card className="p-6 sm:p-8 bg-white border border-slate-200 shadow-md">
            {/* Top Bar: Progress, Points, Countdown */}
            <div className="flex items-center justify-between border-b border-slate-100 pb-4 mb-6">
              <div className="flex items-center gap-3">
                <span className="text-xs font-bold uppercase tracking-wider text-indigo-600 bg-indigo-50 px-3 py-1 rounded-full border border-indigo-100">
                  Question {currentQuestion.questionNumber} of {currentQuestion.totalQuestions}
                </span>
                <span className="text-xs font-semibold text-amber-600 bg-amber-50 px-2.5 py-1 rounded-md border border-amber-200 flex items-center gap-1">
                  <Award className="h-3.5 w-3.5" />
                  {currentQuestion.points} Pts
                </span>
              </div>

              {/* Countdown Timer */}
              {timeLeft !== null && (
                <div
                  className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-bold border transition-colors ${
                    timeLeft <= 5
                      ? 'bg-rose-50 text-rose-600 border-rose-300 animate-pulse'
                      : 'bg-slate-100 text-slate-700 border-slate-300'
                  }`}
                >
                  <Clock className="h-4 w-4" />
                  <span>{timeLeft}s</span>
                </div>
              )}
            </div>

            {/* Question Text */}
            <h2 className="text-xl sm:text-2xl font-bold text-slate-900 leading-snug mb-8">
              {currentQuestion.text}
            </h2>

            {/* Options Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 mb-8">
              {currentQuestion.options.map((opt, idx) => (
                <div
                  key={idx}
                  className="flex items-center gap-3.5 p-4 rounded-xl border border-slate-200 bg-slate-50 text-slate-800 text-sm font-medium"
                >
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white text-slate-700 font-bold border border-slate-300">
                    {String.fromCharCode(65 + idx)}
                  </span>
                  <span className="flex-1">{opt}</span>
                </div>
              ))}
            </div>

            {/* Host Controls */}
            <div className="flex items-center justify-between pt-4 border-t border-slate-100">
              <span className="text-xs text-slate-400">
                Timer will automatically close question upon deadline expiry.
              </span>
              <Button
                variant="outline"
                size="md"
                onClick={handleCloseQuestion}
                loading={actionLoading}
                className="text-amber-700 hover:bg-amber-50 border-amber-300"
              >
                Close Question Early
              </Button>
            </div>
          </Card>
        </div>
      )}

      {/* ========================================================================= */}
      {/* PHASE 3: QUESTION CLOSED / RESULTS SCREEN                                 */}
      {/* ========================================================================= */}
      {status === 'QUESTION_CLOSED' && closedQuestion && (
        <div className="space-y-6">
          <Card className="p-6 sm:p-8 bg-white border border-slate-200 shadow-md">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4 mb-6">
              <span className="text-xs font-bold uppercase tracking-wider text-emerald-700 bg-emerald-50 px-3 py-1 rounded-full border border-emerald-200">
                Question Closed • Answer Revealed
              </span>
              <Button
                variant="primary"
                size="md"
                onClick={handleNextQuestion}
                loading={actionLoading}
                icon={<ChevronRight className="h-4 w-4" />}
              >
                {isLastQuestion ? 'Finish Competition & View Final Results' : 'Next Question'}
              </Button>
            </div>

            {/* Answer Statistics Bar Chart */}
            <div className="space-y-3 mb-8">
              <h3 className="text-sm font-bold text-slate-700 uppercase tracking-wider">
                Response Statistics ({closedQuestion.stats.totalAnswered} Total Submissions)
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {[0, 1, 2, 3].map((optIdx) => {
                  const isCorrect = closedQuestion.correctAnswer === optIdx;
                  const count =
                    closedQuestion.stats[`option${optIdx}` as keyof AnswerStats] || 0;
                  const pct =
                    closedQuestion.stats.totalAnswered > 0
                      ? Math.round((count / closedQuestion.stats.totalAnswered) * 100)
                      : 0;
                  return (
                    <div
                      key={optIdx}
                      className={`p-3.5 rounded-xl border relative overflow-hidden ${
                        isCorrect
                          ? 'border-emerald-300 bg-emerald-50/70 text-emerald-950 font-semibold'
                          : 'border-slate-200 bg-slate-50 text-slate-700'
                      }`}
                    >
                      {/* Background fill percentage bar */}
                      <div
                        className={`absolute left-0 top-0 bottom-0 opacity-15 ${
                          isCorrect ? 'bg-emerald-600' : 'bg-slate-400'
                        }`}
                        style={{ width: `${pct}%` }}
                      />
                      <div className="relative flex items-center justify-between text-xs">
                        <div className="flex items-center gap-2">
                          <span
                            className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-md font-bold text-xs ${
                              isCorrect
                                ? 'bg-emerald-600 text-white'
                                : 'bg-white text-slate-600 border border-slate-300'
                            }`}
                          >
                            {String.fromCharCode(65 + optIdx)}
                          </span>
                          <span>Option {String.fromCharCode(65 + optIdx)}</span>
                          {isCorrect && (
                            <span className="text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 bg-emerald-200/80 text-emerald-800 rounded">
                              Correct Answer
                            </span>
                          )}
                        </div>
                        <span className="font-bold">
                          {count} ({pct}%)
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Current Leaderboard Standings */}
            {leaderboard && leaderboard.length > 0 && (
              <div className="space-y-3 pt-6 border-t border-slate-100">
                <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider flex items-center gap-2">
                  <Trophy className="h-4 w-4 text-amber-500" />
                  <span>Current Leaderboard Standings</span>
                </h3>
                <div className="overflow-hidden rounded-xl border border-slate-200">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold uppercase">
                      <tr>
                        <th className="py-2.5 px-4 w-16">Rank</th>
                        <th className="py-2.5 px-4">Participant</th>
                        <th className="py-2.5 px-4 text-right">Total Score</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 bg-white">
                      {leaderboard.map((entry) => (
                        <tr key={entry.participantId} className="hover:bg-slate-50/60">
                          <td className="py-2.5 px-4 font-bold text-slate-900">
                            {entry.rank === 1 ? '🥇 1' : entry.rank === 2 ? '🥈 2' : entry.rank === 3 ? '🥉 3' : entry.rank}
                          </td>
                          <td className="py-2.5 px-4 font-medium text-slate-800">
                            {entry.displayName}
                          </td>
                          <td className="py-2.5 px-4 text-right font-bold text-indigo-600">
                            {entry.score} pts
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </Card>
        </div>
      )}

      {/* ========================================================================= */}
      {/* PHASE 4: COMPLETED / FINAL STANDINGS SCREEN                               */}
      {/* ========================================================================= */}
      {status === 'COMPLETED' && (
        <Card className="p-8 sm:p-12 bg-white border border-slate-200 shadow-xl text-center space-y-8">
          <div>
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-amber-50 text-amber-500 border border-amber-200 mb-4 shadow-sm">
              <Trophy className="h-8 w-8" />
            </div>
            <h2 className="text-3xl font-extrabold text-slate-900 tracking-tight">
              Competition Completed!
            </h2>
            <p className="text-sm text-slate-500 mt-1">
              Final standings for {quizTitle}
            </p>
          </div>

          {/* Top 3 Podium */}
          {leaderboard && leaderboard.length > 0 && (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 max-w-2xl mx-auto items-end pt-4">
              {/* Silver / 2nd Place */}
              {leaderboard[1] && (
                <div className="p-5 rounded-2xl bg-slate-50 border border-slate-200 text-center order-2 sm:order-1">
                  <div className="flex justify-center mb-2">
                    <Medal className="h-8 w-8 text-slate-400" />
                  </div>
                  <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">2nd Place</span>
                  <h4 className="text-base font-bold text-slate-900 mt-1 truncate">{leaderboard[1].displayName}</h4>
                  <p className="text-sm font-extrabold text-indigo-600 mt-0.5">{leaderboard[1].score} pts</p>
                </div>
              )}

              {/* Gold / 1st Place */}
              {leaderboard[0] && (
                <div className="p-6 rounded-2xl bg-amber-50/80 border-2 border-amber-300 text-center order-1 sm:order-2 shadow-lg shadow-amber-500/10">
                  <div className="flex justify-center mb-2">
                    <Trophy className="h-10 w-10 text-amber-500" />
                  </div>
                  <span className="text-xs font-bold text-amber-700 uppercase tracking-wider">Champion</span>
                  <h4 className="text-lg font-black text-slate-900 mt-1 truncate">{leaderboard[0].displayName}</h4>
                  <p className="text-base font-black text-amber-600 mt-0.5">{leaderboard[0].score} pts</p>
                </div>
              )}

              {/* Bronze / 3rd Place */}
              {leaderboard[2] && (
                <div className="p-5 rounded-2xl bg-slate-50 border border-slate-200 text-center order-3 sm:order-3">
                  <div className="flex justify-center mb-2">
                    <Medal className="h-8 w-8 text-amber-700/60" />
                  </div>
                  <span className="text-xs font-bold text-amber-800/60 uppercase tracking-wider">3rd Place</span>
                  <h4 className="text-base font-bold text-slate-900 mt-1 truncate">{leaderboard[2].displayName}</h4>
                  <p className="text-sm font-extrabold text-indigo-600 mt-0.5">{leaderboard[2].score} pts</p>
                </div>
              )}
            </div>
          )}

          {/* Full Standings Table */}
          {leaderboard && (
            <div className="max-w-2xl mx-auto text-left">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3">
                Full Final Standings ({leaderboard.length} Total Competitors)
              </h3>
              <div className="overflow-hidden rounded-xl border border-slate-200">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold uppercase">
                    <tr>
                      <th className="py-2.5 px-4 w-16">Rank</th>
                      <th className="py-2.5 px-4">Participant</th>
                      <th className="py-2.5 px-4 text-right">Final Score</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 bg-white">
                    {leaderboard.map((entry) => (
                      <tr key={entry.participantId} className="hover:bg-slate-50/60">
                        <td className="py-2.5 px-4 font-bold text-slate-900">
                          {entry.rank === 1 ? '🥇 1' : entry.rank === 2 ? '🥈 2' : entry.rank === 3 ? '🥉 3' : entry.rank}
                        </td>
                        <td className="py-2.5 px-4 font-semibold text-slate-800">
                          {entry.displayName}
                        </td>
                        <td className="py-2.5 px-4 text-right font-black text-indigo-600">
                          {entry.score} pts
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          <div className="pt-6 flex flex-col sm:flex-row items-center justify-center gap-3">
            <Link to={`/host/session/${cleanRoomCode}/analytics`}>
              <Button variant="primary" size="lg">
                View Full Competition Analytics &rarr;
              </Button>
            </Link>
            <a
              href={sessionApi.getLeaderboardCsvUrl(cleanRoomCode)}
              download={`leaderboard-${cleanRoomCode}.csv`}
            >
              <Button variant="outline" size="lg">
                Download Leaderboard CSV
              </Button>
            </a>
            <Link to="/dashboard">
              <Button variant="ghost" size="lg">
                Return to Dashboard
              </Button>
            </Link>
          </div>
        </Card>
      )}
    </div>
  );
};

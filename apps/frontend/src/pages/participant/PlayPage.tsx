import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  Sparkles,
  Users,
  Clock,
  CheckCircle,
  XCircle,
  Trophy,
  AlertCircle,
  Crown,
  BarChart2,
} from 'lucide-react';
import { socketService } from '../../services/socketService';
import { sessionApi } from '../../services/sessionApi';
import {
  SafeRoomState,
  SafeQuestion,
  LeaderboardEntry,
  AnswerStats,
  ParticipantResult,
} from '../../types';
import { Podium } from '../../components/analytics/Podium';
import { Button } from '../../components/ui/Button';

interface StoredParticipantSession {
  roomCode: string;
  participantId: string;
  displayName: string;
  token: string;
}

export const PlayPage: React.FC = () => {
  const { roomCode = '' } = useParams<{ roomCode: string }>();
  const navigate = useNavigate();

  // Participant identity from session storage
  const [session, setSession] = useState<StoredParticipantSession | null>(null);

  // Room state
  const [roomState, setRoomState] = useState<SafeRoomState | null>(null);
  const [participantCount, setParticipantCount] = useState<number>(1);
  const [currentQuestion, setCurrentQuestion] = useState<SafeQuestion | null>(null);
  const [remainingSeconds, setRemainingSeconds] = useState<number>(0);
  const [isTimeUp, setIsTimeUp] = useState<boolean>(false);

  // Answering state
  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  const [hasSubmitted, setHasSubmitted] = useState<boolean>(false);
  const [submissionFeedback, setSubmissionFeedback] = useState<{
    isCorrect?: boolean;
    pointsAwarded?: number;
  } | null>(null);

  // Closed question results
  const [questionResult, setQuestionResult] = useState<{
    correctAnswer: number;
    stats?: AnswerStats;
  } | null>(null);

  // Leaderboard
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [currentScore, setCurrentScore] = useState<number>(0);
  const [participantResult, setParticipantResult] = useState<ParticipantResult | null>(null);

  // Error alert
  const [error, setError] = useState<string | null>(null);

  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // Countdown timer calculator based on server deadline
  const updateCountdown = useCallback((deadlineStr?: string | null) => {
    if (!deadlineStr) {
      setRemainingSeconds(0);
      setIsTimeUp(true);
      return;
    }

    const deadlineMs = new Date(deadlineStr).getTime();
    const now = Date.now();
    const diff = Math.max(0, Math.ceil((deadlineMs - now) / 1000));
    setRemainingSeconds(diff);
    setIsTimeUp(diff <= 0);
  }, []);

  // Initialize participant and sync state
  useEffect(() => {
    const rawSession = sessionStorage.getItem(`cloudquiz_participant_${roomCode.toUpperCase()}`);
    if (!rawSession) {
      navigate(`/join?code=${roomCode}`);
      return;
    }

    try {
      const parsed: StoredParticipantSession = JSON.parse(rawSession);
      setSession(parsed);

      // Connect socket with participant auth token
      socketService.connect({
        token: parsed.token,
        participantId: parsed.participantId,
        roomCode: parsed.roomCode,
      });

      // Synchronize initial state
      socketService
        .syncRoom(parsed.roomCode, parsed.token)
        .then((syncRes) => {
          const state = syncRes.roomState;
          setRoomState(state);
          setParticipantCount(state.participantCount);
          if (state.myScore !== undefined) {
            setCurrentScore(state.myScore);
          }
          if (state.hasAnsweredCurrent) {
            setHasSubmitted(true);
          }
          if (state.selectedOption !== undefined && state.selectedOption !== null) {
            setSelectedOption(state.selectedOption);
          }
          if (state.currentQuestion) {
            setCurrentQuestion(state.currentQuestion);
            updateCountdown(state.currentQuestion.questionDeadline || state.questionDeadline);
          }
          if (state.closedQuestion) {
            setQuestionResult({
              correctAnswer: state.closedQuestion.correctAnswer,
              stats: state.closedQuestion.stats,
            });
            if (state.closedQuestion.isCorrect !== undefined) {
              setSubmissionFeedback({
                isCorrect: state.closedQuestion.isCorrect,
                pointsAwarded: state.closedQuestion.pointsAwarded,
              });
            }
          }
          if (state.leaderboard) {
            setLeaderboard(state.leaderboard);
          }
          if (state.status === 'COMPLETED') {
            sessionApi
              .getParticipantResults(parsed.roomCode, parsed.token)
              .then(setParticipantResult)
              .catch((e) => console.warn('Could not load participant results on sync:', e));
          }
        })
        .catch((err) => {
          console.warn('Sync failed:', err);
          setError(err.message || 'Failed to synchronize with game room.');
        });

      // Subscribe to real-time events
      const unsubscribeCount = socketService.onParticipantCount(({ count }) => {
        setParticipantCount(count);
      });

      const unsubscribeRoomState = socketService.onRoomState((updatedState) => {
        setRoomState(updatedState);
        setParticipantCount(updatedState.participantCount);
        if (updatedState.myScore !== undefined) {
          setCurrentScore(updatedState.myScore);
        }
      });

      const unsubscribeQuizStarted = socketService.onQuizStarted(() => {
        setRoomState((prev) => (prev ? { ...prev, status: 'QUESTION_ACTIVE' } : null));
      });

      const unsubscribeQuestionStarted = (question: SafeQuestion) => {
        setCurrentQuestion(question);
        setSelectedOption(null);
        setHasSubmitted(false);
        setSubmissionFeedback(null);
        setQuestionResult(null);
        setIsTimeUp(false);
        const deadline = question.questionDeadline || (question as unknown as { deadline?: string }).deadline;
        updateCountdown(deadline);
        setRoomState((prev) => (prev ? { ...prev, status: 'QUESTION_ACTIVE', currentQuestion: question } : null));
      };
      const subQuestionStarted = socketService.onQuestionStarted(unsubscribeQuestionStarted);

      const unsubscribeQuestionEnded = socketService.onQuestionEnded((data) => {
        setQuestionResult({
          correctAnswer: data.correctAnswer,
          stats: data.stats,
        });
        setIsTimeUp(true);
        setRoomState((prev) => (prev ? { ...prev, status: 'QUESTION_CLOSED' } : null));
      });

      const unsubscribeLeaderboard = socketService.onLeaderboardUpdate((data) => {
        setLeaderboard(data.leaderboard);
        const myEntry = data.leaderboard.find((p) => p.participantId === parsed.participantId);
        if (myEntry) {
          setCurrentScore(myEntry.score);
        }
      });

      const unsubscribeQuizEnded = socketService.onQuizEnded((data) => {
        setLeaderboard(data.leaderboard);
        setRoomState((prev) => (prev ? { ...prev, status: 'COMPLETED' } : null));
        sessionApi
          .getParticipantResults(parsed.roomCode, parsed.token)
          .then(setParticipantResult)
          .catch((e) => console.warn('Could not load participant results:', e));
      });

      const unsubscribeError = socketService.onError((err) => {
        setError(err.message);
      });

      return () => {
        unsubscribeCount();
        unsubscribeRoomState();
        unsubscribeQuizStarted();
        subQuestionStarted();
        unsubscribeQuestionEnded();
        unsubscribeLeaderboard();
        unsubscribeQuizEnded();
        unsubscribeError();
      };
    } catch {
      navigate(`/join?code=${roomCode}`);
    }
  }, [roomCode, navigate, updateCountdown]);

  // Periodic interval to update countdown locally based on absolute deadline
  useEffect(() => {
    const deadline = currentQuestion?.questionDeadline || (currentQuestion as unknown as { deadline?: string })?.deadline;
    if (roomState?.status === 'QUESTION_ACTIVE' && deadline) {
      timerRef.current = setInterval(() => {
        updateCountdown(deadline);
      }, 500);

      return () => {
        if (timerRef.current) clearInterval(timerRef.current);
      };
    }
  }, [roomState?.status, currentQuestion, updateCountdown]);

  // Handle answering
  const handleSubmitAnswer = async (optionIndex: number) => {
    if (!session || !currentQuestion || hasSubmitted || isTimeUp) return;

    try {
      setSelectedOption(optionIndex);
      setHasSubmitted(true);
      setError(null);

      const submissionId = crypto.randomUUID ? crypto.randomUUID() : `sub-${Date.now()}-${Math.random()}`;
      const result = await socketService.submitAnswer(
        session.roomCode,
        currentQuestion.id,
        optionIndex,
        submissionId,
        session.token
      );

      setSubmissionFeedback(result);
      if (result.pointsAwarded > 0) {
        setCurrentScore((prev) => prev + result.pointsAwarded);
      }
    } catch (err: unknown) {
      const errorObj = err as { message?: string };
      setError(errorObj.message || 'Submission was rejected or time expired.');
      setHasSubmitted(false);
      setSelectedOption(null);
    }
  };

  const optionColors = [
    { bg: 'bg-indigo-600 hover:bg-indigo-500', letter: 'A', border: 'border-indigo-500' },
    { bg: 'bg-emerald-600 hover:bg-emerald-500', letter: 'B', border: 'border-emerald-500' },
    { bg: 'bg-amber-600 hover:bg-amber-500', letter: 'C', border: 'border-amber-500' },
    { bg: 'bg-purple-600 hover:bg-purple-500', letter: 'D', border: 'border-purple-500' },
  ];

  const getOptionCount = (stats: AnswerStats | undefined, idx: number): number => {
    if (!stats) return 0;
    if (idx === 0) return stats.option0;
    if (idx === 1) return stats.option1;
    if (idx === 2) return stats.option2;
    if (idx === 3) return stats.option3;
    return 0;
  };

  // My rank calculation
  const myEntry = leaderboard.find((p) => p.participantId === session?.participantId);
  const myRank = myEntry?.rank ?? roomState?.myRank ?? '-';

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-between selection:bg-indigo-500 selection:text-white">
      {/* Top Header Bar */}
      <header className="bg-slate-900/80 border-b border-slate-800/80 backdrop-blur-md px-4 py-3 sticky top-0 z-30">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-600 text-white font-bold shadow-md shadow-indigo-600/30">
              <Sparkles className="h-5 w-5" />
            </div>
            <div>
              <span className="font-bold text-white text-sm tracking-tight">CloudQuiz</span>
              <span className="ml-2 font-mono text-xs px-2 py-0.5 rounded bg-slate-800 text-indigo-400 font-semibold border border-slate-700">
                {roomCode.toUpperCase()}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3 text-xs">
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-800/80 border border-slate-700/80 text-slate-300 font-medium">
              <span className="text-slate-400">Player:</span>
              <span className="text-white font-semibold">{session?.displayName}</span>
            </div>
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-indigo-950/80 border border-indigo-800/60 text-indigo-300 font-semibold">
              <Trophy className="h-3.5 w-3.5 text-amber-400" />
              <span>{currentScore} pts</span>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="max-w-3xl w-full mx-auto p-4 sm:p-6 flex-1 flex flex-col justify-center">
        {error && (
          <div className="mb-4 p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs sm:text-sm flex items-start gap-2.5 animate-in fade-in">
            <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
            <span className="flex-1">{error}</span>
            <button onClick={() => setError(null)} className="text-rose-400 hover:text-rose-200">
              &times;
            </button>
          </div>
        )}

        {/* 1. WAITING LOBBY */}
        {(!roomState || roomState.status === 'WAITING') && (
          <div className="text-center py-12 px-6 bg-slate-900/60 border border-slate-800 rounded-3xl backdrop-blur-sm shadow-2xl space-y-6">
            <div className="inline-flex p-4 rounded-3xl bg-indigo-600/10 border border-indigo-500/20 text-indigo-400 animate-pulse">
              <Clock className="h-10 w-10" />
            </div>

            <div className="space-y-2">
              <h2 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
                You are in the lobby!
              </h2>
              <p className="text-slate-400 text-sm max-w-md mx-auto">
                Waiting for the host to start the competition. Get ready to test your knowledge!
              </p>
            </div>

            <div className="inline-flex items-center gap-2.5 px-4 py-2 rounded-full bg-slate-800/90 border border-slate-700 text-slate-300 text-sm font-medium">
              <Users className="h-4 w-4 text-indigo-400" />
              <span>{participantCount} participants connected</span>
            </div>

            <div className="pt-4 flex justify-center">
              <div className="flex items-center gap-2 text-xs text-slate-500">
                <span className="h-2 w-2 rounded-full bg-emerald-500 animate-ping" />
                Live socket connection synchronized
              </div>
            </div>
          </div>
        )}

        {/* 2. QUESTION ACTIVE */}
        {roomState?.status === 'QUESTION_ACTIVE' && currentQuestion && (
          <div className="space-y-6 animate-in fade-in duration-200">
            {/* Question Header & Countdown */}
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-indigo-400">
                <span>
                  Question {currentQuestion.questionNumber} of {currentQuestion.totalQuestions}
                </span>
                <span>&bull;</span>
                <span className="text-slate-400">{currentQuestion.points} Points</span>
              </div>

              {/* Timer Pill */}
              <div
                className={`flex items-center gap-2 px-3.5 py-1.5 rounded-full font-mono font-bold text-sm border shadow-sm transition-colors ${
                  remainingSeconds <= 5
                    ? 'bg-rose-500/20 text-rose-300 border-rose-500/40 animate-pulse'
                    : 'bg-indigo-500/20 text-indigo-300 border-indigo-500/40'
                }`}
              >
                <Clock className="h-4 w-4" />
                <span>{remainingSeconds}s</span>
              </div>
            </div>

            {/* Timer Progress Bar */}
            <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden">
              <div
                className={`h-full transition-all duration-500 ease-linear ${
                  remainingSeconds <= 5 ? 'bg-rose-500' : 'bg-indigo-500'
                }`}
                style={{
                  width: `${Math.min(100, (remainingSeconds / (currentQuestion.timeLimitSeconds || 30)) * 100)}%`,
                }}
              />
            </div>

            {/* Question Text Box */}
            <div className="p-6 sm:p-8 bg-slate-900 border border-slate-800 rounded-2xl shadow-xl">
              <h2 className="text-lg sm:text-xl font-bold text-white leading-relaxed">
                {currentQuestion.text}
              </h2>
            </div>

            {/* Option Choices Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              {currentQuestion.options.map((optionText, idx) => {
                const optStyle = optionColors[idx % optionColors.length];
                const isSelected = selectedOption === idx;
                const isLocked = hasSubmitted || isTimeUp;

                return (
                  <button
                    key={idx}
                    type="button"
                    disabled={isLocked}
                    onClick={() => handleSubmitAnswer(idx)}
                    className={`p-4 rounded-xl text-left border flex items-center gap-3.5 transition-all text-sm font-medium ${
                      isSelected
                        ? 'bg-indigo-600/90 border-indigo-400 text-white shadow-lg shadow-indigo-600/30 ring-2 ring-indigo-400 scale-[1.01]'
                        : isLocked
                        ? 'bg-slate-900/50 border-slate-800/80 text-slate-400 opacity-60 cursor-not-allowed'
                        : 'bg-slate-900 border-slate-800 text-slate-200 hover:border-indigo-500/80 hover:bg-slate-850 cursor-pointer active:scale-[0.99]'
                    }`}
                  >
                    <span
                      className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg font-bold text-xs ${
                        isSelected ? 'bg-white text-indigo-700' : 'bg-slate-800 text-slate-300'
                      }`}
                    >
                      {optStyle.letter}
                    </span>
                    <span className="flex-1 leading-snug">{optionText}</span>
                    {isSelected && <CheckCircle className="h-5 w-5 text-white shrink-0" />}
                  </button>
                );
              })}
            </div>

            {/* Submission Status Banner */}
            <div className="pt-2 text-center">
              {hasSubmitted ? (
                <div className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-semibold">
                  <CheckCircle className="h-4 w-4" />
                  Answer locked in! Waiting for round to close...
                </div>
              ) : isTimeUp ? (
                <div className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400 text-xs font-semibold">
                  <Clock className="h-4 w-4" />
                  Time expired for this question!
                </div>
              ) : (
                <p className="text-xs text-slate-500">
                  Select your answer before the deadline timer reaches zero.
                </p>
              )}
            </div>
          </div>
        )}

        {/* 3. QUESTION CLOSED (Results & Correct Answer Revealed) */}
        {roomState?.status === 'QUESTION_CLOSED' && (
          <div className="space-y-6 animate-in zoom-in-95 duration-200">
            <div className="p-6 sm:p-8 bg-slate-900 border border-slate-800 rounded-3xl shadow-xl text-center space-y-4">
              {/* Verdict Indicator */}
              {selectedOption !== null && questionResult ? (
                selectedOption === questionResult.correctAnswer ? (
                  <div className="space-y-2">
                    <div className="inline-flex p-3.5 rounded-2xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                      <CheckCircle className="h-10 w-10" />
                    </div>
                    <h2 className="text-2xl font-bold text-white">Correct Answer!</h2>
                    <p className="text-sm text-emerald-400 font-semibold">
                      +{submissionFeedback?.pointsAwarded ?? currentQuestion?.points ?? 0} Points awarded
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <div className="inline-flex p-3.5 rounded-2xl bg-rose-500/10 text-rose-400 border border-rose-500/20">
                      <XCircle className="h-10 w-10" />
                    </div>
                    <h2 className="text-2xl font-bold text-white">Incorrect Answer</h2>
                    <p className="text-sm text-rose-400 font-medium">0 points awarded for this round</p>
                  </div>
                )
              ) : (
                <div className="space-y-2">
                  <div className="inline-flex p-3.5 rounded-2xl bg-amber-500/10 text-amber-400 border border-amber-500/20">
                    <Clock className="h-10 w-10" />
                  </div>
                  <h2 className="text-2xl font-bold text-white">Question Closed</h2>
                  <p className="text-sm text-slate-400">No answer submitted in time.</p>
                </div>
              )}

              {/* Reveal Correct Answer */}
              {currentQuestion && questionResult && (
                <div className="mt-4 p-4 rounded-xl bg-slate-800/80 border border-slate-700/80 text-left max-w-md mx-auto">
                  <span className="block text-[11px] uppercase tracking-wider text-slate-400 font-bold mb-1">
                    Correct Option:
                  </span>
                  <p className="text-emerald-400 font-semibold text-sm flex items-center gap-2">
                    <span className="flex h-6 w-6 items-center justify-center rounded bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 font-bold text-xs">
                      {String.fromCharCode(65 + questionResult.correctAnswer)}
                    </span>
                    {currentQuestion.options[questionResult.correctAnswer]}
                  </p>
                </div>
              )}

              {/* Aggregated Statistics */}
              {questionResult?.stats && currentQuestion && (
                <div className="mt-4 pt-4 border-t border-slate-800 max-w-md mx-auto text-left">
                  <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                    <BarChart2 className="h-3.5 w-3.5" /> Group Response Distribution
                  </p>
                  <div className="space-y-1.5">
                    {currentQuestion.options.map((_, idx) => {
                      const count = getOptionCount(questionResult.stats, idx);
                      const total = questionResult.stats?.totalAnswered || 1;
                      const pct = Math.round((count / total) * 100);
                      const isCorrectOpt = idx === questionResult.correctAnswer;

                      return (
                        <div key={idx} className="flex items-center gap-2 text-xs">
                          <span
                            className={`w-5 font-mono font-bold ${
                              isCorrectOpt ? 'text-emerald-400' : 'text-slate-400'
                            }`}
                          >
                            {String.fromCharCode(65 + idx)}
                          </span>
                          <div className="flex-1 bg-slate-800 h-2 rounded-full overflow-hidden">
                            <div
                              className={`h-full ${isCorrectOpt ? 'bg-emerald-500' : 'bg-slate-600'}`}
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                          <span className="text-slate-400 font-mono w-10 text-right">{count}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              <p className="text-xs text-slate-500 pt-2">
                Waiting for the host to advance to the next round...
              </p>
            </div>
          </div>
        )}

        {/* 4. COMPLETED (Final Standings & Podium) */}
        {roomState?.status === 'COMPLETED' && (
          <div className="space-y-6 py-6 animate-in fade-in duration-300">
            <div className="p-6 sm:p-8 bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl text-center space-y-4">
              <div className="inline-flex p-4 rounded-3xl bg-amber-500/10 text-amber-400 border border-amber-500/20">
                <Crown className="h-12 w-12" />
              </div>

              <div>
                <h2 className="text-3xl font-extrabold text-white tracking-tight">Quiz Completed!</h2>
                <p className="text-slate-400 text-sm mt-1">Thank you for participating in the competition.</p>
              </div>

              {/* Participant Performance Card with Accuracy & Counts */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 max-w-lg mx-auto my-3 text-left">
                <div className="p-3.5 rounded-xl bg-slate-800/80 border border-slate-700/80">
                  <span className="block text-[11px] uppercase tracking-wider text-slate-400 font-bold">
                    Your Rank
                  </span>
                  <span className="text-2xl font-black text-amber-400">#{myRank}</span>
                </div>
                <div className="p-3.5 rounded-xl bg-slate-800/80 border border-slate-700/80">
                  <span className="block text-[11px] uppercase tracking-wider text-slate-400 font-bold">
                    Final Score
                  </span>
                  <span className="text-2xl font-black text-white">{currentScore} pts</span>
                </div>
                <div className="p-3.5 rounded-xl bg-slate-800/80 border border-slate-700/80">
                  <span className="block text-[11px] uppercase tracking-wider text-slate-400 font-bold">
                    Accuracy
                  </span>
                  <span className="text-2xl font-black text-emerald-400">
                    {participantResult ? `${participantResult.participant.accuracy}%` : '-'}
                  </span>
                </div>
                <div className="p-3.5 rounded-xl bg-slate-800/80 border border-slate-700/80">
                  <span className="block text-[11px] uppercase tracking-wider text-slate-400 font-bold">
                    Correct
                  </span>
                  <span className="text-2xl font-black text-indigo-400">
                    {participantResult?.participant.correctCount ?? '-'}
                  </span>
                </div>
              </div>
            </div>

            {/* Top 3 Podium */}
            {leaderboard && leaderboard.length > 0 && (
              <div className="bg-slate-900 border border-slate-800 rounded-3xl p-4 sm:p-6 shadow-xl text-center">
                <h3 className="text-sm font-bold uppercase tracking-wider text-amber-400 mb-2">
                  Official Podium
                </h3>
                <Podium entries={leaderboard} currentParticipantId={session?.participantId} />
              </div>
            )}

            {/* Question-by-Question Personal Review */}
            {participantResult && participantResult.questions.length > 0 && (
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 sm:p-6 shadow-xl space-y-4">
                <h3 className="text-sm font-bold uppercase tracking-wider text-slate-200 flex items-center gap-2">
                  <BarChart2 className="h-4 w-4 text-indigo-400" /> Your Question-by-Question Outcome
                </h3>
                <div className="space-y-3">
                  {participantResult.questions.map((q) => {
                    const isAnswered = q.selectedOption !== null;
                    return (
                      <div
                        key={q.questionId}
                        className="p-4 rounded-xl bg-slate-800/60 border border-slate-700/80 space-y-2 text-xs"
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-slate-200">
                            Q{q.questionNumber}: {q.text}
                          </span>
                          <div className="flex items-center gap-2">
                            {q.isCorrect ? (
                              <span className="flex items-center gap-1 text-emerald-400 font-bold px-2 py-0.5 rounded bg-emerald-500/10 border border-emerald-500/30">
                                <CheckCircle className="h-3.5 w-3.5" /> +{q.pointsAwarded} pts
                              </span>
                            ) : isAnswered ? (
                              <span className="flex items-center gap-1 text-rose-400 font-bold px-2 py-0.5 rounded bg-rose-500/10 border border-rose-500/30">
                                <XCircle className="h-3.5 w-3.5" /> 0 pts
                              </span>
                            ) : (
                              <span className="flex items-center gap-1 text-slate-400 font-medium px-2 py-0.5 rounded bg-slate-700/50">
                                <Clock className="h-3.5 w-3.5" /> Unanswered
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Your Choice vs Correct Choice */}
                        <div className="pt-1.5 flex flex-col sm:flex-row sm:items-center gap-2 text-[11px] text-slate-400">
                          {isAnswered && (
                            <div>
                              <span>You chose: </span>
                              <strong className={q.isCorrect ? 'text-emerald-400' : 'text-rose-400'}>
                                Option {String.fromCharCode(65 + q.selectedOption!)}: {q.options[q.selectedOption!]}
                              </strong>
                            </div>
                          )}
                          {q.correctAnswer !== null && (
                            <div className="sm:ml-auto">
                              <span>Correct answer: </span>
                              <strong className="text-emerald-400">
                                Option {String.fromCharCode(65 + q.correctAnswer)}: {q.options[q.correctAnswer]}
                              </strong>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Final Leaderboard */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl">
              <h3 className="text-sm font-bold uppercase tracking-wider text-slate-300 mb-3 flex items-center gap-2">
                <Trophy className="h-4 w-4 text-amber-400" /> Full Competition Leaderboard
              </h3>
              <div className="divide-y divide-slate-800">
                {leaderboard.map((entry) => {
                  const isMe = entry.participantId === session?.participantId;
                  return (
                    <div
                      key={entry.participantId}
                      className={`py-3 px-3 rounded-xl flex items-center justify-between text-sm transition-colors ${
                        isMe ? 'bg-indigo-600/20 border border-indigo-500/40 text-white font-semibold' : 'text-slate-300'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <span
                          className={`font-mono font-bold w-6 text-center ${
                            entry.rank === 1
                              ? 'text-amber-400 text-base'
                              : entry.rank === 2
                              ? 'text-slate-300'
                              : entry.rank === 3
                              ? 'text-amber-600'
                              : 'text-slate-500'
                          }`}
                        >
                          #{entry.rank}
                        </span>
                        <span>{entry.displayName} {isMe && '(You)'}</span>
                      </div>
                      <div className="flex items-center gap-4 text-xs font-mono">
                        {entry.accuracy !== undefined && (
                          <span className="text-slate-400">{entry.accuracy}% acc</span>
                        )}
                        <span className="font-bold text-indigo-400 text-sm">{entry.score} pts</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="text-center pt-2">
              <Link to="/join">
                <Button variant="outline" size="md">
                  Join Another Competition
                </Button>
              </Link>
            </div>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="max-w-4xl mx-auto w-full py-4 text-center text-xs text-slate-600">
        CloudQuiz Real-Time Multiplayer Engine &bull; College Competition Platform
      </footer>
    </div>
  );
};

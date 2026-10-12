import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  Trophy,
  Users,
  Download,
  Clock,
  CheckCircle2,
  AlertTriangle,
  ArrowLeft,
  ChevronDown,
  ChevronUp,
  Flame,
  Award,
  Sparkles,
  BarChart3,
  Percent,
} from 'lucide-react';
import { sessionApi } from '../../services/sessionApi';
import { CompetitionAnalytics, LeaderboardEntry } from '../../types';
import { Podium } from '../../components/analytics/Podium';
import {
  ScoreDistributionChart,
  QuestionAccuracyChart,
} from '../../components/analytics/AnalyticsCharts';
import { Card } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { LoadingSkeleton } from '../../components/ui/LoadingSkeleton';

export const HostAnalyticsPage: React.FC = () => {
  const { roomCode, sessionId } = useParams<{ roomCode?: string; sessionId?: string }>();

  const [analytics, setAnalytics] = useState<CompetitionAnalytics | null>(null);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedQuestion, setExpandedQuestion] = useState<string | null>(null);

  useEffect(() => {
    async function loadData() {
      try {
        setLoading(true);
        setError(null);

        if (sessionId) {
          const res = await sessionApi.getHistoryDetail(sessionId);
          setAnalytics(res.analytics);
          setLeaderboard(res.leaderboard);
        } else if (roomCode) {
          const [analyticsRes, resultsRes] = await Promise.all([
            sessionApi.getAnalytics(roomCode.toUpperCase()),
            sessionApi.getResults(roomCode.toUpperCase()),
          ]);
          setAnalytics(analyticsRes);
          setLeaderboard(resultsRes.leaderboard);
        }
      } catch (err: unknown) {
        const errorObj = err as { message?: string };
        setError(errorObj.message || 'Failed to load competition analytics.');
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, [roomCode, sessionId]);

  if (loading) {
    return (
      <div className="space-y-6 animate-pulse p-4">
        <LoadingSkeleton className="h-12 w-3/4 rounded-xl" />
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <LoadingSkeleton key={i} className="h-24 rounded-xl" />
          ))}
        </div>
        <LoadingSkeleton className="h-64 rounded-2xl" />
      </div>
    );
  }

  if (error || !analytics) {
    return (
      <Card className="p-8 text-center max-w-lg mx-auto my-12 bg-white">
        <AlertTriangle className="h-12 w-12 text-rose-500 mx-auto mb-3" />
        <h2 className="text-xl font-bold text-slate-900">Analytics Unavailable</h2>
        <p className="text-sm text-slate-500 mt-2 mb-6">{error || 'Unable to retrieve competition data.'}</p>
        <Link to="/history">
          <Button variant="primary" icon={<ArrowLeft className="h-4 w-4" />}>
            Back to Competition History
          </Button>
        </Link>
      </Card>
    );
  }

  const activeRoomCode = analytics.roomCode;

  return (
    <div className="space-y-8 animate-in fade-in duration-300">
      {/* Top Header / Actions */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200/80 shadow-sm">
        <div className="space-y-1">
          <div className="flex items-center gap-3">
            <Link to="/history" className="text-slate-400 hover:text-slate-600 transition-colors">
              <ArrowLeft className="h-5 w-5" />
            </Link>
            <h1 className="text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2">
              {analytics.quizTitle}
            </h1>
            <Badge status={analytics.status} />
          </div>
          <div className="flex items-center gap-4 text-xs text-slate-500 pl-8">
            <span className="font-mono bg-slate-100 text-indigo-700 px-2.5 py-0.5 rounded-md font-bold border border-slate-200">
              Room: {activeRoomCode}
            </span>
            {analytics.endedAt && (
              <span>Completed on {new Date(analytics.endedAt).toLocaleString()}</span>
            )}
          </div>
        </div>

        {/* CSV Export Buttons */}
        <div className="flex items-center gap-2.5 self-start md:self-auto flex-wrap">
          <a
            href={sessionApi.getLeaderboardCsvUrl(activeRoomCode)}
            download={`leaderboard-${activeRoomCode}.csv`}
          >
            <Button variant="outline" size="sm" icon={<Download className="h-4 w-4" />}>
              Leaderboard CSV
            </Button>
          </a>
          <a
            href={sessionApi.getAnswersCsvUrl(activeRoomCode)}
            download={`answers-${activeRoomCode}.csv`}
          >
            <Button variant="outline" size="sm" icon={<Download className="h-4 w-4" />}>
              Answers CSV
            </Button>
          </a>
        </div>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3.5">
        <Card className="p-4 bg-white border border-slate-200/90 shadow-sm flex flex-col justify-between">
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
            Participants
          </span>
          <div className="mt-2 flex items-baseline justify-between">
            <span className="text-2xl font-black text-slate-900">{analytics.totalParticipants}</span>
            <Users className="h-4 w-4 text-indigo-500" />
          </div>
        </Card>

        <Card className="p-4 bg-white border border-slate-200/90 shadow-sm flex flex-col justify-between">
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
            Participation
          </span>
          <div className="mt-2 flex items-baseline justify-between">
            <span className="text-2xl font-black text-slate-900">{analytics.participationRate}%</span>
            <Percent className="h-4 w-4 text-emerald-500" />
          </div>
        </Card>

        <Card className="p-4 bg-white border border-slate-200/90 shadow-sm flex flex-col justify-between">
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
            Overall Accuracy
          </span>
          <div className="mt-2 flex items-baseline justify-between">
            <span className="text-2xl font-black text-slate-900">{analytics.overallAccuracy}%</span>
            <CheckCircle2 className="h-4 w-4 text-emerald-500" />
          </div>
        </Card>

        <Card className="p-4 bg-white border border-slate-200/90 shadow-sm flex flex-col justify-between">
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
            Top Score
          </span>
          <div className="mt-2 flex items-baseline justify-between">
            <span className="text-2xl font-black text-amber-600">{analytics.highestScore}</span>
            <Award className="h-4 w-4 text-amber-500" />
          </div>
        </Card>

        <Card className="p-4 bg-white border border-slate-200/90 shadow-sm flex flex-col justify-between">
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
            Median Score
          </span>
          <div className="mt-2 flex items-baseline justify-between">
            <span className="text-2xl font-black text-slate-900">{analytics.medianScore}</span>
            <BarChart3 className="h-4 w-4 text-indigo-500" />
          </div>
        </Card>

        <Card className="p-4 bg-white border border-slate-200/90 shadow-sm flex flex-col justify-between">
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
            Mean Response
          </span>
          <div className="mt-2 flex items-baseline justify-between">
            <span className="text-2xl font-black text-slate-900">
              {(analytics.meanResponseTimeMs / 1000).toFixed(1)}s
            </span>
            <Clock className="h-4 w-4 text-purple-500" />
          </div>
        </Card>
      </div>

      {/* Top 3 Podium Card */}
      {leaderboard && leaderboard.length > 0 && (
        <div className="bg-slate-950 text-white rounded-3xl p-6 sm:p-8 shadow-xl border border-slate-800">
          <div className="text-center mb-2">
            <span className="text-xs font-bold uppercase tracking-widest text-amber-400 bg-amber-400/10 px-3 py-1 rounded-full border border-amber-400/20">
              Top 3 Standings
            </span>
            <h2 className="text-2xl font-black text-white mt-2">Official Podium</h2>
          </div>
          <Podium entries={leaderboard} />
        </div>
      )}

      {/* Analytics Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="p-6 bg-slate-900 text-white border-slate-800 shadow-md">
          <h3 className="text-base font-bold text-white mb-4 flex items-center gap-2">
            <BarChart3 className="h-5 w-5 text-indigo-400" /> Score Distribution
          </h3>
          <ScoreDistributionChart
            distribution={analytics.scoreDistribution}
            totalParticipants={analytics.totalParticipants}
          />
        </Card>

        <Card className="p-6 bg-slate-900 text-white border-slate-800 shadow-md">
          <h3 className="text-base font-bold text-white mb-4 flex items-center gap-2">
            <CheckCircle2 className="h-5 w-5 text-emerald-400" /> Question Accuracy Trend
          </h3>
          <QuestionAccuracyChart questions={analytics.perQuestionStats} />
        </Card>
      </div>

      {/* Hardest & Easiest Highlights */}
      {(analytics.mostChallengingQuestion || analytics.easiestQuestion) && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {analytics.mostChallengingQuestion && (
            <Card className="p-5 border-l-4 border-l-rose-500 bg-white">
              <div className="flex items-center gap-2 text-rose-600 font-bold text-xs uppercase tracking-wider mb-1">
                <Flame className="h-4 w-4" /> Most Challenging Question
              </div>
              <h4 className="font-semibold text-slate-900 text-sm">
                Q{analytics.mostChallengingQuestion.questionNumber}: {analytics.mostChallengingQuestion.text}
              </h4>
              <p className="text-xs text-slate-500 mt-2 font-mono font-semibold">
                Accuracy: {analytics.mostChallengingQuestion.accuracyPercentage}%
              </p>
            </Card>
          )}

          {analytics.easiestQuestion && (
            <Card className="p-5 border-l-4 border-l-emerald-500 bg-white">
              <div className="flex items-center gap-2 text-emerald-600 font-bold text-xs uppercase tracking-wider mb-1">
                <Sparkles className="h-4 w-4" /> Easiest Question
              </div>
              <h4 className="font-semibold text-slate-900 text-sm">
                Q{analytics.easiestQuestion.questionNumber}: {analytics.easiestQuestion.text}
              </h4>
              <p className="text-xs text-slate-500 mt-2 font-mono font-semibold">
                Accuracy: {analytics.easiestQuestion.accuracyPercentage}%
              </p>
            </Card>
          )}
        </div>
      )}

      {/* Detailed Question Analytics Breakdown */}
      <Card className="p-6 bg-white border border-slate-200">
        <h3 className="text-lg font-bold text-slate-900 mb-4 flex items-center gap-2">
          <span>Question-by-Question Analytics</span>
        </h3>
        <div className="space-y-4">
          {analytics.perQuestionStats.map((q) => {
            const isExpanded = expandedQuestion === q.questionId;
            return (
              <div
                key={q.questionId}
                className="border border-slate-200 rounded-xl overflow-hidden transition-all"
              >
                <button
                  type="button"
                  onClick={() =>
                    setExpandedQuestion(isExpanded ? null : q.questionId)
                  }
                  className="w-full p-4 flex items-center justify-between text-left bg-slate-50/70 hover:bg-slate-100/70 transition-colors"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2.5">
                      <span className="font-mono font-bold text-xs px-2 py-0.5 rounded bg-indigo-50 text-indigo-700 border border-indigo-200">
                        Q{q.questionNumber}
                      </span>
                      <h4 className="font-semibold text-slate-900 text-sm">{q.text}</h4>
                    </div>
                    <div className="flex items-center gap-4 text-xs text-slate-500">
                      <span>Points: {q.points}</span>
                      <span>&bull;</span>
                      <span>Submissions: {q.submittedAnswers}</span>
                      <span>&bull;</span>
                      <span>Unanswered: {q.unansweredCount}</span>
                      <span>&bull;</span>
                      <span className="font-semibold text-indigo-600">
                        Accuracy: {q.accuracyPercentage}%
                      </span>
                    </div>
                  </div>
                  {isExpanded ? (
                    <ChevronUp className="h-5 w-5 text-slate-400" />
                  ) : (
                    <ChevronDown className="h-5 w-5 text-slate-400" />
                  )}
                </button>

                {isExpanded && (
                  <div className="p-5 border-t border-slate-200 bg-white space-y-4 animate-in fade-in">
                    <div>
                      <h5 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2.5">
                        Option Selection Distribution
                      </h5>
                      <div className="space-y-2">
                        {q.optionDistribution.map((opt) => {
                          const isCorrect = opt.optionIndex === q.correctAnswer;
                          return (
                            <div
                              key={opt.optionIndex}
                              className={`p-3 rounded-xl border flex items-center justify-between text-xs transition-colors ${
                                isCorrect
                                  ? 'bg-emerald-50/80 border-emerald-300 text-emerald-900 font-semibold'
                                  : 'bg-slate-50 border-slate-200 text-slate-700'
                              }`}
                            >
                              <div className="flex items-center gap-2.5">
                                <span
                                  className={`flex h-6 w-6 items-center justify-center rounded-md font-bold text-xs ${
                                    isCorrect
                                      ? 'bg-emerald-600 text-white'
                                      : 'bg-white text-slate-600 border border-slate-300'
                                  }`}
                                >
                                  {String.fromCharCode(65 + opt.optionIndex)}
                                </span>
                                <span>{opt.text}</span>
                                {isCorrect && (
                                  <span className="text-[10px] uppercase font-extrabold px-1.5 py-0.5 rounded bg-emerald-200 text-emerald-800">
                                    Correct Answer
                                  </span>
                                )}
                              </div>
                              <span className="font-mono font-bold">
                                {opt.count} ({opt.percentage}%)
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </Card>

      {/* Full Leaderboard Standings Table */}
      <Card className="p-6 bg-white border border-slate-200">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
            <Trophy className="h-5 w-5 text-amber-500" /> Full Leaderboard Standings
          </h3>
          <span className="text-xs text-slate-500">{leaderboard.length} participants</span>
        </div>

        <div className="overflow-x-auto rounded-xl border border-slate-200">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold uppercase tracking-wider">
              <tr>
                <th className="py-3 px-4 w-16 text-center">Rank</th>
                <th className="py-3 px-4">Participant Name</th>
                <th className="py-3 px-4 text-center">Correct</th>
                <th className="py-3 px-4 text-center">Incorrect</th>
                <th className="py-3 px-4 text-center">Unanswered</th>
                <th className="py-3 px-4 text-center">Accuracy</th>
                <th className="py-3 px-4 text-right">Total Score</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              {leaderboard.map((entry) => (
                <tr key={entry.participantId} className="hover:bg-slate-50/60 transition-colors">
                  <td className="py-3 px-4 text-center font-bold text-slate-900">
                    #{entry.rank}
                  </td>
                  <td className="py-3 px-4 font-semibold text-slate-800">
                    {entry.displayName}
                  </td>
                  <td className="py-3 px-4 text-center font-mono text-emerald-600 font-bold">
                    {entry.correctCount ?? '-'}
                  </td>
                  <td className="py-3 px-4 text-center font-mono text-rose-500">
                    {entry.incorrectCount ?? '-'}
                  </td>
                  <td className="py-3 px-4 text-center font-mono text-slate-400">
                    {entry.unansweredCount ?? '-'}
                  </td>
                  <td className="py-3 px-4 text-center font-mono font-semibold text-indigo-600">
                    {entry.accuracy !== undefined ? `${entry.accuracy}%` : '-'}
                  </td>
                  <td className="py-3 px-4 text-right font-mono font-bold text-slate-900">
                    {entry.score} pts
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
};

import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Layers,
  FileEdit,
  CheckCircle2,
  Archive,
  PlusCircle,
  ArrowRight,
  Sparkles,
  Clock,
  HelpCircle,
  Play,
} from 'lucide-react';
import { quizApi } from '../../services/quizApi';
import { sessionApi } from '../../services/sessionApi';
import { Quiz, QuizMetrics } from '../../types';
import { Card } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { LoadingSkeleton } from '../../components/ui/LoadingSkeleton';
import { useAuth } from '../../context/AuthContext';

export const DashboardPage: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [metrics, setMetrics] = useState<QuizMetrics | null>(null);
  const [recentQuizzes, setRecentQuizzes] = useState<Quiz[]>([]);
  const [loading, setLoading] = useState(true);
  const [startingSessionId, setStartingSessionId] = useState<string | null>(null);

  useEffect(() => {
    async function loadDashboardData() {
      try {
        setLoading(true);
        const [metricsData, quizzesData] = await Promise.all([
          quizApi.getMetrics(),
          quizApi.listQuizzes({ page: 1, limit: 5 }),
        ]);
        setMetrics(metricsData);
        setRecentQuizzes(quizzesData.items);
      } catch (err) {
        console.error('Failed to load dashboard data:', err);
      } finally {
        setLoading(false);
      }
    }
    loadDashboardData();
  }, []);

  const handleStartLive = async (quizId: string) => {
    try {
      setStartingSessionId(quizId);
      const session = await sessionApi.createSession(quizId);
      navigate(`/host/session/${session.roomCode}`);
    } catch (err: unknown) {
      const error = err as { friendlyMessage?: string; message?: string };
      alert(error.friendlyMessage || error.message || 'Failed to start live competition session.');
    } finally {
      setStartingSessionId(null);
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-200">
      {/* Top Banner / Welcome Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200/80 shadow-sm">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            Welcome back, {user?.name}
            <span className="text-xl">👋</span>
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Host portal overview for college events, tech symposiums, and quizzes.
          </p>
        </div>
        <Link to="/quizzes/new">
          <Button
            variant="primary"
            icon={<PlusCircle className="h-4 w-4" />}
            size="md"
          >
            Create New Quiz
          </Button>
        </Link>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total */}
        <Card className="p-5 flex items-center gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600 border border-indigo-100">
            <Layers className="h-6 w-6" />
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Total Quizzes</p>
            {loading ? (
              <LoadingSkeleton className="h-7 w-12 mt-1" />
            ) : (
              <h3 className="text-2xl font-bold text-slate-900 mt-0.5">{metrics?.total || 0}</h3>
            )}
          </div>
        </Card>

        {/* Drafts */}
        <Card className="p-5 flex items-center gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-amber-50 text-amber-600 border border-amber-100">
            <FileEdit className="h-6 w-6" />
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Drafts</p>
            {loading ? (
              <LoadingSkeleton className="h-7 w-12 mt-1" />
            ) : (
              <h3 className="text-2xl font-bold text-slate-900 mt-0.5">{metrics?.draft || 0}</h3>
            )}
          </div>
        </Card>

        {/* Published */}
        <Card className="p-5 flex items-center gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600 border border-emerald-100">
            <CheckCircle2 className="h-6 w-6" />
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Published</p>
            {loading ? (
              <LoadingSkeleton className="h-7 w-12 mt-1" />
            ) : (
              <h3 className="text-2xl font-bold text-slate-900 mt-0.5">{metrics?.published || 0}</h3>
            )}
          </div>
        </Card>

        {/* Archived */}
        <Card className="p-5 flex items-center gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-slate-100 text-slate-600 border border-slate-200">
            <Archive className="h-6 w-6" />
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Archived</p>
            {loading ? (
              <LoadingSkeleton className="h-7 w-12 mt-1" />
            ) : (
              <h3 className="text-2xl font-bold text-slate-900 mt-0.5">{metrics?.archived || 0}</h3>
            )}
          </div>
        </Card>
      </div>

      {/* Recent Quizzes Section */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
            Recently Updated Quizzes
          </h2>
          <Link
            to="/quizzes"
            className="text-xs font-semibold text-indigo-600 hover:text-indigo-700 flex items-center gap-1 transition"
          >
            <span>View All</span>
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>

        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <Card key={i} className="p-5">
                <div className="flex items-center justify-between">
                  <div className="space-y-2 w-1/2">
                    <LoadingSkeleton className="h-5 w-3/4" />
                    <LoadingSkeleton className="h-4 w-1/2" />
                  </div>
                  <LoadingSkeleton className="h-8 w-20 rounded-lg" />
                </div>
              </Card>
            ))}
          </div>
        ) : recentQuizzes.length === 0 ? (
          /* Empty State */
          <Card className="p-12 text-center bg-white border border-dashed border-slate-300">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-600 mb-4">
              <Sparkles className="h-7 w-7" />
            </div>
            <h3 className="text-lg font-bold text-slate-900">No quizzes created yet</h3>
            <p className="mt-1 text-sm text-slate-500 max-w-md mx-auto">
              Get started by creating your first competition quiz round. You can craft questions, configure timer countdowns, and set points.
            </p>
            <div className="mt-6">
              <Link to="/quizzes/new">
                <Button variant="primary" icon={<PlusCircle className="h-4 w-4" />}>
                  Create Your First Quiz
                </Button>
              </Link>
            </div>
          </Card>
        ) : (
          <div className="grid grid-cols-1 gap-3">
            {recentQuizzes.map((quiz) => (
              <Card key={quiz.id} className="p-5 hover:border-indigo-200 transition-all">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2.5">
                      <h4 className="font-semibold text-slate-900 text-base">{quiz.title}</h4>
                      <Badge status={quiz.status} />
                    </div>
                    {quiz.description && (
                      <p className="text-xs text-slate-500 line-clamp-1">{quiz.description}</p>
                    )}
                    <div className="flex items-center gap-4 text-xs text-slate-400 pt-1">
                      <span className="flex items-center gap-1">
                        <HelpCircle className="h-3.5 w-3.5" />
                        {quiz._count?.questions ?? 0} Questions
                      </span>
                      <span className="flex items-center gap-1">
                        <Clock className="h-3.5 w-3.5" />
                        Updated {new Date(quiz.updatedAt).toLocaleDateString()}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 self-end sm:self-center">
                    {quiz.status === 'PUBLISHED' && (
                      <Button
                        variant="primary"
                        size="sm"
                        className="bg-emerald-600 hover:bg-emerald-700 text-white"
                        icon={<Play className="h-3.5 w-3.5 fill-current" />}
                        disabled={startingSessionId === quiz.id}
                        onClick={() => handleStartLive(quiz.id)}
                      >
                        {startingSessionId === quiz.id ? 'Starting...' : 'Start Live'}
                      </Button>
                    )}
                    <Link to={`/quizzes/${quiz.id}/preview`}>
                      <Button variant="outline" size="sm">
                        Preview
                      </Button>
                    </Link>
                    <Link to={`/quizzes/${quiz.id}/edit`}>
                      <Button variant="primary" size="sm">
                        Manage
                      </Button>
                    </Link>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

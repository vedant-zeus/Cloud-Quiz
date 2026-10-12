import React, { useState, useEffect, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Search,
  PlusCircle,
  HelpCircle,
  Clock,
  Trash2,
  Archive,
  Globe,
  Edit,
  Eye,
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  Play,
} from 'lucide-react';
import { quizApi } from '../../services/quizApi';
import { sessionApi } from '../../services/sessionApi';
import { Quiz, QuizStatus, Pagination } from '../../types';
import { Card } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { Modal } from '../../components/ui/Modal';
import { CardSkeleton } from '../../components/ui/LoadingSkeleton';

export const QuizListPage: React.FC = () => {
  const navigate = useNavigate();
  const [startingSessionId, setStartingSessionId] = useState<string | null>(null);
  const [quizzes, setQuizzes] = useState<Quiz[]>([]);
  const [pagination, setPagination] = useState<Pagination>({
    page: 1,
    limit: 8,
    total: 0,
    totalPages: 1,
    hasNextPage: false,
    hasPrevPage: false,
  });
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [page, setPage] = useState(1);

  // Confirmation modal state
  const [confirmModal, setConfirmModal] = useState<{
    isOpen: boolean;
    type: 'DELETE' | 'PUBLISH' | 'ARCHIVE' | null;
    quiz: Quiz | null;
    loading: boolean;
    error: string | null;
  }>({
    isOpen: false,
    type: null,
    quiz: null,
    loading: false,
    error: null,
  });

  const loadQuizzes = useCallback(async () => {
    try {
      setLoading(true);
      const res = await quizApi.listQuizzes({
        page,
        limit: 8,
        search: search.trim() || undefined,
        status: statusFilter !== 'ALL' ? (statusFilter as QuizStatus) : undefined,
      });
      setQuizzes(res.items);
      setPagination(res.pagination);
    } catch (err) {
      console.error('Failed to load quizzes:', err);
    } finally {
      setLoading(false);
    }
  }, [page, search, statusFilter]);

  useEffect(() => {
    loadQuizzes();
  }, [loadQuizzes]);

  const handleActionConfirm = async () => {
    if (!confirmModal.quiz || !confirmModal.type) return;

    try {
      setConfirmModal((prev) => ({ ...prev, loading: true, error: null }));
      const quizId = confirmModal.quiz.id;

      if (confirmModal.type === 'DELETE') {
        await quizApi.deleteQuiz(quizId);
      } else if (confirmModal.type === 'PUBLISH') {
        await quizApi.publishQuiz(quizId);
      } else if (confirmModal.type === 'ARCHIVE') {
        await quizApi.archiveQuiz(quizId);
      }

      setConfirmModal({ isOpen: false, type: null, quiz: null, loading: false, error: null });
      loadQuizzes();
    } catch (err: unknown) {
      const error = err as { friendlyMessage?: string };
      setConfirmModal((prev) => ({
        ...prev,
        loading: false,
        error: error.friendlyMessage || 'Action failed. Please check the requirements.',
      }));
    }
  };

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

  const statusTabs = [
    { label: 'All Quizzes', value: 'ALL' },
    { label: 'Drafts', value: 'DRAFT' },
    { label: 'Published', value: 'PUBLISHED' },
    { label: 'Archived', value: 'ARCHIVED' },
  ];

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Quiz Library</h1>
          <p className="mt-1 text-sm text-slate-500">
            Manage drafts, publish competitive rounds, and configure question sets
          </p>
        </div>
        <Link to="/quizzes/new">
          <Button variant="primary" icon={<PlusCircle className="h-4 w-4" />}>
            New Quiz
          </Button>
        </Link>
      </div>

      {/* Filters and Search Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
        {/* Search */}
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search by quiz title or description..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            className="w-full pl-9 pr-4 py-2 text-sm rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-100 focus:border-indigo-500 transition-all placeholder:text-slate-400"
          />
        </div>

        {/* Status Filter Tabs */}
        <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-lg border border-slate-200/80 self-start sm:self-auto overflow-x-auto max-w-full">
          {statusTabs.map((tab) => (
            <button
              key={tab.value}
              onClick={() => {
                setStatusFilter(tab.value);
                setPage(1);
              }}
              className={`px-3 py-1.5 rounded-md text-xs font-semibold whitespace-nowrap transition-all ${
                statusFilter === tab.value
                  ? 'bg-white text-indigo-600 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Quiz List Grid */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <CardSkeleton key={i} />
          ))}
        </div>
      ) : quizzes.length === 0 ? (
        /* Empty State */
        <Card className="p-12 text-center bg-white border border-dashed border-slate-300">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-600 mb-3">
            <HelpCircle className="h-6 w-6" />
          </div>
          <h3 className="text-base font-bold text-slate-900">No quizzes match your criteria</h3>
          <p className="mt-1 text-xs text-slate-500 max-w-sm mx-auto">
            {search || statusFilter !== 'ALL'
              ? 'Try modifying your search keywords or resetting your status filter.'
              : 'Create your first quiz to get started.'}
          </p>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {quizzes.map((quiz) => (
            <Card key={quiz.id} className="p-5 flex flex-col justify-between hover:border-indigo-200 transition-all">
              <div className="space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <h3 className="text-base font-bold text-slate-900 line-clamp-1">{quiz.title}</h3>
                  <Badge status={quiz.status} />
                </div>

                <p className="text-xs text-slate-500 line-clamp-2 min-h-[2rem]">
                  {quiz.description || 'No description provided for this quiz round.'}
                </p>

                <div className="flex items-center gap-4 text-xs text-slate-400 pt-2 border-t border-slate-100">
                  <span className="flex items-center gap-1 font-medium text-slate-600">
                    <HelpCircle className="h-3.5 w-3.5 text-slate-400" />
                    {quiz._count?.questions ?? 0} Questions
                  </span>
                  <span className="flex items-center gap-1">
                    <Clock className="h-3.5 w-3.5" />
                    {new Date(quiz.updatedAt).toLocaleDateString()}
                  </span>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="mt-5 pt-3 border-t border-slate-100 flex items-center justify-between gap-2 flex-wrap">
                <div className="flex items-center gap-1.5">
                  <Link to={`/quizzes/${quiz.id}/edit`}>
                    <Button variant="outline" size="sm" icon={<Edit className="h-3.5 w-3.5" />}>
                      Edit
                    </Button>
                  </Link>
                  <Link to={`/quizzes/${quiz.id}/preview`}>
                    <Button variant="ghost" size="sm" icon={<Eye className="h-3.5 w-3.5" />}>
                      Preview
                    </Button>
                  </Link>
                </div>

                <div className="flex items-center gap-1.5">
                  {quiz.status === 'PUBLISHED' && (
                    <Button
                      variant="primary"
                      size="sm"
                      className="bg-emerald-600 hover:bg-emerald-700 text-white font-medium"
                      icon={<Play className="h-3.5 w-3.5 fill-current" />}
                      disabled={startingSessionId === quiz.id}
                      onClick={() => handleStartLive(quiz.id)}
                    >
                      {startingSessionId === quiz.id ? 'Starting...' : 'Start Live'}
                    </Button>
                  )}

                  {quiz.status === 'DRAFT' && (
                    <Button
                      variant="primary"
                      size="sm"
                      icon={<Globe className="h-3.5 w-3.5" />}
                      onClick={() =>
                        setConfirmModal({
                          isOpen: true,
                          type: 'PUBLISH',
                          quiz,
                          loading: false,
                          error: null,
                        })
                      }
                    >
                      Publish
                    </Button>
                  )}

                  {quiz.status !== 'ARCHIVED' && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-slate-500 hover:text-slate-700"
                      icon={<Archive className="h-3.5 w-3.5" />}
                      onClick={() =>
                        setConfirmModal({
                          isOpen: true,
                          type: 'ARCHIVE',
                          quiz,
                          loading: false,
                          error: null,
                        })
                      }
                    >
                      Archive
                    </Button>
                  )}

                  {quiz.status === 'DRAFT' && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-rose-600 hover:bg-rose-50"
                      icon={<Trash2 className="h-3.5 w-3.5" />}
                      onClick={() =>
                        setConfirmModal({
                          isOpen: true,
                          type: 'DELETE',
                          quiz,
                          loading: false,
                          error: null,
                        })
                      }
                    >
                      Delete
                    </Button>
                  )}
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Pagination Controls */}
      {pagination.totalPages > 1 && (
        <div className="flex items-center justify-between border-t border-slate-200 pt-4">
          <p className="text-xs text-slate-500">
            Showing <span className="font-semibold text-slate-900">{quizzes.length}</span> of{' '}
            <span className="font-semibold text-slate-900">{pagination.total}</span> quizzes
          </p>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={!pagination.hasPrevPage}
              onClick={() => setPage((p) => Math.max(p - 1, 1))}
              icon={<ChevronLeft className="h-4 w-4" />}
            >
              Previous
            </Button>
            <span className="text-xs text-slate-600 px-2 font-medium">
              Page {pagination.page} of {pagination.totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              disabled={!pagination.hasNextPage}
              onClick={() => setPage((p) => p + 1)}
              icon={<ChevronRight className="h-4 w-4" />}
            >
              Next
            </Button>
          </div>
        </div>
      )}

      {/* Confirmation Modal */}
      <Modal
        isOpen={confirmModal.isOpen}
        onClose={() =>
          setConfirmModal({ isOpen: false, type: null, quiz: null, loading: false, error: null })
        }
        title={
          confirmModal.type === 'DELETE'
            ? 'Delete Quiz Confirmation'
            : confirmModal.type === 'PUBLISH'
            ? 'Publish Quiz Confirmation'
            : 'Archive Quiz Confirmation'
        }
      >
        <div className="space-y-4">
          {confirmModal.error && (
            <div className="flex items-center gap-2 p-3 bg-rose-50 border border-rose-200 rounded-lg text-xs text-rose-700">
              <AlertTriangle className="h-4 w-4 shrink-0 text-rose-600" />
              <span>{confirmModal.error}</span>
            </div>
          )}

          <p className="text-sm text-slate-600">
            {confirmModal.type === 'DELETE' && (
              <>
                Are you sure you want to permanently delete{' '}
                <strong className="text-slate-900 font-semibold">{confirmModal.quiz?.title}</strong>
                ? This action cannot be undone.
              </>
            )}
            {confirmModal.type === 'PUBLISH' && (
              <>
                Publishing{' '}
                <strong className="text-slate-900 font-semibold">{confirmModal.quiz?.title}</strong>{' '}
                will mark it ready for competition sessions. Ensure you have added and reviewed all questions.
              </>
            )}
            {confirmModal.type === 'ARCHIVE' && (
              <>
                Archiving{' '}
                <strong className="text-slate-900 font-semibold">{confirmModal.quiz?.title}</strong>{' '}
                will lock editing and place it in the archive.
              </>
            )}
          </p>

          <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
            <Button
              variant="outline"
              onClick={() =>
                setConfirmModal({ isOpen: false, type: null, quiz: null, loading: false, error: null })
              }
              disabled={confirmModal.loading}
            >
              Cancel
            </Button>
            <Button
              variant={confirmModal.type === 'DELETE' ? 'danger' : 'primary'}
              loading={confirmModal.loading}
              onClick={handleActionConfirm}
            >
              {confirmModal.type === 'DELETE'
                ? 'Yes, Delete Quiz'
                : confirmModal.type === 'PUBLISH'
                ? 'Publish Quiz'
                : 'Archive Quiz'}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};

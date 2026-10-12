import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import {
  History,
  Search,
  Users,
  Trophy,
  ArrowRight,
  Download,
  Calendar,
  Sparkles,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { sessionApi } from '../../services/sessionApi';
import { HistoricalCompetitionSummary, Pagination } from '../../types';
import { Card } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { LoadingSkeleton } from '../../components/ui/LoadingSkeleton';

export const CompetitionHistoryPage: React.FC = () => {
  const [competitions, setCompetitions] = useState<HistoricalCompetitionSummary[]>([]);
  const [pagination, setPagination] = useState<Pagination>({
    page: 1,
    limit: 10,
    total: 0,
    totalPages: 1,
    hasNextPage: false,
    hasPrevPage: false,
  });
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [page, setPage] = useState(1);

  const loadHistory = useCallback(async () => {
    try {
      setLoading(true);
      const res = await sessionApi.listHistory({
        page,
        limit: 10,
        search: search.trim() || undefined,
        status: statusFilter !== 'ALL' ? statusFilter : undefined,
      });
      setCompetitions(res.items);
      setPagination(res.pagination);
    } catch (err) {
      console.error('Failed to load competition history:', err);
    } finally {
      setLoading(false);
    }
  }, [page, search, statusFilter]);

  useEffect(() => {
    loadHistory();
  }, [loadHistory]);

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <History className="h-6 w-6 text-indigo-600" /> Competition History
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Audit completed competitions, review participant scores, and download official records
          </p>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search by room code or quiz title..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            className="w-full pl-9 pr-4 py-2 text-sm rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-100 focus:border-indigo-500 transition-all placeholder:text-slate-400"
          />
        </div>

        <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-lg border border-slate-200/80">
          {['ALL', 'COMPLETED', 'QUESTION_ACTIVE', 'WAITING'].map((status) => (
            <button
              key={status}
              onClick={() => {
                setStatusFilter(status);
                setPage(1);
              }}
              className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-all ${
                statusFilter === status
                  ? 'bg-white text-indigo-700 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {status === 'ALL' ? 'All Sessions' : status.replace('_', ' ')}
            </button>
          ))}
        </div>
      </div>

      {/* List / Empty State */}
      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3, 4].map((i) => (
            <Card key={i} className="p-5">
              <LoadingSkeleton className="h-6 w-1/3 mb-2" />
              <LoadingSkeleton className="h-4 w-1/4" />
            </Card>
          ))}
        </div>
      ) : competitions.length === 0 ? (
        <Card className="p-12 text-center bg-white border border-dashed border-slate-300">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-600 mb-4">
            <Sparkles className="h-7 w-7" />
          </div>
          <h3 className="text-lg font-bold text-slate-900">No competition records found</h3>
          <p className="mt-1 text-sm text-slate-500 max-w-md mx-auto">
            Once you launch live multiplayer rounds from your published quizzes, their completed
            analytics and rankings will appear here.
          </p>
          <div className="mt-6">
            <Link to="/quizzes">
              <Button variant="primary">Go to Quiz Library</Button>
            </Link>
          </div>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-3.5">
          {competitions.map((comp) => (
            <Card
              key={comp.sessionId}
              className="p-5 hover:border-indigo-200 transition-all bg-white"
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="space-y-1.5">
                  <div className="flex items-center gap-2.5">
                    <span className="font-mono text-xs px-2.5 py-0.5 rounded-md bg-indigo-50 text-indigo-700 font-bold border border-indigo-200">
                      {comp.roomCode}
                    </span>
                    <h3 className="font-bold text-slate-900 text-base">{comp.quizTitle}</h3>
                    <Badge status={comp.status} />
                  </div>

                  <div className="flex items-center gap-4 text-xs text-slate-500 flex-wrap pt-1">
                    <span className="flex items-center gap-1 font-medium">
                      <Users className="h-3.5 w-3.5 text-slate-400" />
                      {comp.participantCount} Participants
                    </span>
                    <span className="flex items-center gap-1 font-medium text-amber-600">
                      <Trophy className="h-3.5 w-3.5 text-amber-500" />
                      High Score: {comp.highestScore} pts
                    </span>
                    <span className="flex items-center gap-1 text-slate-400">
                      <Calendar className="h-3.5 w-3.5" />
                      {new Date(comp.createdAt).toLocaleDateString()}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2 self-end sm:self-center">
                  <a
                    href={sessionApi.getLeaderboardCsvUrl(comp.roomCode)}
                    download={`leaderboard-${comp.roomCode}.csv`}
                  >
                    <Button variant="outline" size="sm" icon={<Download className="h-3.5 w-3.5" />}>
                      CSV
                    </Button>
                  </a>
                  <Link to={`/history/${comp.sessionId}`}>
                    <Button
                      variant="primary"
                      size="sm"
                      icon={<ArrowRight className="h-3.5 w-3.5" />}
                    >
                      View Analytics
                    </Button>
                  </Link>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Pagination Bar */}
      {pagination.totalPages > 1 && (
        <div className="flex items-center justify-between bg-white px-4 py-3 rounded-xl border border-slate-200 text-xs text-slate-500">
          <span>
            Showing page <strong className="text-slate-800">{pagination.page}</strong> of{' '}
            <strong className="text-slate-800">{pagination.totalPages}</strong> ({pagination.total}{' '}
            total)
          </span>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={!pagination.hasPrevPage}
              onClick={() => setPage((p) => p - 1)}
              icon={<ChevronLeft className="h-3.5 w-3.5" />}
            >
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={!pagination.hasNextPage}
              onClick={() => setPage((p) => p + 1)}
              icon={<ChevronRight className="h-3.5 w-3.5" />}
            >
              Next
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};

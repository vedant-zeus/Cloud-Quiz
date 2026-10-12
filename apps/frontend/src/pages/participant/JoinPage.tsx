import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { Sparkles, ArrowRight, User, Hash, AlertCircle, Trophy, ArrowLeft } from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { socketService } from '../../services/socketService';

export const JoinPage: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const [roomCode, setRoomCode] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const codeParam = searchParams.get('code');
    if (codeParam) {
      setRoomCode(codeParam.trim().toUpperCase());
    }
  }, [searchParams]);

  const handleJoin = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanCode = roomCode.trim().toUpperCase();
    const cleanName = displayName.trim();

    if (!cleanCode || cleanCode.length !== 6) {
      setError('Please enter a valid 6-character room code.');
      return;
    }

    if (!cleanName || cleanName.length < 2) {
      setError('Display name must be at least 2 characters.');
      return;
    }

    try {
      setLoading(true);
      setError(null);

      // Ensure socket connection
      socketService.connect();

      const joinResult = await socketService.joinRoom(cleanCode, cleanName);

      // Store participant credential in sessionStorage for reconnection & state recovery
      const participantSession = {
        roomCode: cleanCode,
        participantId: joinResult.participantId,
        displayName: cleanName,
        token: joinResult.token,
      };

      sessionStorage.setItem(`cloudquiz_participant_${cleanCode}`, JSON.stringify(participantSession));
      sessionStorage.setItem('cloudquiz_active_room', cleanCode);

      // Navigate to play page
      navigate(`/play/${cleanCode}`);
    } catch (err: unknown) {
      const errorObj = err as { message?: string };
      setError(errorObj.message || 'Unable to join the competition room. Please verify the code.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-900 via-indigo-950 to-slate-950 flex flex-col justify-between p-4 sm:p-6 text-slate-100">
      {/* Top Navbar */}
      <header className="max-w-4xl mx-auto w-full flex items-center justify-between py-4">
        <Link to="/" className="flex items-center gap-2.5 text-white group">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-600 text-white shadow-lg shadow-indigo-500/30 group-hover:scale-105 transition-transform">
            <Sparkles className="h-5 w-5" />
          </div>
          <div>
            <span className="font-bold text-lg tracking-tight">CloudQuiz</span>
            <span className="block text-[11px] text-indigo-300 font-medium tracking-wide uppercase">
              Live Competition
            </span>
          </div>
        </Link>
        <Link to="/login" className="text-xs text-indigo-300 hover:text-white transition-colors">
          Host Portal &rarr;
        </Link>
      </header>

      {/* Main Join Card */}
      <main className="max-w-md w-full mx-auto my-auto py-8">
        <div className="bg-slate-900/90 backdrop-blur-md border border-slate-800 rounded-2xl p-6 sm:p-8 shadow-2xl shadow-indigo-950/50">
          <div className="text-center mb-6">
            <div className="inline-flex p-3 rounded-2xl bg-indigo-600/10 border border-indigo-500/20 text-indigo-400 mb-3">
              <Trophy className="h-7 w-7" />
            </div>
            <h1 className="text-2xl font-bold text-white tracking-tight">Enter Live Quiz</h1>
            <p className="text-sm text-slate-400 mt-1">
              Join your college symposium round with your room code
            </p>
          </div>

          {error && (
            <div className="mb-5 p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs sm:text-sm flex items-start gap-2.5 animate-in fade-in">
              <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleJoin} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-1.5">
                Room Code
              </label>
              <div className="relative">
                <Hash className="absolute left-3.5 top-1/2 -translate-y-1/2 h-5 w-5 text-indigo-400" />
                <input
                  type="text"
                  maxLength={6}
                  placeholder="e.g. ABC123"
                  value={roomCode}
                  onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
                  className="w-full pl-11 pr-4 py-3 bg-slate-950/60 border border-slate-700 rounded-xl text-center font-mono font-bold text-lg tracking-widest text-white placeholder:text-slate-600 placeholder:font-sans placeholder:tracking-normal focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all uppercase"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-1.5">
                Your Display Name / Nickname
              </label>
              <div className="relative">
                <User className="absolute left-3.5 top-1/2 -translate-y-1/2 h-5 w-5 text-indigo-400" />
                <input
                  type="text"
                  maxLength={30}
                  placeholder="e.g. Alex Turing"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  className="w-full pl-11 pr-4 py-3 bg-slate-950/60 border border-slate-700 rounded-xl text-white placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all text-sm font-medium"
                  required
                />
              </div>
              <p className="text-[11px] text-slate-400 mt-1">
                This name will be displayed on the live podium & leaderboard.
              </p>
            </div>

            <Button
              type="submit"
              variant="primary"
              size="lg"
              className="w-full py-3.5 mt-2 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold shadow-lg shadow-indigo-600/30 text-base"
              disabled={loading || !roomCode || !displayName}
            >
              {loading ? (
                <span className="flex items-center gap-2">
                  <div className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Connecting to Room...
                </span>
              ) : (
                <span className="flex items-center gap-2">
                  Join Competition <ArrowRight className="h-4 w-4" />
                </span>
              )}
            </Button>
          </form>

          <div className="mt-6 pt-5 border-t border-slate-800 text-center">
            <Link
              to="/dashboard"
              className="inline-flex items-center gap-1.5 text-xs text-slate-400 hover:text-slate-200 transition-colors"
            >
              <ArrowLeft className="h-3.5 w-3.5" /> Are you a quiz host? Go to host dashboard
            </Link>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="max-w-4xl mx-auto w-full py-4 text-center text-xs text-slate-500">
        CloudQuiz Real-Time Multiplayer Engine &bull; College Competition Platform
      </footer>
    </div>
  );
};

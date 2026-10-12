import React from 'react';
import { Crown, Medal, Trophy, Award } from 'lucide-react';
import { LeaderboardEntry } from '../../types';

interface PodiumProps {
  entries: LeaderboardEntry[];
  currentParticipantId?: string;
}

export const Podium: React.FC<PodiumProps> = ({ entries, currentParticipantId }) => {
  if (!entries || entries.length === 0) {
    return (
      <div className="p-8 text-center text-slate-400 bg-slate-900/40 rounded-2xl border border-slate-800">
        <Trophy className="h-10 w-10 mx-auto text-slate-600 mb-2" />
        <p className="text-sm">No leaderboard standings available yet.</p>
      </div>
    );
  }

  const first = entries[0];
  const second = entries.length > 1 ? entries[1] : null;
  const third = entries.length > 2 ? entries[2] : null;

  return (
    <div className="py-6 px-4">
      <div className="flex items-end justify-center gap-3 sm:gap-6 max-w-lg mx-auto">
        {/* 2nd Place (Silver) */}
        {second && (
          <div className="flex-1 flex flex-col items-center animate-in slide-in-from-bottom duration-300">
            <div className="relative mb-2 flex flex-col items-center">
              <div
                className={`flex h-12 w-12 sm:h-14 sm:w-14 items-center justify-center rounded-2xl bg-gradient-to-tr from-slate-400 to-slate-200 text-slate-900 font-black shadow-lg shadow-slate-500/20 ${
                  currentParticipantId === second.participantId ? 'ring-2 ring-indigo-400' : ''
                }`}
              >
                <Medal className="h-6 w-6 text-slate-700" />
              </div>
              <span className="mt-1.5 font-bold text-xs sm:text-sm text-slate-200 text-center line-clamp-1 max-w-[100px]">
                {second.displayName}
              </span>
              <span className="font-mono text-xs font-semibold text-slate-400">
                {second.score} pts
              </span>
            </div>
            {/* Podium block */}
            <div className="w-full h-24 sm:h-28 bg-gradient-to-b from-slate-700 to-slate-800/90 rounded-t-2xl border-t border-x border-slate-600 flex flex-col items-center justify-center shadow-lg">
              <span className="text-2xl sm:text-3xl font-black text-slate-300">2</span>
              <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400">
                Silver
              </span>
            </div>
          </div>
        )}

        {/* 1st Place (Gold / Crown) */}
        {first && (
          <div className="flex-1 flex flex-col items-center -mt-6 animate-in slide-in-from-bottom duration-500 z-10">
            <div className="relative mb-2 flex flex-col items-center">
              <div className="absolute -top-6 text-amber-400 animate-bounce">
                <Crown className="h-6 w-6 sm:h-7 sm:w-7 fill-amber-400" />
              </div>
              <div
                className={`flex h-14 w-14 sm:h-16 sm:w-16 items-center justify-center rounded-2xl bg-gradient-to-tr from-amber-500 via-amber-400 to-yellow-300 text-amber-950 font-black shadow-xl shadow-amber-500/30 ${
                  currentParticipantId === first.participantId ? 'ring-2 ring-indigo-400' : ''
                }`}
              >
                <Trophy className="h-7 w-7 sm:h-8 sm:w-8 text-amber-900" />
              </div>
              <span className="mt-1.5 font-bold text-sm sm:text-base text-white text-center line-clamp-1 max-w-[120px]">
                {first.displayName}
              </span>
              <span className="font-mono text-xs sm:text-sm font-bold text-amber-400">
                {first.score} pts
              </span>
            </div>
            {/* Podium block */}
            <div className="w-full h-32 sm:h-36 bg-gradient-to-b from-amber-600/90 via-amber-700/80 to-slate-900 rounded-t-2xl border-t border-x border-amber-500/50 flex flex-col items-center justify-center shadow-xl">
              <span className="text-3xl sm:text-4xl font-black text-amber-200">1</span>
              <span className="text-[10px] sm:text-xs uppercase font-extrabold tracking-wider text-amber-300">
                Champion
              </span>
            </div>
          </div>
        )}

        {/* 3rd Place (Bronze) */}
        {third && (
          <div className="flex-1 flex flex-col items-center animate-in slide-in-from-bottom duration-400">
            <div className="relative mb-2 flex flex-col items-center">
              <div
                className={`flex h-12 w-12 sm:h-14 sm:w-14 items-center justify-center rounded-2xl bg-gradient-to-tr from-amber-700 to-amber-600 text-amber-100 font-black shadow-lg shadow-amber-800/20 ${
                  currentParticipantId === third.participantId ? 'ring-2 ring-indigo-400' : ''
                }`}
              >
                <Award className="h-6 w-6 text-amber-300" />
              </div>
              <span className="mt-1.5 font-bold text-xs sm:text-sm text-slate-300 text-center line-clamp-1 max-w-[100px]">
                {third.displayName}
              </span>
              <span className="font-mono text-xs font-semibold text-slate-400">
                {third.score} pts
              </span>
            </div>
            {/* Podium block */}
            <div className="w-full h-20 sm:h-22 bg-gradient-to-b from-amber-800/70 to-slate-800/90 rounded-t-2xl border-t border-x border-amber-700/60 flex flex-col items-center justify-center shadow-lg">
              <span className="text-2xl sm:text-3xl font-black text-amber-400/80">3</span>
              <span className="text-[10px] uppercase font-bold tracking-wider text-amber-500/80">
                Bronze
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

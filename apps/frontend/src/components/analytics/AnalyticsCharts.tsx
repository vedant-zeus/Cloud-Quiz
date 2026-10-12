import React from 'react';
import { BarChart3, TrendingUp, Clock } from 'lucide-react';
import { DetailedQuestionAnalytics } from '../../types';

interface ScoreDistributionProps {
  distribution: Array<{ bracket: string; count: number }>;
  totalParticipants: number;
}

export const ScoreDistributionChart: React.FC<ScoreDistributionProps> = ({
  distribution,
  totalParticipants,
}) => {
  const maxCount = Math.max(...distribution.map((d) => d.count), 1);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
        <span className="flex items-center gap-1.5">
          <BarChart3 className="h-4 w-4 text-indigo-400" /> Score Brackets
        </span>
        <span>Participants</span>
      </div>

      {distribution.map((d, idx) => {
        const pct = totalParticipants > 0 ? Math.round((d.count / totalParticipants) * 100) : 0;
        const barWidthPct = Math.round((d.count / maxCount) * 100);

        return (
          <div key={idx} className="space-y-1">
            <div className="flex items-center justify-between text-xs">
              <span className="font-medium text-slate-300">{d.bracket}</span>
              <span className="font-mono text-slate-400">
                {d.count} ({pct}%)
              </span>
            </div>
            <div className="h-2.5 w-full bg-slate-800 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-indigo-500 to-indigo-400 rounded-full transition-all duration-500 ease-out"
                style={{ width: `${barWidthPct}%` }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
};

interface QuestionAccuracyChartProps {
  questions: DetailedQuestionAnalytics[];
}

export const QuestionAccuracyChart: React.FC<QuestionAccuracyChartProps> = ({ questions }) => {
  return (
    <div className="space-y-3.5">
      <div className="flex items-center justify-between text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
        <span className="flex items-center gap-1.5">
          <TrendingUp className="h-4 w-4 text-emerald-400" /> Question Accuracy Trend
        </span>
        <span>Success Rate</span>
      </div>

      {questions.map((q) => {
        let barColor = 'from-emerald-500 to-emerald-400';
        let badgeColor = 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30';

        if (q.accuracyPercentage < 40) {
          barColor = 'from-rose-500 to-rose-400';
          badgeColor = 'text-rose-400 bg-rose-500/10 border-rose-500/30';
        } else if (q.accuracyPercentage < 70) {
          barColor = 'from-amber-500 to-amber-400';
          badgeColor = 'text-amber-400 bg-amber-500/10 border-amber-500/30';
        }

        return (
          <div key={q.questionId} className="space-y-1">
            <div className="flex items-center justify-between text-xs">
              <div className="flex items-center gap-2">
                <span className="font-bold text-slate-200">Q{q.questionNumber}:</span>
                <span className="text-slate-400 line-clamp-1 max-w-[220px] sm:max-w-md">
                  {q.text}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="flex items-center gap-1 font-mono text-[11px] text-slate-400">
                  <Clock className="h-3 w-3" /> {(q.averageResponseTimeMs / 1000).toFixed(1)}s
                </span>
                <span
                  className={`px-2 py-0.5 rounded-md font-mono font-bold text-xs border ${badgeColor}`}
                >
                  {q.accuracyPercentage}%
                </span>
              </div>
            </div>
            <div className="h-2.5 w-full bg-slate-800 rounded-full overflow-hidden">
              <div
                className={`h-full bg-gradient-to-r ${barColor} rounded-full transition-all duration-500 ease-out`}
                style={{ width: `${q.accuracyPercentage}%` }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
};

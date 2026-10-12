import React from 'react';
import { QuizStatus } from '../../types';

interface BadgeProps {
  status?: QuizStatus | string;
  variant?: 'draft' | 'published' | 'archived' | 'neutral' | 'info';
  children?: React.ReactNode;
  className?: string;
}

export const Badge: React.FC<BadgeProps> = ({ status, variant, children, className = '' }) => {
  let colorStyles = 'bg-slate-100 text-slate-700 border-slate-200';

  const effectiveVariant = variant || (status ? status.toLowerCase() : 'neutral');

  if (effectiveVariant === 'published') {
    colorStyles = 'bg-emerald-50 text-emerald-700 border-emerald-200';
  } else if (effectiveVariant === 'draft') {
    colorStyles = 'bg-amber-50 text-amber-700 border-amber-200';
  } else if (effectiveVariant === 'archived') {
    colorStyles = 'bg-slate-100 text-slate-600 border-slate-300';
  } else if (effectiveVariant === 'info') {
    colorStyles = 'bg-indigo-50 text-indigo-700 border-indigo-200';
  }

  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold border ${colorStyles} ${className}`}
    >
      {children || status}
    </span>
  );
};

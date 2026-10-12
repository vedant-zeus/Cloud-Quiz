import React from 'react';

export const LoadingSkeleton: React.FC<{ className?: string }> = ({ className = 'h-4 w-full' }) => {
  return <div className={`animate-pulse bg-slate-200/80 rounded-md ${className}`} />;
};

export const CardSkeleton: React.FC = () => {
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-6 space-y-4">
      <div className="flex justify-between items-center">
        <LoadingSkeleton className="h-6 w-1/3" />
        <LoadingSkeleton className="h-5 w-16 rounded-full" />
      </div>
      <LoadingSkeleton className="h-4 w-4/5" />
      <LoadingSkeleton className="h-4 w-1/2" />
      <div className="pt-4 border-t border-slate-100 flex justify-between">
        <LoadingSkeleton className="h-4 w-24" />
        <LoadingSkeleton className="h-8 w-20 rounded-lg" />
      </div>
    </div>
  );
};

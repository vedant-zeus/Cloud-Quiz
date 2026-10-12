import React from 'react';

interface CardProps {
  children: React.ReactNode;
  className?: string;
  onClick?: () => void;
}

export const Card: React.FC<CardProps> = ({ children, className = '', onClick }) => {
  return (
    <div
      onClick={onClick}
      className={`bg-white rounded-xl border border-slate-200/80 shadow-sm overflow-hidden ${
        onClick ? 'cursor-pointer hover:border-indigo-300 transition-all' : ''
      } ${className}`}
    >
      {children}
    </div>
  );
};

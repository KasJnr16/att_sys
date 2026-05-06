import React from 'react';

interface BadgeProps {
  children: React.ReactNode;
  variant?: 'success' | 'danger' | 'warning' | 'info' | 'gray' | 'purple';
  className?: string;
  dot?: boolean;
}

export const Badge: React.FC<BadgeProps> = ({
  children,
  variant = 'gray',
  className = '',
  dot = false,
}) => {
  const variants = {
    success: 'bg-emerald-50 text-emerald-700 ring-emerald-600/30',
    danger: 'bg-red-50 text-red-700 ring-red-600/30',
    warning: 'bg-amber-50 text-amber-700 ring-amber-600/30',
    info: 'bg-indigo-50 text-indigo-700 ring-indigo-600/30',
    purple: 'bg-purple-50 text-purple-700 ring-purple-600/30',
    gray: 'bg-slate-100 text-slate-700 ring-slate-600/30',
  };

  const dotColors = {
    success: 'bg-emerald-500',
    danger: 'bg-red-500',
    warning: 'bg-amber-500',
    info: 'bg-indigo-500',
    purple: 'bg-purple-500',
    gray: 'bg-slate-500',
  };

  return (
    <span className={`inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-xs font-medium ring-1 ring-inset ${variants[variant]} ${className}`}>
      {dot && <span className={`h-1.5 w-1.5 rounded-full ${dotColors[variant]}`} />}
      {children}
    </span>
  );
};

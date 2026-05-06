import React from 'react';
import { Loader2 } from 'lucide-react';

interface LoaderProps {
  size?: 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
  color?: 'primary' | 'white' | 'muted';
}

export const Loader: React.FC<LoaderProps> = ({
  size = 'md',
  className = '',
  color = 'primary',
}) => {
  const sizes = {
    sm: 'h-4 w-4',
    md: 'h-6 w-6',
    lg: 'h-10 w-10',
    xl: 'h-14 w-14',
  };

  const colors = {
    primary: 'text-indigo-600',
    white: 'text-white',
    muted: 'text-slate-400',
  };

  return (
    <div className={`flex items-center justify-center ${className}`}>
      <Loader2 className={`${sizes[size]} animate-spin ${colors[color]}`} />
    </div>
  );
};

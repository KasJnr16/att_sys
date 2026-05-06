import React from 'react';
import { User } from 'lucide-react';

interface AvatarProps {
  src?: string | null;
  alt?: string;
  fallback?: string;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
}

export const Avatar: React.FC<AvatarProps> = ({
  src,
  alt = 'Avatar',
  fallback,
  size = 'md',
  className = '',
}) => {
  const sizes = {
    xs: 'h-6 w-6 text-xs',
    sm: 'h-8 w-8 text-sm',
    md: 'h-10 w-10 text-base',
    lg: 'h-12 w-12 text-lg',
    xl: 'h-16 w-16 text-xl',
  };

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  if (src) {
    return (
      <img
        src={src}
        alt={alt}
        className={`rounded-full object-cover ring-2 ring-white shadow-sm ${sizes[size]} ${className}`}
      />
    );
  }

  return (
    <div
      className={`flex items-center justify-center rounded-full bg-indigo-100 text-indigo-600 font-semibold ring-2 ring-white shadow-sm ${sizes[size]} ${className}`}
    >
      {fallback ? getInitials(fallback) : <User className="h-1/2 w-1/2" />}
    </div>
  );
};
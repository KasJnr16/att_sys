import React from 'react';
import { CheckCircle, XCircle, AlertTriangle, Info, X } from 'lucide-react';

interface AlertProps {
  variant?: 'success' | 'error' | 'warning' | 'info';
  title?: string;
  children: React.ReactNode;
  className?: string;
  onDismiss?: () => void;
}

export const Alert: React.FC<AlertProps> = ({
  variant = 'info',
  title,
  children,
  className = '',
  onDismiss,
}) => {
  const variants = {
    success: {
      container: 'bg-emerald-50 border-emerald-200',
      icon: CheckCircle,
      iconColor: 'text-emerald-500',
      titleColor: 'text-emerald-800',
      textColor: 'text-emerald-700',
    },
    error: {
      container: 'bg-red-50 border-red-200',
      icon: XCircle,
      iconColor: 'text-red-500',
      titleColor: 'text-red-800',
      textColor: 'text-red-700',
    },
    warning: {
      container: 'bg-amber-50 border-amber-200',
      icon: AlertTriangle,
      iconColor: 'text-amber-500',
      titleColor: 'text-amber-800',
      textColor: 'text-amber-700',
    },
    info: {
      container: 'bg-blue-50 border-blue-200',
      icon: Info,
      iconColor: 'text-blue-500',
      titleColor: 'text-blue-800',
      textColor: 'text-blue-700',
    },
  };

  const { container, icon: Icon, iconColor, titleColor, textColor } = variants[variant];

  return (
    <div className={`flex gap-3 rounded-lg border p-4 animate-fade-in ${container} ${className}`}>
      <Icon className={`h-5 w-5 shrink-0 mt-0.5 ${iconColor}`} />
      <div className="flex-1 min-w-0">
        {title && (
          <h4 className={`font-semibold text-sm ${titleColor}`}>{title}</h4>
        )}
        <div className={`text-sm ${title ? 'mt-1' : ''} ${textColor}`}>{children}</div>
      </div>
      {onDismiss && (
        <button
          onClick={onDismiss}
          className={`shrink-0 rounded p-1 transition-colors hover:bg-black/5 ${textColor}`}
          aria-label="Dismiss"
        >
          <X className="h-4 w-4" />
        </button>
      )}
    </div>
  );
};
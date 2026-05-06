import React from 'react';

interface CardProps {
  children: React.ReactNode;
  title?: string;
  description?: string;
  className?: string;
  headerAction?: React.ReactNode;
  footer?: React.ReactNode;
  padding?: 'none' | 'sm' | 'md' | 'lg';
}

export const Card: React.FC<CardProps> = ({
  children,
  title,
  description,
  className = '',
  headerAction,
  footer,
  padding = 'md',
}) => {
  const paddingClasses = {
    none: '',
    sm: 'p-4',
    md: 'p-5 sm:p-6',
    lg: 'p-6 sm:p-8',
  };

  return (
    <div className={`rounded-xl bg-white border border-slate-200/80 shadow-sm overflow-hidden ${className}`}>
      {(title || description || headerAction) && (
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
          <div>
            {title && <h3 className="text-lg font-semibold text-slate-900 leading-tight">{title}</h3>}
            {description && <p className="mt-1 text-sm text-slate-500">{description}</p>}
          </div>
          {headerAction && <div>{headerAction}</div>}
        </div>
      )}
      <div className={paddingClasses[padding]}>{children}</div>
      {footer && <div className="px-5 py-4 border-t border-slate-100 bg-slate-50/50">{footer}</div>}
    </div>
  );
};

import React from 'react';
import { Check } from 'lucide-react';

interface StepperProps {
  steps: string[];
  currentStep: number;
  className?: string;
}

export const Stepper: React.FC<StepperProps> = ({
  steps,
  currentStep,
  className = '',
}) => {
  return (
    <div className={`flex items-center ${className}`}>
      {steps.map((step, index) => {
        const isCompleted = index + 1 < currentStep;
        const isCurrent = index + 1 === currentStep;
        const isLast = index === steps.length - 1;

        return (
          <React.Fragment key={step}>
            <div className="flex items-center gap-3">
              <div
                className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-semibold transition-all duration-300 ${
                  isCompleted
                    ? 'bg-emerald-500 text-white'
                    : isCurrent
                    ? 'bg-indigo-600 text-white ring-4 ring-indigo-100'
                    : 'bg-slate-100 text-slate-500'
                }`}
              >
                {isCompleted ? <Check className="h-4 w-4" /> : index + 1}
              </div>
              <span
                className={`text-sm font-medium hidden sm:block ${
                  isCurrent ? 'text-slate-900' : 'text-slate-500'
                }`}
              >
                {step}
              </span>
            </div>
            {!isLast && (
              <div
                className={`mx-3 h-0.5 w-8 sm:w-12 transition-colors duration-300 ${
                  isCompleted ? 'bg-emerald-500' : 'bg-slate-200'
                }`}
              />
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
};
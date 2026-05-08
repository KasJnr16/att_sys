import React, { useState } from 'react';
import Link from 'next/link';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { GraduationCap, Mail, Lock } from 'lucide-react';
import { Input } from './ui/Input';
import { Button } from './ui/Button';
import { Alert } from './ui/Alert';
import { useAuth } from '@/hooks/useAuth';
import { toast } from '@/lib/toast';

const schema = z.object({
  email: z.string().email('Please enter a valid university email'),
  password: z.string().min(1, 'Password is required'),
});

const NOTICE_NAVIGATION_DELAY_MS = 1200;

type FormData = z.infer<typeof schema>;

interface LoginFormProps {
  onSuccess?: () => void;
  title?: string;
  description?: string;
}

export const LoginForm: React.FC<LoginFormProps> = ({ 
  onSuccess,
  title = "Sign in to your account",
  description = "Secure biometric attendance system"
}) => {
  const { login: authLogin } = useAuth();
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      email: '',
      password: '',
    },
  });

  const onSubmit = async (data: FormData) => {
    setError('');
    setSubmitting(true);
    try {
      const result = await authLogin(data.email, data.password);
      if (result.success) {
        toast.success('Signed in successfully', 'Opening your dashboard...', 3000);
        await new Promise((resolve) => window.setTimeout(resolve, NOTICE_NAVIGATION_DELAY_MS));
        if (onSuccess) onSuccess();
      } else {
        const message = result.error || 'Unable to sign in. Please try again.';
        setError(message);
        toast.error('Could not sign in', message, 6000);
      }
    } finally {
      setSubmitting(false);
    }
  };

  const submitForm = handleSubmit(onSubmit);
  const handleEnterSubmit = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== 'Enter') {
      return;
    }

    event.preventDefault();
    void submitForm();
  };

  const showHeader = Boolean(title || description);

  return (
    <div className="w-full max-w-md">
      {showHeader ? (
        <div className="flex items-center gap-3 mb-8">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 shadow-lg shadow-indigo-500/25">
            <GraduationCap className="h-6 w-6 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900">{title}</h1>
            <p className="text-sm text-slate-500">{description}</p>
          </div>
        </div>
      ) : null}

      <div
        className="space-y-5"
        role="form"
        onKeyDown={handleEnterSubmit}
      >
        {error && (
          <Alert variant="error" onDismiss={() => setError('')}>
            {error}
          </Alert>
        )}

        <Input
          {...register('email')}
          label="University Email"
          type="email"
          placeholder="lecturer@university.edu"
          error={errors.email?.message}
          disabled={submitting}
          leftIcon={<Mail className="h-5 w-5" />}
          autoComplete="email"
        />

        <Input
          {...register('password')}
          label="Password"
          type="password"
          placeholder="Enter your password"
          error={errors.password?.message}
          disabled={submitting}
          leftIcon={<Lock className="h-5 w-5" />}
          autoComplete="current-password"
        />

        <Button
          type="submit"
          className="w-full"
          size="lg"
          isLoading={submitting}
          onClick={() => void submitForm()}
        >
          Sign in
        </Button>
      </div>

      <div className="mt-6 text-center">
        <p className="text-sm text-slate-500">
          Forgot your password?{' '}
          <Link href="/auth/reset-password" className="font-medium text-indigo-600 hover:text-indigo-700 transition-colors">
            Reset it
          </Link>
        </p>
      </div>
    </div>
  );
};

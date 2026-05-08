'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { GraduationCap, BookOpen, QrCode, BarChart3, Shield, Mail, Lock } from 'lucide-react';
import api from '@/lib/api';
import type { ApiRequestConfig } from '@/lib/api';
import { LoginForm } from '@/components/LoginForm';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Alert } from '@/components/ui/Alert';
import { toast } from '@/lib/toast';

const createAccountSchema = z.object({
  email: z.string().email('Please enter a valid email'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
});

type CreateAccountFormData = z.infer<typeof createAccountSchema>;

const features = [
  { icon: BookOpen, text: 'Manage all your classes' },
  { icon: QrCode, text: 'Start attendance sessions in seconds' },
  { icon: BarChart3, text: 'Track attendance in real-time' },
  { icon: Shield, text: 'Biometric verification for every student' },
];

export default function LecturerAuthPage() {
  const router = useRouter();
  const [showCreateAccount, setShowCreateAccount] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState({ type: 'success', text: '' });
  const [globalError, setGlobalError] = useState('');

  const {
    register: registerCreate,
    handleSubmit: handleCreateSubmit,
    formState: { errors: createErrors },
    reset: resetCreate,
  } = useForm<CreateAccountFormData>({
    resolver: zodResolver(createAccountSchema),
    defaultValues: {
      email: '',
      password: '',
    },
  });

  const onCreateAccount = async (data: CreateAccountFormData) => {
    setGlobalError('');
    setMessage({ type: 'success', text: '' });
    setLoading(true);

    try {
      await api.post('/auth/register-user', {
        email: data.email,
        password: data.password,
        role_id: 2,
      }, {
        skipAuthRedirect: true,
        toast: false,
      } as ApiRequestConfig);
      setMessage({ type: 'success', text: 'Account created successfully. Check your email to verify it.' });
      toast.success('Check your email', 'Use the verification link or code to finish setup.', 6000);
      resetCreate();
      router.push(`/auth/verify-email?email=${encodeURIComponent(data.email)}`);
    } catch (err: unknown) {
      const error = err as { response?: { data?: { detail?: string } } };
      const message = error.response?.data?.detail || 'Unable to create account. Contact an administrator.';
      setGlobalError(message);
      toast.error('Could not create account', message, 6000);
    } finally {
      setLoading(false);
    }
  };

  const submitCreateAccount = handleCreateSubmit(onCreateAccount);
  const handleCreateAccountEnter = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== 'Enter') {
      return;
    }

    event.preventDefault();
    void submitCreateAccount();
  };

  return (
    <div className="min-h-screen bg-[#09090b] flex">
      <div className="hidden lg:flex lg:w-1/2 bg-gradient-to-br from-indigo-600 via-purple-600 to-pink-600 relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(255,255,255,0.15),transparent_50%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_70%_80%,rgba(255,255,255,0.1),transparent_40%)]" />

        <div className="relative z-10 flex flex-col justify-between p-12 text-white">
          <Link href="/" className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/20 backdrop-blur-sm">
              <GraduationCap className="h-5 w-5" />
            </div>
            <span className="text-xl font-bold">UniAtt</span>
          </Link>

          <div className="space-y-8">
            <h1 className="text-4xl font-bold leading-tight">
              Secure attendance management for modern educators
            </h1>
            <p className="text-lg text-white/80 max-w-md">
              Everything you need to manage classes, start sessions, and track student attendance with confidence.
            </p>
            <div className="space-y-4">
              {features.map((feature) => (
                <div key={feature.text} className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-white/10 backdrop-blur-sm">
                    <feature.icon className="h-5 w-5" />
                  </div>
                  <span className="text-white/90">{feature.text}</span>
                </div>
              ))}
            </div>
          </div>

          <p className="text-sm text-white/50">
            Trusted by universities worldwide
          </p>
        </div>
      </div>

      <div className="flex-1 flex items-center justify-center p-6 lg:p-12">
        <div className="w-full max-w-md">
          <div className="lg:hidden mb-8">
            <Link href="/" className="flex items-center gap-3 mb-6">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600">
                <GraduationCap className="h-5 w-5 text-white" />
              </div>
              <span className="text-xl font-bold text-white">UniAtt</span>
            </Link>
          </div>

          {!showCreateAccount ? (
            <>
              <div className="mb-8">
                <h2 className="text-2xl font-bold text-white mb-2">Welcome back</h2>
                <p className="text-slate-400">Sign in to access your dashboard</p>
              </div>
              <LoginForm
                onSuccess={() => router.push('/dashboard')}
                title=""
                description=""
              />
              <div className="mt-6 text-center">
                <p className="text-sm text-slate-500">
                  New to UniAtt?{' '}
                  <button
                    type="button"
                    onClick={() => setShowCreateAccount(true)}
                    className="font-medium text-indigo-400 hover:text-indigo-300 transition-colors"
                  >
                    Create an account
                  </button>
                </p>
              </div>
            </>
          ) : (
            <div className="w-full max-w-md">
              <div className="mb-8">
                <h2 className="text-2xl font-bold text-white mb-2">Create Account</h2>
                <p className="text-slate-400">Use your institutional email to get started.</p>
              </div>

              <div
                className="space-y-5"
                role="form"
                onKeyDown={handleCreateAccountEnter}
              >
                {message.text && (
                  <Alert variant="success">
                    {message.text}
                  </Alert>
                )}
                {globalError && (
                  <Alert variant="error" onDismiss={() => setGlobalError('')}>
                    {globalError}
                  </Alert>
                )}

                <Input
                  {...registerCreate('email')}
                  label="University Email"
                  type="email"
                  placeholder="lecturer@university.edu"
                  error={createErrors.email?.message}
                  disabled={loading}
                  leftIcon={<Mail className="h-5 w-5" />}
                  autoComplete="email"
                />
                <Input
                  {...registerCreate('password')}
                  label="Password"
                  type="password"
                  placeholder="Create a strong password"
                  error={createErrors.password?.message}
                  disabled={loading}
                  leftIcon={<Lock className="h-5 w-5" />}
                  autoComplete="new-password"
                />

                <Button
                  type="button"
                  className="w-full"
                  size="lg"
                  isLoading={loading}
                  onClick={() => void submitCreateAccount()}
                >
                  Create Account
                </Button>
              </div>

              <div className="mt-6 text-center">
                <p className="text-sm text-slate-500">
                  Already have an account?{' '}
                  <button
                    type="button"
                    onClick={() => {
                      setShowCreateAccount(false);
                      resetCreate();
                      setGlobalError('');
                      setMessage({ type: 'success', text: '' });
                    }}
                    className="font-medium text-indigo-600 hover:text-indigo-700 transition-colors"
                  >
                    Sign in
                  </button>
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

'use client';

import { Suspense, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { GraduationCap, Lock, Mail } from 'lucide-react';
import api from '@/lib/api';
import type { ApiRequestConfig } from '@/lib/api';
import { completeAuthSession } from '@/lib/auth-complete';
import { toast } from '@/lib/toast';
import { Alert } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Loader } from '@/components/ui/Loader';

const authRequestConfig = {
  skipAuthRedirect: true,
  toast: false,
} as ApiRequestConfig;

const getErrorMessage = (error: unknown, fallback: string) => {
  const maybeError = error as { response?: { data?: { detail?: string } } };
  return maybeError.response?.data?.detail || fallback;
};

function ResetPasswordContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get('token');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const requestReset = async () => {
    if (!email.trim()) {
      setError('Enter your email address.');
      return;
    }

    setLoading(true);
    setError('');
    try {
      await api.post('/auth/password-reset/request', { email: email.trim() }, authRequestConfig);
      setMessage('If an account exists for that email, a reset link has been sent.');
      toast.success('Reset email sent', 'Check your inbox for the password reset link.', 5000);
    } catch (err: unknown) {
      setError(getErrorMessage(err, 'Could not send the reset email.'));
    } finally {
      setLoading(false);
    }
  };

  const confirmReset = async () => {
    if (password.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setLoading(true);
    setError('');
    try {
      const response = await api.post('/auth/password-reset/confirm', {
        token,
        password,
      }, authRequestConfig);
      await completeAuthSession(response.data.access_token);
      toast.success('Password reset', 'Opening your dashboard...', 3000);
      router.push('/dashboard');
    } catch (err: unknown) {
      setError(getErrorMessage(err, 'Password reset link is invalid or expired.'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#09090b] flex items-center justify-center p-6">
      <div className="w-full max-w-md">
        <Link href="/auth/lecturer" className="mb-8 inline-flex items-center gap-3 text-white">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600">
            <GraduationCap className="h-5 w-5" />
          </div>
          <span className="text-xl font-bold">UniAtt</span>
        </Link>

        <div className="rounded-2xl border border-white/10 bg-white p-6 shadow-2xl">
          <div className="mb-6">
            <h1 className="text-2xl font-bold text-slate-900">
              {token ? 'Choose New Password' : 'Reset Password'}
            </h1>
            <p className="mt-1 text-sm text-slate-500">
              {token ? 'Enter a new password for your account.' : 'Enter your email and we will send you a reset link.'}
            </p>
          </div>

          <div className="space-y-4">
            {message ? <Alert variant="success">{message}</Alert> : null}
            {error ? <Alert variant="error" onDismiss={() => setError('')}>{error}</Alert> : null}

            {token ? (
              <>
                <Input
                  label="New Password"
                  type="password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder="Enter a new password"
                  leftIcon={<Lock className="h-5 w-5" />}
                  disabled={loading}
                />
                <Input
                  label="Confirm Password"
                  type="password"
                  value={confirmPassword}
                  onChange={(event) => setConfirmPassword(event.target.value)}
                  placeholder="Confirm your new password"
                  leftIcon={<Lock className="h-5 w-5" />}
                  disabled={loading}
                />
                <Button onClick={confirmReset} isLoading={loading} fullWidth size="lg">
                  Reset Password
                </Button>
              </>
            ) : (
              <>
                <Input
                  label="Email"
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="lecturer@university.edu"
                  leftIcon={<Mail className="h-5 w-5" />}
                  disabled={loading}
                />
                <Button onClick={requestReset} isLoading={loading} fullWidth size="lg">
                  Send Reset Link
                </Button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-[#09090b] flex items-center justify-center">
        <Loader size="lg" color="primary" />
      </div>
    }>
      <ResetPasswordContent />
    </Suspense>
  );
}

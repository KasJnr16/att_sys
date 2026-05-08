'use client';

import { Suspense, useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { CheckCircle2, GraduationCap, KeyRound, Mail, RotateCcw } from 'lucide-react';
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

function VerifyEmailContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get('token');
  const initialEmail = searchParams.get('email') || '';
  const [email, setEmail] = useState(initialEmail);
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(Boolean(token));
  const [resending, setResending] = useState(false);
  const [error, setError] = useState('');
  const [status, setStatus] = useState(token ? 'Verifying your email...' : 'Check your inbox for the verification link or code.');

  const finishWithToken = useCallback(async (accessToken: string) => {
    await completeAuthSession(accessToken);
    toast.success('Email verified', 'Opening your dashboard...', 3000);
    router.push('/dashboard');
  }, [router]);

  useEffect(() => {
    const verifyLink = async () => {
      if (!token) {
        return;
      }

      setLoading(true);
      setError('');
      try {
        const response = await api.post('/auth/email-verification/verify-link', { token }, authRequestConfig);
        await finishWithToken(response.data.access_token);
      } catch (err: unknown) {
        setError(getErrorMessage(err, 'Verification link is invalid or expired.'));
        setStatus('Use the code from your email, or request a new verification email.');
      } finally {
        setLoading(false);
      }
    };

    void verifyLink();
  }, [token, finishWithToken]);

  const verifyCode = async () => {
    if (!email.trim()) {
      setError('Enter the email you used to create the account.');
      return;
    }
    if (!code.match(/^\d{6}$/)) {
      setError('Enter the 6-digit verification code.');
      return;
    }

    setLoading(true);
    setError('');
    try {
      const response = await api.post('/auth/email-verification/verify-code', {
        email: email.trim(),
        code,
      }, authRequestConfig);
      await finishWithToken(response.data.access_token);
    } catch (err: unknown) {
      setError(getErrorMessage(err, 'Verification code is invalid or expired.'));
    } finally {
      setLoading(false);
    }
  };

  const resendEmail = async () => {
    if (!email.trim()) {
      setError('Enter your email before requesting a new code.');
      return;
    }

    setResending(true);
    setError('');
    try {
      await api.post('/auth/email-verification/resend', { email: email.trim() }, authRequestConfig);
      setStatus('A new verification email has been sent.');
      toast.success('Verification sent', 'Check your inbox for the new link or code.', 5000);
    } catch (err: unknown) {
      setError(getErrorMessage(err, 'Could not send a new verification email.'));
    } finally {
      setResending(false);
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
          <div className="mb-6 flex items-start gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600">
              {loading ? <Loader size="sm" /> : token && !error ? <CheckCircle2 className="h-6 w-6" /> : <Mail className="h-6 w-6" />}
            </div>
            <div>
              <h1 className="text-2xl font-bold text-slate-900">Verify Your Email</h1>
              <p className="mt-1 text-sm text-slate-500">{status}</p>
            </div>
          </div>

          <div className="space-y-4">
            {error ? <Alert variant="error" onDismiss={() => setError('')}>{error}</Alert> : null}

            <Input
              label="Email"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="lecturer@university.edu"
              leftIcon={<Mail className="h-5 w-5" />}
              disabled={loading}
            />

            <Input
              label="Verification Code"
              value={code}
              onChange={(event) => setCode(event.target.value.replace(/\D/g, '').slice(0, 6))}
              placeholder="000000"
              leftIcon={<KeyRound className="h-5 w-5" />}
              disabled={loading}
              inputMode="numeric"
              maxLength={6}
            />

            <Button onClick={verifyCode} isLoading={loading} fullWidth size="lg">
              Verify and Continue
            </Button>

            <Button
              variant="secondary"
              onClick={resendEmail}
              isLoading={resending}
              fullWidth
              leftIcon={<RotateCcw className="h-4 w-4" />}
            >
              Send New Code
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function VerifyEmailPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-[#09090b] flex items-center justify-center">
        <Loader size="lg" color="primary" />
      </div>
    }>
      <VerifyEmailContent />
    </Suspense>
  );
}

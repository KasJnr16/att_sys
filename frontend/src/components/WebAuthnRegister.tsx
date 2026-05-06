'use client';

import { useState } from 'react';
import { startRegistration } from '@simplewebauthn/browser';
import api, { handleApiError } from '@/lib/api';
import { Fingerprint, CheckCircle2, XCircle } from 'lucide-react';
import { Button } from './ui/Button';
import { Badge } from './ui/Badge';

export default function WebAuthnRegister() {
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [message, setMessage] = useState('');

  const handleRegister = async () => {
    setLoading(true);
    setStatus('idle');
    setMessage('');
    try {
      const optionsResponse = await api.post('/auth/register/options');
      const options = optionsResponse.data;

      const registrationResponse = await startRegistration({
        optionsJSON: options,
      });

      await api.post('/auth/register/verify', {
        registration_response: registrationResponse,
        challenge: options.challenge,
      });

      setStatus('success');
      setMessage('Device successfully registered for biometric verification.');
    } catch (err) {
      console.error(err);
      setStatus('error');
      setMessage(handleApiError(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-4 p-4 rounded-xl bg-indigo-50/50 border border-indigo-100">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-indigo-100 text-indigo-600 shrink-0">
          <Fingerprint className="h-6 w-6" />
        </div>
        <div className="flex-1">
          <h4 className="font-semibold text-slate-900">Why register?</h4>
          <p className="text-sm text-slate-600 mt-0.5">
            Registration prevents identity spoofing and allows you to confirm your presence in seconds.
          </p>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Badge variant={status === 'success' ? 'success' : status === 'error' ? 'danger' : 'gray'} dot>
            {status === 'success' ? 'Verified' : status === 'error' ? 'Failed' : 'Ready'}
          </Badge>
          {status === 'idle' && (
            <span className="text-sm text-slate-500">Click to register your device</span>
          )}
        </div>
        <Button
          onClick={handleRegister}
          isLoading={loading}
          disabled={status === 'success'}
          leftIcon={<Fingerprint className="h-5 w-5" />}
        >
          {status === 'success' ? 'Device Registered' : 'Register Device'}
        </Button>
      </div>

      {status !== 'idle' && (
        <div className={`flex items-start gap-3 rounded-lg p-4 text-sm ${
          status === 'success' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-red-50 text-red-700 border border-red-200'
        }`}>
          {status === 'success' ? (
            <CheckCircle2 className="h-5 w-5 shrink-0 mt-0.5 text-emerald-600" />
          ) : (
            <XCircle className="h-5 w-5 shrink-0 mt-0.5 text-red-600" />
          )}
          <div>
            <p className="font-semibold">{status === 'success' ? 'Registration Complete' : 'Registration Failed'}</p>
            <p className="mt-0.5 opacity-80">{message}</p>
          </div>
        </div>
      )}
    </div>
  );
}

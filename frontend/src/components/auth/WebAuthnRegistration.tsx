'use client';

import { useState } from 'react';
import { startRegistration, startAuthentication } from '@simplewebauthn/browser';
import { Fingerprint, AlertCircle, Check } from 'lucide-react';
import { Button } from '@/components/ui/Button';

interface WebAuthnRegistrationProps {
  studentId: number;
  onSuccess: () => void;
  onError: (error: string) => void;
  mode: 'register' | 'authenticate';
  webauthnOptions: any;
}

export const WebAuthnRegistration: React.FC<WebAuthnRegistrationProps> = ({
  studentId,
  onSuccess,
  onError,
  mode,
  webauthnOptions,
}) => {
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleWebAuthn = async () => {
    setIsProcessing(true);
    setError(null);

    try {
      if (mode === 'register') {
        const credential = await startRegistration({ optionsJSON: webauthnOptions });
        onSuccess();
        return credential;
      } else {
        const credential = await startAuthentication({ optionsJSON: webauthnOptions });
        onSuccess();
        return credential;
      }
    } catch (err: any) {
      console.error('WebAuthn error:', err);
      if (err.name === 'InvalidStateError') {
        setError('This device is already registered. Please use a different device or contact support.');
      } else if (err.name === 'NotAllowedError') {
        setError('Authentication was cancelled or not allowed. Please try again.');
      } else {
        setError(err.message || 'An error occurred during authentication.');
      }
      onError(error || 'Authentication failed');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="text-center space-y-4">
      <div className="mx-auto w-20 h-20 rounded-full bg-indigo-50 flex items-center justify-center">
        <Fingerprint className="h-10 w-10 text-indigo-600" />
      </div>
      
      <div>
        <h3 className="text-lg font-semibold text-gray-900">
          {mode === 'register' ? 'Register Fingerprint' : 'Verify Identity'}
        </h3>
        <p className="text-sm text-gray-500 mt-1">
          {mode === 'register'
            ? 'Use your fingerprint or security key to register this device'
            : 'Use your fingerprint or security key to verify your identity'}
        </p>
      </div>

      {error && (
        <div className="flex items-center gap-2 p-3 bg-red-50 text-red-700 rounded-lg text-sm">
          <AlertCircle className="h-4 w-4 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <Button
        onClick={handleWebAuthn}
        isLoading={isProcessing}
        className="w-full"
        size="lg"
      >
        {isProcessing ? (
          'Processing...'
        ) : mode === 'register' ? (
          <>
            <Fingerprint className="h-5 w-5 mr-2" />
            Register Fingerprint
          </>
        ) : (
          <>
            <Fingerprint className="h-5 w-5 mr-2" />
            Scan Fingerprint
          </>
        )}
      </Button>
    </div>
  );
};

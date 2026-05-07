'use client';

import { Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { startAuthentication, startRegistration } from '@simplewebauthn/browser';
import { CheckCircle2, Fingerprint, User, XCircle, Clock, GraduationCap, AlertCircle, KeyRound } from 'lucide-react';
import api from '@/lib/api';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Loader } from '@/components/ui/Loader';
import { Modal } from '@/components/ui/Modal';
import Link from 'next/link';
import { getBrowserLocation } from '@/lib/geolocation';
import { clearAttendanceClientId, getOrCreateAttendanceClientId } from '@/lib/attendanceClient';

type Step = 'loading' | 'code' | 'identify' | 'register' | 'fingerprint' | 'confirm' | 'success' | 'error' | 'expired';

interface SessionInfo {
  session_id: number;
  class_session_id: number;
  course_name: string;
  course_code: string;
  session_date: string;
  expires_at: string;
}

interface StudentInfo {
  id?: number;
  student_index: string;
  full_name: string;
  programme_name: string;
  has_webauthn: boolean;
}

function VerifyContent() {
  const searchParams = useSearchParams();
  const urlToken = searchParams.get('token');

  const [step, setStep] = useState<Step>('loading');
  const [token, setToken] = useState<string | null>(null);
  const [sessionInfo, setSessionInfo] = useState<SessionInfo | null>(null);
  const [studentInfo, setStudentInfo] = useState<StudentInfo | null>(null);
  const [webauthnOptions, setWebauthnOptions] = useState<any>(null);
  const [challenge, setChallenge] = useState<string>('');
  const [authResponse, setAuthResponse] = useState<any>(null);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const [studentIndex, setStudentIndex] = useState('');
  const [fullName, setFullName] = useState('');
  const [confirmModalOpen, setConfirmModalOpen] = useState(false);
  const [verificationCode, setVerificationCode] = useState('');
  const [registrationMode, setRegistrationMode] = useState<'new' | 'existing' | null>(null);
  const [attendanceClientId, setAttendanceClientId] = useState<string | null>(null);

  const [processing, setProcessing] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    if (urlToken) {
      sessionStorage.setItem('attendance_verify_token', urlToken);
      setToken(urlToken);
      setAttendanceClientId(getOrCreateAttendanceClientId());
      window.history.replaceState({}, '', window.location.pathname);
      return;
    }

    setToken(sessionStorage.getItem('attendance_verify_token'));
    setAttendanceClientId(getOrCreateAttendanceClientId());
  }, [urlToken]);

  const attendanceRequestConfig = attendanceClientId
    ? { headers: { 'X-Attendance-Client': attendanceClientId } }
    : undefined;

  useEffect(() => {
    const init = async () => {
      if (!token) {
        setStep('error');
        setError('Missing session token. Please use the QR link provided by your lecturer.');
        return;
      }

      try {
        const response = await api.post('/validate-token', { token });
        const data = response.data;

        if (!data.valid) {
          sessionStorage.removeItem('attendance_verify_token');
          clearAttendanceClientId();
          setStep('expired');
          setMessage('This attendance session is no longer active.');
          return;
        }

        setSessionInfo({
          session_id: data.session_id,
          class_session_id: data.class_session_id,
          course_name: data.course_name,
          course_code: data.course_code,
          session_date: data.session_date,
          expires_at: data.expires_at,
        });

        if (data.requires_verification_code) {
          setStep('code');
        } else {
          setStep('identify');
        }
      } catch (err: any) {
        if (err.response?.status === 410) {
          sessionStorage.removeItem('attendance_verify_token');
          clearAttendanceClientId();
          setStep('expired');
          setMessage('This attendance session has expired.');
        } else {
          if (err.response?.status === 404) {
            sessionStorage.removeItem('attendance_verify_token');
            clearAttendanceClientId();
          }
          setStep('error');
          setError(err.response?.data?.detail || 'Unable to load session.');
        }
      }
    };

    if (token) {
      init();
    }
  }, [token]);

  const handleCodeVerify = async () => {
    if (!token) {
      setError('Missing session token. Please reopen the lecturer link.');
      return;
    }

    if (verificationCode.length !== 6 || !verificationCode.match(/^\d+$/)) {
      setError('Please enter the 6-digit code shown on the lecturer\'s screen.');
      return;
    }

    setProcessing(true);
    setError('');

    try {
      await api.post('/verify-code', {
        token: token,
        code: verificationCode
      }, attendanceRequestConfig);
      setStep('identify');
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Invalid code. Please try again.');
    } finally {
      setProcessing(false);
    }
  };

  const handleLookup = async () => {
    if (studentIndex.length !== 10 || !studentIndex.match(/^\d+$/)) {
      setError('Index must be exactly 10 digits.');
      return;
    }

    if (!token) {
      setError('Missing session token. Please reopen the lecturer link.');
      return;
    }

    setProcessing(true);
    setError('');

    try {
      const response = await api.get(
        `/student/lookup?index=${studentIndex}&token=${encodeURIComponent(token)}`,
        attendanceRequestConfig,
      );
      const data = response.data;

      if (data.exists) {
        if (data.has_webauthn) {
          const optionsResponse = await api.post('/get-student-webauthn-options', {
            student_index: studentIndex,
            token,
          }, attendanceRequestConfig);
          setStudentInfo({
            id: optionsResponse.data.student.id,
            student_index: optionsResponse.data.student.student_index,
            full_name: optionsResponse.data.student.full_name,
            programme_name: optionsResponse.data.student.programme_name || 'Unknown Programme',
            has_webauthn: true,
          });
          setWebauthnOptions(optionsResponse.data.webauthn_options);
          setChallenge(optionsResponse.data.webauthn_options.challenge);
          setRegistrationMode(null);
          setStep('fingerprint');
        } else {
          setStudentInfo(null);
          setRegistrationMode('existing');
          setStep('register');
        }
      } else {
        setStudentInfo(null);
        setRegistrationMode('new');
        setFullName('');
        setStep('register');
      }
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Lookup failed. Please try again.');
    } finally {
      setProcessing(false);
    }
  };

  const handleRegister = async () => {
    if (!sessionInfo?.class_session_id) {
      setError('Session information missing.');
      return;
    }

    if (registrationMode === 'new' && !fullName.trim()) {
      setError('Please enter your full name.');
      return;
    }

    setProcessing(true);
    setError('');

    try {
      const optionsResponse = await api.post('/student/start-registration', {
        student_index: studentIndex,
        full_name: registrationMode === 'new' ? fullName.trim() : undefined,
        class_session_id: sessionInfo.class_session_id,
        token,
      }, attendanceRequestConfig);
      
      setWebauthnOptions(optionsResponse.data.webauthn_options);
      setChallenge(optionsResponse.data.webauthn_options.challenge);

      const registrationResponse = await startRegistration({
        optionsJSON: optionsResponse.data.webauthn_options,
      });

      const registerResponse = await api.post('/student/register', {
        student_index: studentIndex,
        full_name: registrationMode === 'new' ? fullName.trim() : undefined,
        class_session_id: sessionInfo.class_session_id,
        token,
        webauthn_registration_response: registrationResponse,
      }, attendanceRequestConfig);

      const data = registerResponse.data;
      const authOptionsResponse = await api.post('/get-student-webauthn-options', {
        student_index: studentIndex,
        token,
      }, attendanceRequestConfig);
      setStudentInfo({
        id: data.student_id,
        student_index: authOptionsResponse.data.student.student_index,
        full_name: authOptionsResponse.data.student.full_name,
        programme_name: authOptionsResponse.data.student.programme_name || data.class_info?.programme_name || 'Unknown Programme',
        has_webauthn: true,
      });
      setWebauthnOptions(authOptionsResponse.data.webauthn_options);
      setChallenge(authOptionsResponse.data.webauthn_options.challenge);
      setAuthResponse(null);
      setStep('fingerprint');
    } catch (err: any) {
      if (err.name === 'NotAllowedError') {
        setError('Registration cancelled. Please try again or tap the button to retry.');
        setProcessing(false);
        return;
      } else if (err.name === 'InvalidStateError') {
        try {
          const authOptionsResponse = await api.post('/get-student-webauthn-options', {
            student_index: studentIndex,
            token,
          }, attendanceRequestConfig);
          setStudentInfo({
            id: authOptionsResponse.data.student.id,
            student_index: authOptionsResponse.data.student.student_index,
            full_name: authOptionsResponse.data.student.full_name,
            programme_name: authOptionsResponse.data.student.programme_name || 'Unknown Programme',
            has_webauthn: true,
          });
          setWebauthnOptions(authOptionsResponse.data.webauthn_options);
          setChallenge(authOptionsResponse.data.webauthn_options.challenge);
          setError('This device is already registered. Please use it to verify your identity.');
          setStep('fingerprint');
        } catch (optionsErr: any) {
          setError(optionsErr.response?.data?.detail || 'This device is already registered. Please continue with fingerprint verification.');
        }
      } else if (err.response?.status === 409) {
        setError('This student index is already registered.');
      } else {
        setError(err.response?.data?.detail || 'Registration failed. Please try again.');
      }
    } finally {
      setProcessing(false);
    }
  };

  const handleFingerprint = async () => {
    if (!webauthnOptions) return;

    setProcessing(true);
    setError('');

    try {
      const authenticationResponse = await startAuthentication({
        optionsJSON: webauthnOptions,
      });

      setAuthResponse(authenticationResponse);
      setConfirmModalOpen(true);
    } catch (err: any) {
      if (err.name === 'NotAllowedError') {
        setError('Authentication cancelled. Please try again.');
      } else if (err.name === 'InvalidStateError') {
        setError('This device is not registered. Please register first.');
        setStep('register');
      } else {
        setError('Fingerprint verification failed. Please try again.');
      }
    } finally {
      setProcessing(false);
    }
  };

  const handleConfirmAttendance = async () => {
    if (!sessionInfo || !studentInfo || !studentInfo.id || !authResponse || !token) return;

    setProcessing(true);
    setConfirmModalOpen(false);

    try {
      const location = await getBrowserLocation();
      await api.post('/verify-student', {
        student_id: studentInfo.id,
        authentication_response: authResponse,
        challenge: challenge,
        token: token,
        latitude: location.latitude,
        longitude: location.longitude,
      }, attendanceRequestConfig);

      sessionStorage.removeItem('attendance_verify_token');
      clearAttendanceClientId();
      setStep('success');
    } catch (err: any) {
      if (err.response?.status === 409) {
        setError('You have already been marked present for this session.');
        setStep('error');
      } else {
        setError(err.response?.data?.detail || err.message || 'Failed to record attendance.');
        setStep('error');
      }
    } finally {
      setProcessing(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 flex flex-col">
      <header className="p-4">
        <Link href="/" className="inline-flex items-center gap-2 text-slate-400 hover:text-white transition-colors">
          <GraduationCap className="h-5 w-5" />
          <span className="font-semibold">UniAtt</span>
        </Link>
      </header>

      <main className="flex-1 flex items-center justify-center p-4">
        <div className="w-full max-w-md">
          <div className="text-center mb-8">
            <h1 className="text-2xl font-bold text-white mb-2">Attendance Verification</h1>
            {sessionInfo && (
              <p className="text-slate-400 text-sm">
                {sessionInfo.course_code} &bull; {new Date(sessionInfo.session_date).toLocaleDateString()}
              </p>
            )}
          </div>

          {step === 'loading' && (
            <Card className="text-center">
              <div className="py-8">
                <Loader size="lg" color="primary" />
                <p className="mt-4 text-slate-500">Verifying session...</p>
              </div>
            </Card>
          )}

          {step === 'code' && (
            <Card padding="none" className="overflow-hidden">
              <div className="bg-gradient-to-br from-indigo-600 to-purple-600 p-6 text-white text-center">
                <div className="inline-flex h-16 w-16 items-center justify-center rounded-full bg-white/20 backdrop-blur-sm mb-4">
                  <KeyRound className="h-8 w-8" />
                </div>
                <h2 className="text-xl font-semibold mb-1">Enter Verification Code</h2>
                <p className="text-white/80 text-sm">Enter the 6-digit code shown on the lecturer&apos;s screen</p>
              </div>

              <div className="p-6 space-y-4">
                {error && (
                  <div className="flex items-center gap-2 p-3 bg-red-50 text-red-700 rounded-lg text-sm">
                    <AlertCircle className="h-4 w-4 flex-shrink-0" />
                    <span>{error}</span>
                  </div>
                )}

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Verification Code</label>
                  <input
                    type="text"
                    value={verificationCode}
                    onChange={(e) => setVerificationCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    placeholder="000000"
                    className="w-full px-4 py-3 border border-slate-200 rounded-lg text-center text-2xl tracking-widest font-mono focus:ring-2 focus:ring-indigo-500 focus:border-indigo-300 outline-none"
                    maxLength={6}
                    autoFocus
                  />
                  <p className="text-xs text-slate-500 mt-1 text-center">Ask your lecturer for the code displayed on their screen</p>
                </div>

                <Button
                  onClick={handleCodeVerify}
                  isLoading={processing}
                  fullWidth
                  size="lg"
                  disabled={verificationCode.length !== 6}
                >
                  Verify Code
                </Button>
              </div>
            </Card>
          )}

          {step === 'identify' && (
            <Card padding="none" className="overflow-hidden">
              <div className="bg-gradient-to-br from-indigo-600 to-purple-600 p-6 text-white text-center">
                <div className="inline-flex h-16 w-16 items-center justify-center rounded-full bg-white/20 backdrop-blur-sm mb-4">
                  <User className="h-8 w-8" />
                </div>
                <h2 className="text-xl font-semibold mb-1">Student Identification</h2>
                <p className="text-white/80 text-sm">Enter your 10-digit index number to continue</p>
              </div>

              <div className="p-6 space-y-4">
                {error && (
                  <div className="flex items-center gap-2 p-3 bg-red-50 text-red-700 rounded-lg text-sm">
                    <AlertCircle className="h-4 w-4 flex-shrink-0" />
                    <span>{error}</span>
                  </div>
                )}

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Index Number</label>
                  <input
                    type="text"
                    value={studentIndex}
                    onChange={(e) => setStudentIndex(e.target.value.replace(/\D/g, '').slice(0, 10))}
                    placeholder="0325080327"
                    className="w-full px-4 py-3 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-300 outline-none"
                    maxLength={10}
                  />
                  <p className="text-xs text-slate-500 mt-1">Enter your 10-digit student index</p>
                </div>

                <Button
                  onClick={handleLookup}
                  isLoading={processing}
                  fullWidth
                  size="lg"
                  disabled={studentIndex.length !== 10}
                >
                  Verify Index
                </Button>
              </div>
            </Card>
          )}

          {step === 'register' && (
            <Card padding="none" className="overflow-hidden">
              <div className="bg-gradient-to-br from-amber-500 to-orange-600 p-6 text-white text-center">
                <div className="inline-flex h-16 w-16 items-center justify-center rounded-full bg-white/20 backdrop-blur-sm mb-4">
                  <Fingerprint className="h-8 w-8" />
                </div>
                <h2 className="text-xl font-semibold mb-1">
                  {registrationMode === 'new' ? 'New Student' : 'Register Passkey'}
                </h2>
                <p className="text-white/80 text-sm">
                  {registrationMode === 'new'
                    ? 'We could not find your index. Add your name and register a passkey to continue.'
                    : 'We found your student record. Register a fingerprint or passkey to continue.'}
                </p>
              </div>

              <div className="p-6 space-y-4">
                {error && (
                  <div className="flex items-center gap-2 p-3 bg-red-50 text-red-700 rounded-lg text-sm">
                    <AlertCircle className="h-4 w-4 flex-shrink-0" />
                    <span>{error}</span>
                  </div>
                )}

                <div className="bg-slate-50 rounded-xl p-4 space-y-2">
                  <p className="text-sm text-slate-500">Attendance session:</p>
                  <p className="font-medium text-slate-900">{sessionInfo?.course_name}</p>
                  <p className="text-xs text-slate-500">{sessionInfo?.course_code} &bull; Index {studentIndex}</p>
                </div>

                {registrationMode === 'new' && (
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Full Name</label>
                    <input
                      type="text"
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      placeholder="John Doe"
                      className="w-full px-4 py-3 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-300 outline-none"
                    />
                    <p className="text-xs text-slate-500 mt-1">This name will be attached to your student profile.</p>
                  </div>
                )}

                <Button
                  onClick={handleRegister}
                  isLoading={processing}
                  fullWidth
                  size="lg"
                  disabled={registrationMode === 'new' && !fullName.trim()}
                >
                  <Fingerprint className={`h-5 w-5 mr-2 ${processing ? 'animate-pulse' : ''}`} />
                  {processing ? 'Waiting for passkey...' : registrationMode === 'new' ? 'Register Passkey' : 'Register This Device'}
                </Button>
                
                {processing && (
                  <p className="text-center text-sm text-slate-500 animate-pulse">
                    Please use your fingerprint, face, or passkey to register this device
                  </p>
                )}
              </div>
            </Card>
          )}

          {step === 'fingerprint' && (
            <Card padding="none" className="overflow-hidden">
              <div className="bg-gradient-to-br from-indigo-600 to-purple-600 p-6 text-white text-center">
                <div className="inline-flex h-16 w-16 items-center justify-center rounded-full bg-white/20 backdrop-blur-sm mb-4">
                  <Fingerprint className={`h-8 w-8 ${processing ? 'animate-pulse' : ''}`} />
                </div>
                <h2 className="text-xl font-semibold mb-1">Verify Identity</h2>
                <p className="text-white/80 text-sm">Scan your fingerprint to confirm attendance</p>
              </div>

              <div className="p-6 space-y-4">
                {error && (
                  <div className="flex items-center gap-2 p-3 bg-red-50 text-red-700 rounded-lg text-sm">
                    <AlertCircle className="h-4 w-4 flex-shrink-0" />
                    <span>{error}</span>
                  </div>
                )}

                <div className="bg-slate-50 rounded-xl p-4">
                  <p className="text-sm font-medium text-slate-900">Index {studentIndex}</p>
                  <p className="text-xs text-slate-500">Use your registered fingerprint, face, or passkey</p>
                </div>

                <Button
                  onClick={handleFingerprint}
                  isLoading={processing}
                  fullWidth
                  size="lg"
                >
                  <Fingerprint className={`h-5 w-5 mr-2 ${processing ? 'animate-pulse' : ''}`} />
                  {processing ? 'Waiting for fingerprint...' : 'Scan Fingerprint'}
                </Button>
                
                {processing && (
                  <p className="text-center text-sm text-slate-500 animate-pulse">
                    Please use your registered fingerprint, face, or passkey
                  </p>
                )}
              </div>
            </Card>
          )}

          {step === 'success' && (
            <Card className="text-center">
              <div className="py-8">
                <div className="inline-flex h-20 w-20 items-center justify-center rounded-full bg-emerald-100 mb-4">
                  <CheckCircle2 className="h-10 w-10 text-emerald-600" />
                </div>
                <h2 className="text-xl font-semibold text-slate-900 mb-2">Attendance Recorded!</h2>
                <p className="text-slate-500 mb-2">You have successfully marked your attendance.</p>
                <p className="text-sm text-slate-400">Course: {sessionInfo?.course_name}</p>
              </div>
            </Card>
          )}

          {step === 'expired' && (
            <Card>
              <div className="text-center py-6">
                <div className="inline-flex h-20 w-20 items-center justify-center rounded-full bg-amber-100 mb-4">
                  <Clock className="h-10 w-10 text-amber-600" />
                </div>
                <h2 className="text-xl font-semibold text-slate-900 mb-2">Session Expired</h2>
                <p className="text-slate-500 mb-6">{message}</p>
                <Link href="/">
                  <Button variant="secondary">Go Home</Button>
                </Link>
              </div>
            </Card>
          )}

          {step === 'error' && (
            <Card>
              <div className="text-center py-6">
                <div className="inline-flex h-20 w-20 items-center justify-center rounded-full bg-red-100 mb-4">
                  <XCircle className="h-10 w-10 text-red-600" />
                </div>
                <h2 className="text-xl font-semibold text-slate-900 mb-2">Error</h2>
                <p className="text-slate-500 mb-6">{error || message}</p>
                <div className="flex gap-3 justify-center">
                  <Link href="/">
                    <Button variant="secondary">Go Home</Button>
                  </Link>
                  <Button onClick={() => window.location.reload()}>
                    Try Again
                  </Button>
                </div>
              </div>
            </Card>
          )}
        </div>
      </main>

      <Modal isOpen={confirmModalOpen} onClose={() => setConfirmModalOpen(false)} title="Confirm Attendance">
        <div className="space-y-4">
          <div className="bg-slate-50 rounded-xl p-4 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm text-slate-500">Student</span>
              <span className="font-medium">{studentInfo?.full_name}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-slate-500">Index</span>
              <span className="font-mono text-sm">{studentInfo?.student_index}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-slate-500">Course</span>
              <span className="text-sm">{sessionInfo?.course_name}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-slate-500">Programme</span>
              <span className="text-sm">{studentInfo?.programme_name}</span>
            </div>
          </div>

          <div className="flex gap-3 pt-2">
            <Button variant="secondary" onClick={() => setConfirmModalOpen(false)} className="flex-1">
              Cancel
            </Button>
            <Button onClick={handleConfirmAttendance} isLoading={processing} className="flex-1">
              Confirm Attendance
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

export default function VerifyPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 flex items-center justify-center">
        <Loader size="lg" color="primary" />
      </div>
    }>
      <VerifyContent />
    </Suspense>
  );
}

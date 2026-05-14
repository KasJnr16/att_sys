'use client';

import { useState, useEffect, Suspense } from 'react';
import { useParams, useSearchParams, useRouter } from 'next/navigation';
import { QRCodeSVG } from 'qrcode.react';
import api from '@/lib/api';
import type { ApiRequestConfig } from '@/lib/api';
import { Users, Clock, ArrowLeft, CheckCircle, Copy, X, KeyRound } from 'lucide-react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Loader } from '@/components/ui/Loader';
import { Modal } from '@/components/ui/Modal';

interface AttendanceFeedRecord {
  id: number;
  student_id: number;
  class_session_id: number;
  verified_at: string;
  status: string;
  verification_method: string;
  distance_meters?: number | null;
  suspicious_reason?: string | null;
  student: {
    id: number;
    student_index: string;
    full_name: string;
  };
}

function SessionDisplayContent() {
  const { id } = useParams();
  const searchParams = useSearchParams();
  const urlToken = searchParams.get('token');
  const router = useRouter();

  const [attendance, setAttendance] = useState<AttendanceFeedRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [classSessionId, setClassSessionId] = useState<number | null>(null);
  const [sessionInfo, setSessionInfo] = useState<any>(null);
  const [timeRemaining, setTimeRemaining] = useState<string>('');
  const [isExpired, setIsExpired] = useState(false);
  const [showEndModal, setShowEndModal] = useState(false);
  const [endingSession, setEndingSession] = useState(false);
  const [token, setToken] = useState<string | null>(null);

  // Handle token storage in sessionStorage
  useEffect(() => {
    if (urlToken) {
      // Token in URL - store it and use it
      sessionStorage.setItem(`session_token_${id}`, urlToken);
      setToken(urlToken);
      window.history.replaceState({}, '', window.location.pathname);
    } else {
      // No token in URL - try to get from sessionStorage
      const storedToken = sessionStorage.getItem(`session_token_${id}`);
      setToken(storedToken);
    }
  }, [urlToken, id]);

  // Clear token from sessionStorage when session expires
  useEffect(() => {
    if (isExpired && token) {
      sessionStorage.removeItem(`session_token_${id}`);
    }
  }, [isExpired, token, id]);

  const joinUrl = token && typeof window !== 'undefined'
    ? `${window.location.origin}/verify?sessionId=${id}&token=${token}`
    : '';

  const clearStoredToken = () => {
    sessionStorage.removeItem(`session_token_${id}`);
    setToken(null);
  };

  useEffect(() => {
    fetchSessionDetails();
  }, [id]);

  useEffect(() => {
    if (!classSessionId || isExpired) {
      return;
    }

    fetchAttendance(classSessionId);
    const interval = setInterval(() => fetchAttendance(classSessionId), 5000);
    return () => clearInterval(interval);
  }, [classSessionId, isExpired]);

  useEffect(() => {
    if (sessionInfo?.expires_at) {
      const updateTimer = () => {
        const expiresAt = new Date(sessionInfo.expires_at).getTime();
        const now = Date.now();
        const diff = expiresAt - now;

        if (diff <= 0) {
          setTimeRemaining('Expired');
          setIsExpired(true);
          return;
        }

        const minutes = Math.floor(diff / 60000);
        const seconds = Math.floor((diff % 60000) / 1000);
        setTimeRemaining(`${minutes}:${seconds.toString().padStart(2, '0')}`);
        setIsExpired(false);
      };

      updateTimer();
      const timerInterval = setInterval(updateTimer, 1000);
      return () => clearInterval(timerInterval);
    }
  }, [sessionInfo?.expires_at]);

  const fetchSessionDetails = async () => {
    try {
      const response = await api.get(`/attendance-sessions/${id}/status`);
      setSessionInfo(response.data);
      setClassSessionId(response.data.class_session_id);
    } catch (err) {
      console.error('Failed to fetch session', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchAttendance = async (sessionId?: number) => {
    const sid = sessionId || classSessionId;
    if (!sid) return;
    try {
      const response = await api.get(`/lecturer/sessions/${sid}/attendance`);
      setAttendance(response.data);
    } catch (err) {
      console.error('Failed to fetch attendance', err);
    }
  };

  const copyLink = () => {
    const formattedText = `UniAtt\nLink: ${joinUrl}\nPasskey: ${sessionInfo.verification_code}`;
    navigator.clipboard.writeText(formattedText);
  };

  const handleEndSession = async () => {
    setEndingSession(true);
    try {
      const response = await api.post(`/attendance-sessions/${id}/close`, undefined, { toast: false } as ApiRequestConfig);
      clearStoredToken();
      setShowEndModal(false);
      const classId = response.data?.class_id ?? sessionInfo?.class_id;
      if (classId) {
        router.push(`/dashboard/lecturer/classes/${classId}`);
      } else {
        router.push('/dashboard/lecturer/classes');
      }
    } catch (err) {
      console.error('Failed to end session', err);
    } finally {
      setEndingSession(false);
    }
  };

  if (loading) {
    return (
      <div className="flex h-[60vh] items-center justify-center">
        <Loader size="xl" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button
            onClick={() => router.back()}
            className="h-10 w-10 rounded-full border border-gray-200 flex items-center justify-center hover:bg-gray-100 transition-colors"
          >
            <ArrowLeft className="h-5 w-5 text-gray-600" />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Active Attendance Session</h1>
            <p className="text-sm text-gray-500 font-medium">
              Session ID: #{id} &bull; {isExpired ? 'Expired' : 'Live'}
            </p>
          </div>
        </div>
        <div className="flex gap-3">
          <Button variant="outline" leftIcon={<Copy className="h-4 w-4" />} onClick={copyLink}>
            Copy Link
          </Button>
          <Button variant="danger" onClick={() => setShowEndModal(true)}>
            End Session
          </Button>
        </div>
      </div>

      {sessionInfo?.verification_code && !isExpired && (
        <div className="bg-gradient-to-r from-indigo-600 via-purple-600 to-indigo-600 rounded-2xl p-6 text-white shadow-xl">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="h-14 w-14 rounded-xl bg-white/20 backdrop-blur-sm flex items-center justify-center">
                <KeyRound className="h-7 w-7" />
              </div>
              <div>
                <p className="text-white/80 text-sm font-medium uppercase tracking-wider">Session Passkey</p>
                <p className="text-4xl font-bold font-mono tracking-widest">{sessionInfo.verification_code}</p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-white/80 text-sm">Share this passkey with students</p>
              <p className="text-white/60 text-xs">Students must enter it to mark attendance</p>
            </div>
          </div>
        </div>
      )}

      <div className="grid gap-8 lg:grid-cols-5">
        <Card className="lg:col-span-2 overflow-hidden border-none shadow-xl bg-white flex flex-col items-center justify-center p-8">
          <div className="text-center mb-6">
            <h2 className="text-xl font-bold text-gray-900">Scan QR Code</h2>
            <p className="text-sm text-gray-500 mt-1">Students can scan this to verify presence</p>
          </div>
          
          <div className="relative group">
            <div className="absolute -inset-4 bg-indigo-50 rounded-2xl scale-95 opacity-0 group-hover:scale-100 group-hover:opacity-100 transition-all duration-300" />
            <div className="relative bg-white p-4 rounded-xl shadow-lg ring-1 ring-gray-100 flex items-center justify-center">
              {token ? (
                isExpired ? (
                  <div className="h-[280px] w-[280px] flex flex-col items-center justify-center text-red-500 bg-red-50 rounded-lg">
                    <X className="h-16 w-16 mb-2" />
                    <p className="font-bold uppercase tracking-widest">Expired</p>
                  </div>
                ) : (
                  <QRCodeSVG value={joinUrl} size={280} level="H" includeMargin />
                )
              ) : (
                <div className="h-[280px] w-[280px] flex items-center justify-center text-red-500 font-bold uppercase tracking-widest bg-red-50 rounded-lg">
                  Token Missing
                </div>
              )}
            </div>
          </div>

          {!isExpired && timeRemaining && (
            <div className="mt-6 text-center">
              <p className="text-sm text-gray-500">Time Remaining</p>
              <p className="text-3xl font-bold text-indigo-600 font-mono">{timeRemaining}</p>
            </div>
          )}

          <div className="mt-6 w-full space-y-4">
            <div className="flex items-center gap-2 p-3 bg-gray-50 rounded-lg border border-gray-100 max-w-full">
              <code className="flex-1 text-xs font-mono text-gray-600 break-all">{joinUrl}</code>
              <button onClick={copyLink} className="p-1.5 hover:bg-white rounded transition-colors shadow-sm flex-shrink-0">
                <Copy className="h-3.5 w-3.5 text-gray-400" />
              </button>
            </div>
            {sessionInfo?.verification_code && (
              <div className="rounded-lg border border-gray-100 bg-gray-50 p-3 text-sm text-gray-700">
                <p className="font-semibold text-gray-900">UniAtt</p>
                <p className="mt-1 break-all"><span className="font-medium">Link:</span> {joinUrl}</p>
                <p><span className="font-medium">Passkey:</span> <span className="font-mono">{sessionInfo.verification_code}</span></p>
              </div>
            )}
          </div>
        </Card>

        <div className="lg:col-span-3 flex min-h-0 flex-col gap-6">
          <div className="grid grid-cols-2 gap-4">
            <Card className="border-none shadow-md">
              <div className="flex items-center gap-3 text-gray-500">
                <div className="h-10 w-10 rounded-xl bg-green-50 flex items-center justify-center text-green-600">
                  <Users className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Present</p>
                  <p className="text-2xl font-bold text-gray-900">{attendance.length}</p>
                </div>
              </div>
            </Card>
            <Card className="border-none shadow-md">
              <div className="flex items-center gap-3 text-gray-500">
                <div className="h-10 w-10 rounded-xl bg-amber-50 flex items-center justify-center text-amber-600">
                  <Clock className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Remaining</p>
                  <p className="text-2xl font-bold text-gray-900 font-mono">{timeRemaining || '--:--'}</p>
                </div>
              </div>
            </Card>
          </div>

          <Card className="h-[32rem] min-h-0 p-0 overflow-hidden border-none shadow-xl flex flex-col">
            <div className="px-6 py-4 border-b border-gray-100 bg-white flex items-center justify-between">
              <h3 className="font-bold text-gray-900 flex items-center gap-2">
                Live Attendance Feed
                {!isExpired && <span className="flex h-2 w-2 rounded-full bg-red-500 animate-pulse" />}
              </h3>
              <Badge variant="info">{attendance.length} Total</Badge>
            </div>
            
            <div className="h-[420px] overflow-y-auto divide-y divide-gray-50">
              {attendance.map((record, index) => (
                <div key={record.id} className="px-6 py-4 hover:bg-gray-50/50 transition-colors flex items-center justify-between animate-in slide-in-from-right-4 duration-300">
                  <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-full bg-indigo-50 flex items-center justify-center text-indigo-600 font-bold text-sm">
                      {index + 1}
                      </div>
                      <div className="min-w-0">
                      <div className="flex items-center gap-2 overflow-hidden whitespace-nowrap">
                        <p className="truncate text-sm font-bold text-gray-900">{record.student.full_name}</p>
                        <span className="text-gray-300">&bull;</span>
                        <p className="font-mono text-xs font-medium text-gray-500">{record.student.student_index}</p>
                      </div>
                      <p className="text-xs text-gray-400 mt-0.5 flex flex-wrap items-center gap-1">
                        <CheckCircle className="h-3 w-3 text-green-500" />
                        Verified by session passkey at {new Date(record.verified_at).toLocaleTimeString()}
                        {typeof record.distance_meters === 'number' && (
                          <span>&bull; {record.distance_meters}m from point</span>
                        )}
                      </p>
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <Badge variant="success">Present</Badge>
                    {record.suspicious_reason && (
                      <Badge variant="warning">{record.suspicious_reason}</Badge>
                    )}
                  </div>
                </div>
              ))}
              {attendance.length === 0 && (
                <div className="py-20 text-center flex flex-col items-center justify-center">
                  <div className="h-16 w-16 bg-gray-50 rounded-full flex items-center justify-center mb-4">
                    <Loader size="md" className="opacity-20" />
                  </div>
                  <p className="text-gray-400 font-medium">Waiting for first scan...</p>
                  <p className="text-xs text-gray-300 mt-1 uppercase tracking-widest">Real-time updates enabled</p>
                </div>
              )}
            </div>
          </Card>
        </div>
      </div>

      <Modal isOpen={showEndModal} onClose={() => setShowEndModal(false)} title="End Session">
        <div className="space-y-6">
          <p className="text-gray-600">
            Are you sure you want to end this attendance session? Students will no longer be able to mark their attendance.
          </p>

          <div className="flex gap-3">
            <Button
              variant="secondary"
              onClick={() => setShowEndModal(false)}
              className="flex-1"
            >
              Cancel
            </Button>
            <Button
              variant="danger"
              onClick={handleEndSession}
              isLoading={endingSession}
              className="flex-1"
            >
              End Session
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

export default function SessionDisplayPage() {
  return (
    <DashboardLayout>
      <Suspense fallback={<Loader size="xl" />}>
        <SessionDisplayContent />
      </Suspense>
    </DashboardLayout>
  );
}

'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import api from '@/lib/api';
import { ArrowLeft, Calendar, Clock, Users, CheckCircle } from 'lucide-react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card } from '@/components/ui/Card';
import { Loader } from '@/components/ui/Loader';

interface AttendanceRecord {
  student: {
    full_name: string;
    student_index: string;
  };
  verified_at: string;
}

interface SessionDetails {
  id: number;
  session_date: string;
  status: string;
  attendance_session_id: number | null;
  class_id: number;
  attendance_records: AttendanceRecord[];
}

export default function SessionDetailPage() {
  const { sessionId } = useParams();
  const router = useRouter();
  const [session, setSession] = useState<SessionDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (sessionId) {
      fetchSessionDetails();
    }
  }, [sessionId]);

  const fetchSessionDetails = async () => {
    try {
      const response = await api.get(`/lecturer/sessions/${sessionId}/details`);
      setSession(response.data);
    } catch (err: any) {
      console.error('Failed to fetch session details', err);
      setError(err.response?.data?.detail || 'Failed to load session');
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex h-[60vh] items-center justify-center">
          <Loader size="xl" />
        </div>
      </DashboardLayout>
    );
  }

  if (error || !session) {
    return (
      <DashboardLayout>
        <div className="text-center py-12">
          <h2 className="text-xl font-semibold text-slate-900">Session not found</h2>
          <button
            onClick={() => router.back()}
            className="text-indigo-600 hover:text-indigo-700 mt-2 inline-block"
          >
            Go Back
          </button>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-8">
        <div className="flex items-center gap-4">
          <button
            onClick={() => router.back()}
            className="h-10 w-10 rounded-full border border-gray-200 flex items-center justify-center hover:bg-gray-100 transition-colors"
          >
            <ArrowLeft className="h-5 w-5 text-gray-600" />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              {formatDate(session.session_date)}
            </h1>
            <p className="text-gray-500 mt-1">
              Session #{session.id}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
          <Card>
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-indigo-50 flex items-center justify-center text-indigo-600">
                <Calendar className="h-5 w-5" />
              </div>
              <div>
                <p className="text-sm text-gray-500">Date</p>
                <p className="text-lg font-bold text-gray-900">
                  {new Date(session.session_date).toLocaleDateString()}
                </p>
              </div>
            </div>
          </Card>
          <Card>
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-purple-50 flex items-center justify-center text-purple-600">
                <Users className="h-5 w-5" />
              </div>
              <div>
                <p className="text-sm text-gray-500">Attendance</p>
                <p className="text-lg font-bold text-gray-900">
                  {session.attendance_records.length} students
                </p>
              </div>
            </div>
          </Card>
        </div>

        <Card padding="none">
          <div className="px-6 py-4 border-b border-gray-100">
            <h2 className="font-semibold text-gray-900">Attendance List</h2>
          </div>
          <div className="divide-y divide-gray-50">
            {session.attendance_records.length > 0 ? (
              session.attendance_records.map((record, index) => (
                <div
                  key={index}
                  className="px-6 py-4 flex items-center justify-between"
                >
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-full bg-indigo-50 flex items-center justify-center text-indigo-600 font-bold text-xs">
                      {index + 1}
                    </div>
                    <div>
                      <p className="font-medium text-gray-900">
                        {record.student.full_name}
                      </p>
                      <p className="text-sm text-gray-500">
                        {record.student.student_index}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 text-green-600">
                    <CheckCircle className="h-4 w-4" />
                    <span className="text-sm font-medium">Present</span>
                  </div>
                </div>
              ))
            ) : (
              <div className="px-6 py-12 text-center">
                <Users className="h-10 w-10 text-gray-300 mx-auto" />
                <p className="mt-4 text-gray-500">No attendance records</p>
              </div>
            )}
          </div>
        </Card>
      </div>
    </DashboardLayout>
  );
}

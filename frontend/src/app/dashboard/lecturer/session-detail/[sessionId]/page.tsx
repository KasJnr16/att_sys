'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import api from '@/lib/api';
import type { ApiRequestConfig } from '@/lib/api';
import { ArrowLeft, Calendar, Users, CheckCircle, PlusCircle } from 'lucide-react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card } from '@/components/ui/Card';
import { Loader } from '@/components/ui/Loader';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { toast } from '@/lib/toast';

interface AttendanceRecord {
  student: {
    full_name: string;
    student_index: string;
  };
  verified_at: string;
  verification_method: string;
}

interface SessionDetails {
  id: number;
  session_date: string;
  status: string;
  attendance_session_id: number | null;
  class_id: number;
  can_edit: boolean;
  attendance_records: AttendanceRecord[];
}

export default function SessionDetailPage() {
  const { sessionId } = useParams();
  const router = useRouter();
  const [session, setSession] = useState<SessionDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showManualModal, setShowManualModal] = useState(false);
  const [studentIndex, setStudentIndex] = useState('');
  const [fullName, setFullName] = useState('');
  const [submittingManual, setSubmittingManual] = useState(false);

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

  const resetManualForm = () => {
    setStudentIndex('');
    setFullName('');
  };

  const submitManualAttendance = async () => {
    if (!session) {
      return;
    }

    if (!studentIndex.match(/^\d{10}$/)) {
      toast.error('Invalid index', 'Student index must be exactly 10 digits');
      return;
    }

    setSubmittingManual(true);
    try {
      const response = await api.post(`/lecturer/sessions/${session.id}/manual-attendance`, {
        student_index: studentIndex,
        full_name: fullName.trim() || undefined,
      }, {
        toast: false,
      } as ApiRequestConfig);
      const createdStudent = response.data?.created_student;
      toast.success(
        'Attendance added',
        createdStudent ? 'Student was created and marked present manually' : 'Student was marked present manually',
      );
      setShowManualModal(false);
      resetManualForm();
      await fetchSessionDetails();
    } catch (err: any) {
      toast.error('Could not add attendance', err.response?.data?.detail || 'Please try again.');
    } finally {
      setSubmittingManual(false);
    }
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
          <div className="ml-auto">
            {session.status === 'closed' && session.can_edit ? (
              <Button onClick={() => setShowManualModal(true)} leftIcon={<PlusCircle className="h-4 w-4" />}>
                Add Fallback Attendance
              </Button>
            ) : null}
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
                    <span className="text-sm font-medium">
                      {record.verification_method === 'manual' ? 'Present - Manual' : 'Present'}
                    </span>
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

      <Modal
        isOpen={showManualModal}
        onClose={() => {
          setShowManualModal(false);
          resetManualForm();
        }}
        title="Add Fallback Attendance"
      >
        <div className="space-y-4">
          <p className="text-sm text-gray-600">
            Use this only for students who could not complete attendance because of issues outside their control.
            If the student does not exist yet, the system will create their student record before marking them present.
          </p>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Student Index</label>
            <input
              type="text"
              value={studentIndex}
              onChange={(event) => setStudentIndex(event.target.value.replace(/\D/g, '').slice(0, 10))}
              placeholder="0321080178"
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none transition-all focus:border-indigo-300 focus:ring-2 focus:ring-indigo-500/20"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Full Name</label>
            <input
              type="text"
              value={fullName}
              onChange={(event) => setFullName(event.target.value)}
              placeholder="Required only if this student is new"
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none transition-all focus:border-indigo-300 focus:ring-2 focus:ring-indigo-500/20"
            />
          </div>

          <div className="flex gap-3 pt-2">
            <Button
              variant="secondary"
              onClick={() => {
                setShowManualModal(false);
                resetManualForm();
              }}
              className="flex-1"
            >
              Cancel
            </Button>
            <Button
              onClick={submitManualAttendance}
              isLoading={submittingManual}
              className="flex-1"
            >
              Save Attendance
            </Button>
          </div>
        </div>
      </Modal>
    </DashboardLayout>
  );
}

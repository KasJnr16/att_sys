'use client';

import { useState, useEffect, use } from 'react';
import { useRouter } from 'next/navigation';
import api from '@/lib/api';
import { useAuth } from '@/hooks/useAuth';
import { ArrowLeft, Play, Users, Calendar, BookOpen, Clock, Trash2, Eye, Share2 } from 'lucide-react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Loader } from '@/components/ui/Loader';
import { Modal } from '@/components/ui/Modal';
import { SearchableSelect } from '@/components/ui/SearchableSelect';
import { ApiRequestConfig } from '@/lib/api';
import { toast } from '@/lib/toast';
import {
  ATTENDANCE_EXPIRATION_KEY,
  ATTENDANCE_RADIUS_KEY,
  DEFAULT_ATTENDANCE_RADIUS,
  getStoredAttendanceExpiration,
  getStoredAttendanceRadius,
} from '@/lib/attendancePreferences';
import { getBrowserLocation } from '@/lib/geolocation';

interface ClassSession {
  id: number;
  session_date: string;
  status: 'scheduled' | 'open' | 'closed';
  attendance_session_id?: number;
  attendance_count?: number;
}

interface ClassDetail {
  id: number;
  course: { course_code: string; course_name: string };
  section: string;
  semester: number;
  academic_year: string;
  student_count?: number;
  can_edit?: boolean;
  is_owner?: boolean;
  share_permission?: string;
  sessions: ClassSession[];
}

interface LecturerOption {
  id: number;
  full_name: string;
  email?: string | null;
}

interface ClassShareItem {
  id: number;
  permission: 'view' | 'edit';
  lecturer: LecturerOption | null;
}

const EXPIRATION_OPTIONS = [
  { value: '5', label: '5 minutes' },
  { value: '10', label: '10 minutes' },
  { value: '15', label: '15 minutes' },
  { value: '20', label: '20 minutes' },
  { value: '30', label: '30 minutes' },
  { value: '60', label: '60 minutes' },
];

export default function ClassDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const [classDetail, setClassDetail] = useState<ClassDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [sessionToDelete, setSessionToDelete] = useState<number | null>(null);
  const [expirationMinutes, setExpirationMinutes] = useState('15');
  const [radiusMeters, setRadiusMeters] = useState(DEFAULT_ATTENDANCE_RADIUS);
  const [startingSession, setStartingSession] = useState(false);
  const [deletingSession, setDeletingSession] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);
  const [lecturerOptions, setLecturerOptions] = useState<LecturerOption[]>([]);
  const [classShares, setClassShares] = useState<ClassShareItem[]>([]);
  const [selectedLecturerId, setSelectedLecturerId] = useState<string | number>('');
  const [sharePermission, setSharePermission] = useState<'view' | 'edit'>('view');
  const [loadingShares, setLoadingShares] = useState(false);
  const [savingShare, setSavingShare] = useState(false);
  const [updatingShareId, setUpdatingShareId] = useState<number | null>(null);
  const [removingShareId, setRemovingShareId] = useState<number | null>(null);

  useEffect(() => {
    if (user && (user.role?.name === 'lecturer' || user.role?.name === 'admin')) {
      fetchClassDetail();
      const pollInterval = setInterval(fetchClassDetail, 30000);
      return () => clearInterval(pollInterval);
    }
  }, [user, id]);

  const fetchClassDetail = async () => {
    try {
      const [classRes, sessionsRes] = await Promise.all([
        api.get('/lecturer/classes'),
        api.get(`/lecturer/classes/${id}/sessions`),
      ]);
      
      const classData = classRes.data.find((c: any) => c.id === parseInt(id));
      if (classData) {
        setClassDetail({
          ...classData,
          sessions: sessionsRes.data,
        });
      }
    } catch (err) {
      console.error('Failed to fetch class detail', err);
    } finally {
      setLoading(false);
    }
  };

  const openSettingsModal = () => {
    setExpirationMinutes(getStoredAttendanceExpiration());
    setRadiusMeters(getStoredAttendanceRadius());
    setShowSettingsModal(true);
  };

  const startAttendance = async () => {
    setStartingSession(true);
    try {
      const location = await getBrowserLocation();
      const now = new Date();
      const sessionRes = await api.post(`/academic/classes/${id}/sessions`, {
        class_id: parseInt(id),
        session_date: now.toISOString().split('T')[0],
      }, { toast: false } as ApiRequestConfig);

      localStorage.setItem(ATTENDANCE_EXPIRATION_KEY, expirationMinutes);
      localStorage.setItem(ATTENDANCE_RADIUS_KEY, radiusMeters);

      const classSessionId = sessionRes.data.id;

      const response = await api.post('/attendance-sessions', {
        class_session_id: classSessionId,
        expires_in_minutes: parseInt(expirationMinutes),
        max_uses: 100,
        latitude: location.latitude,
        longitude: location.longitude,
        radius_meters: parseInt(radiusMeters, 10),
      }, { toast: false } as ApiRequestConfig);
      
      setShowSettingsModal(false);
      router.push(`/dashboard/lecturer/session/${response.data.session_id}?token=${response.data.token}`);
    } catch (err) {
      console.error('Failed to start attendance', err);
      const message = err instanceof Error ? err.message : 'Unable to start attendance.';
      toast.error('Could not start session', message);
    } finally {
      setStartingSession(false);
    }
  };

  const confirmDeleteSession = (sessionId: number) => {
    setSessionToDelete(sessionId);
    setShowDeleteModal(true);
  };

  const deleteSession = async () => {
    if (!sessionToDelete) return;
    setDeletingSession(true);
    try {
      await api.delete(`/lecturer/classes/${id}/sessions/${sessionToDelete}`);
      setShowDeleteModal(false);
      setSessionToDelete(null);
      fetchClassDetail();
    } catch (err) {
      console.error('Failed to delete session', err);
    } finally {
      setDeletingSession(false);
    }
  };

  const openShareModal = async () => {
    setShowShareModal(true);
    setLoadingShares(true);
    try {
      const [lecturersRes, sharesRes] = await Promise.all([
        api.get('/lecturer/lecturers/search'),
        api.get(`/lecturer/classes/${id}/shares`),
      ]);
      setLecturerOptions(lecturersRes.data);
      setClassShares(sharesRes.data);
    } catch (err) {
      console.error('Failed to load share data', err);
      toast.error('Could not load sharing', 'Please try again.');
    } finally {
      setLoadingShares(false);
    }
  };

  const createShare = async () => {
    if (!selectedLecturerId) {
      toast.error('Select lecturer', 'Choose a lecturer to share this class with.');
      return;
    }

    setSavingShare(true);
    try {
      await api.post(`/lecturer/classes/${id}/shares`, {
        lecturer_id: Number(selectedLecturerId),
        permission: sharePermission,
      });
      const sharesRes = await api.get(`/lecturer/classes/${id}/shares`);
      setClassShares(sharesRes.data);
      setSelectedLecturerId('');
      setSharePermission('view');
    } catch (err: any) {
      toast.error('Could not share class', err.response?.data?.detail || 'Please try again.');
    } finally {
      setSavingShare(false);
    }
  };

  const updateSharePermission = async (share: ClassShareItem, permission: 'view' | 'edit') => {
    if (!share.lecturer || share.permission === permission) {
      return;
    }

    setUpdatingShareId(share.id);
    try {
      await api.put(`/lecturer/classes/${id}/shares/${share.id}`, {
        lecturer_id: share.lecturer.id,
        permission,
      });
      setClassShares((current) =>
        current.map((item) => (item.id === share.id ? { ...item, permission } : item))
      );
    } catch (err: any) {
      toast.error('Could not update access', err.response?.data?.detail || 'Please try again.');
    } finally {
      setUpdatingShareId(null);
    }
  };

  const removeShare = async (shareId: number) => {
    setRemovingShareId(shareId);
    try {
      await api.delete(`/lecturer/classes/${id}/shares/${shareId}`);
      setClassShares((current) => current.filter((item) => item.id !== shareId));
    } catch (err: any) {
      toast.error('Could not remove access', err.response?.data?.detail || 'Please try again.');
    } finally {
      setRemovingShareId(null);
    }
  };

  if (authLoading || loading) {
    return (
      <DashboardLayout>
        <div className="flex h-[60vh] items-center justify-center">
          <Loader size="xl" />
        </div>
      </DashboardLayout>
    );
  }

  if (!classDetail) {
    return (
      <DashboardLayout>
        <div className="text-center py-12">
          <h2 className="text-xl font-semibold text-slate-900">Class not found</h2>
          <button onClick={() => router.back()} className="text-indigo-600 hover:text-indigo-700 mt-2 inline-block">
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
          <div className="flex-1">
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold text-gray-900">{classDetail.course.course_name}</h1>
              <Badge variant="info">{classDetail.course.course_code}</Badge>
              {!classDetail.is_owner && classDetail.share_permission ? (
                <Badge variant={classDetail.share_permission === 'edit' ? 'success' : 'gray'}>
                  Shared {classDetail.share_permission}
                </Badge>
              ) : null}
            </div>
            <p className="text-gray-500 mt-1">
              Semester {classDetail.semester} &bull; Section {classDetail.section || 'A'} &bull; {classDetail.academic_year}
            </p>
          </div>
          <div className="flex items-center gap-3">
            {classDetail.is_owner ? (
              <Button variant="secondary" onClick={openShareModal} leftIcon={<Share2 className="h-4 w-4" />}>
                Share Class
              </Button>
            ) : null}
            {classDetail.can_edit ? (
              <Button
                onClick={openSettingsModal}
                leftIcon={<Play className="h-4 w-4 fill-current" />}
              >
                Take Attendance
              </Button>
            ) : null}
          </div>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <Card>
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-indigo-50 flex items-center justify-center text-indigo-600">
                <BookOpen className="h-5 w-5" />
              </div>
              <div>
                <p className="text-sm text-gray-500">Course Code</p>
                <p className="text-lg font-bold text-gray-900">{classDetail.course.course_code}</p>
              </div>
            </div>
          </Card>
          <Card>
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-emerald-50 flex items-center justify-center text-emerald-600">
                <Users className="h-5 w-5" />
              </div>
              <div>
                <p className="text-sm text-gray-500">Students</p>
                <p className="text-lg font-bold text-gray-900">{classDetail.student_count || 0}</p>
              </div>
            </div>
          </Card>
          <Card>
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-purple-50 flex items-center justify-center text-purple-600">
                <Calendar className="h-5 w-5" />
              </div>
              <div>
                <p className="text-sm text-gray-500">Total Sessions</p>
                <p className="text-lg font-bold text-gray-900">{classDetail.sessions.length}</p>
              </div>
            </div>
          </Card>
          <Card>
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-amber-50 flex items-center justify-center text-amber-600">
                <Clock className="h-5 w-5" />
              </div>
              <div>
                <p className="text-sm text-gray-500">This Semester</p>
                <p className="text-lg font-bold text-gray-900">{classDetail.academic_year}</p>
              </div>
            </div>
          </Card>
        </div>

        <div className="grid lg:grid-cols-2 gap-8">
          <Card padding="none">
            <div className="px-6 py-4 border-b border-gray-100">
              <h2 className="font-semibold text-gray-900">Sessions</h2>
            </div>
            <div className="divide-y divide-gray-50 max-h-[400px] overflow-y-auto">
              {classDetail.sessions.length > 0 ? (
                classDetail.sessions.slice(0, 10).map((session) => {
                  const status = session.status;
                  return (
                    <div key={session.id} className="px-6 py-4 flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className={`h-10 w-10 rounded-lg flex items-center justify-center ${
                          status === 'closed' ? 'bg-gray-100 text-gray-500' :
                          status === 'open' ? 'bg-green-50 text-green-600' :
                          'bg-indigo-50 text-indigo-600'
                        }`}>
                          <Calendar className="h-5 w-5" />
                        </div>
                        <div>
                          <p className="font-medium text-gray-900">
                            {new Date(session.session_date).toLocaleDateString(undefined, {
                              weekday: 'short',
                              month: 'short',
                              day: 'numeric',
                            })}
                          </p>
                          <p className="text-xs text-gray-500 mt-0.5">
                            {session.attendance_count || 0} student{session.attendance_count === 1 ? '' : 's'} recorded
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant={
                          status === 'closed' ? 'gray' :
                          status === 'open' ? 'success' :
                          'info'
                        }>
                          {status}
                        </Badge>
                        <button
                          onClick={() => {
                            if (status === 'open' && session.attendance_session_id) {
                              router.push(`/dashboard/lecturer/session/${session.attendance_session_id}`);
                            } else {
                              router.push(`/dashboard/lecturer/session-detail/${session.id}`);
                            }
                          }}
                          className="p-2 text-gray-400 hover:text-indigo-500 hover:bg-indigo-50 rounded-lg transition-colors"
                          title={status === 'open' ? 'View live session' : 'View session details'}
                        >
                          <Eye className="h-4 w-4" />
                        </button>
                        {classDetail.can_edit ? (
                          <button
                            onClick={() => confirmDeleteSession(session.id)}
                            className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                            title="Delete session"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        ) : null}
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="px-6 py-12 text-center">
                  <Calendar className="h-10 w-10 text-gray-300 mx-auto" />
                  <p className="mt-4 text-gray-500">No sessions yet</p>
                  {classDetail.can_edit ? (
                    <Button onClick={openSettingsModal} size="sm" className="mt-4">
                      Start First Session
                    </Button>
                  ) : null}
                </div>
              )}
            </div>
          </Card>

          <Card>
            <h2 className="font-semibold text-gray-900 mb-4">Class Information</h2>
            <div className="space-y-4">
              <div className="flex justify-between py-2 border-b border-gray-50">
                <span className="text-gray-500">Course</span>
                <span className="font-medium text-gray-900">{classDetail.course.course_name}</span>
              </div>
              <div className="flex justify-between py-2 border-b border-gray-50">
                <span className="text-gray-500">Code</span>
                <span className="font-medium text-gray-900">{classDetail.course.course_code}</span>
              </div>
              <div className="flex justify-between py-2 border-b border-gray-50">
                <span className="text-gray-500">Section</span>
                <span className="font-medium text-gray-900">{classDetail.section || 'A'}</span>
              </div>
              <div className="flex justify-between py-2 border-b border-gray-50">
                <span className="text-gray-500">Semester</span>
                <span className="font-medium text-gray-900">{classDetail.semester}</span>
              </div>
              <div className="flex justify-between py-2 border-b border-gray-50">
                <span className="text-gray-500">Academic Year</span>
                <span className="font-medium text-gray-900">{classDetail.academic_year}</span>
              </div>
              <div className="flex justify-between py-2">
                <span className="text-gray-500">Total Sessions</span>
                <span className="font-medium text-gray-900">{classDetail.sessions.length}</span>
              </div>
            </div>
          </Card>
        </div>
      </div>

      <Modal isOpen={showSettingsModal} onClose={() => setShowSettingsModal(false)} title="Session Settings">
        <div className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Link Expiration Time
            </label>
            <SearchableSelect
              options={EXPIRATION_OPTIONS}
              value={expirationMinutes}
              onChange={(val) => setExpirationMinutes(val as string)}
              placeholder="Select expiration time..."
            />
            <p className="text-xs text-gray-500 mt-1">
              The QR code link will expire after this time
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Attendance Radius (meters)
            </label>
            <input
              type="number"
              min="1"
              max="1000"
              value={radiusMeters}
              onChange={(e) => setRadiusMeters(e.target.value)}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none transition-all focus:border-indigo-300 focus:ring-2 focus:ring-indigo-500/20"
            />
            <p className="text-xs text-gray-500 mt-1">
              Students must be within this radius of where you start the session.
            </p>
          </div>

          <div className="flex gap-3 pt-4">
            <Button
              variant="secondary"
              onClick={() => setShowSettingsModal(false)}
              className="flex-1"
            >
              Cancel
            </Button>
            <Button
              onClick={startAttendance}
              isLoading={startingSession}
              leftIcon={<Play className="h-4 w-4 fill-current" />}
              className="flex-1"
            >
              Start Session
            </Button>
          </div>
        </div>
      </Modal>

      <Modal isOpen={showDeleteModal} onClose={() => setShowDeleteModal(false)} title="Delete Session">
        <div className="space-y-6">
          <p className="text-gray-600">
            Are you sure you want to delete this session? This action cannot be undone and all attendance records for this session will be lost.
          </p>

          <div className="flex gap-3">
            <Button
              variant="secondary"
              onClick={() => setShowDeleteModal(false)}
              className="flex-1"
            >
              Cancel
            </Button>
            <Button
              variant="danger"
              onClick={deleteSession}
              isLoading={deletingSession}
              className="flex-1"
            >
              Delete
            </Button>
          </div>
        </div>
      </Modal>

      <Modal isOpen={showShareModal} onClose={() => setShowShareModal(false)} title="Share Class">
        <div className="space-y-6">
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Lecturer</label>
              <SearchableSelect
                options={lecturerOptions.map((lecturer) => ({
                  value: lecturer.id,
                  label: lecturer.email ? `${lecturer.full_name} (${lecturer.email})` : lecturer.full_name,
                }))}
                value={selectedLecturerId}
                onChange={(value) => setSelectedLecturerId(value)}
                placeholder="Search and select lecturer..."
                allowClear
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Access Level</label>
              <SearchableSelect
                options={[
                  { value: 'view', label: 'View only' },
                  { value: 'edit', label: 'Edit access' },
                ]}
                value={sharePermission}
                onChange={(value) => setSharePermission(value as 'view' | 'edit')}
                placeholder="Select access level..."
                searchable={false}
              />
            </div>

            <Button onClick={createShare} isLoading={savingShare} fullWidth>
              Save Share
            </Button>
          </div>

          <div className="border-t border-slate-100 pt-4">
            <h3 className="font-medium text-gray-900 mb-3">Current Shares</h3>
            {loadingShares ? (
              <div className="flex items-center justify-center py-6">
                <Loader size="md" />
              </div>
            ) : classShares.length === 0 ? (
              <p className="text-sm text-gray-500">This class has not been shared yet.</p>
            ) : (
              <div className="space-y-3 max-h-64 overflow-y-auto">
                {classShares.map((share) => (
                  <div key={share.id} className="rounded-xl border border-slate-100 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-medium text-gray-900">{share.lecturer?.full_name || 'Unknown lecturer'}</p>
                        <p className="text-sm text-gray-500">{share.lecturer?.email || 'No email'}</p>
                      </div>
                      <Button
                        variant="danger"
                        size="sm"
                        onClick={() => removeShare(share.id)}
                        isLoading={removingShareId === share.id}
                      >
                        Remove
                      </Button>
                    </div>
                    <div className="mt-3">
                      <SearchableSelect
                        options={[
                          { value: 'view', label: 'View only' },
                          { value: 'edit', label: 'Edit access' },
                        ]}
                        value={share.permission}
                        onChange={(value) => updateSharePermission(share, value as 'view' | 'edit')}
                        searchable={false}
                        className={updatingShareId === share.id ? 'opacity-70' : ''}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </Modal>
    </DashboardLayout>
  );
}

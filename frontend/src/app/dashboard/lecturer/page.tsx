'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import api from '@/lib/api';
import { useAuth } from '@/hooks/useAuth';
import { Plus, Users, GraduationCap, Play, BookOpen, User, Briefcase } from 'lucide-react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Loader } from '@/components/ui/Loader';
import { Modal } from '@/components/ui/Modal';
import { Input } from '@/components/ui/Input';
import { Alert } from '@/components/ui/Alert';
import { SearchableSelect } from '@/components/ui/SearchableSelect';
import { ApiRequestConfig } from '@/lib/api';
import { toast } from '@/lib/toast';
import { getBrowserLocation } from '@/lib/geolocation';
import { getStoredAttendanceRadius } from '@/lib/attendancePreferences';

interface ClassData {
  id: number;
  course: { course_code: string | null; course_name: string; programme?: { name: string } };
  section: string;
  semester: number;
  academic_year: string;
  student_count?: number;
  session_count?: number;
}

interface Programme {
  id: number;
  name: string;
}

interface Course {
  id: number;
  course_code: string | null;
  course_name: string;
  programme_id: number;
}

interface Stats {
  total_classes: number;
  total_students: number;
  attendance_rate: number;
}

interface Department {
  id: number;
  name: string;
}

export default function LecturerDashboard() {
  const router = useRouter();
  const { user, loading: authLoading, refreshUser } = useAuth();
  const [classes, setClasses] = useState<ClassData[]>([]);
  const [programmes, setProgrammes] = useState<Programme[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [stats, setStats] = useState<Stats>({ total_classes: 0, total_students: 0, attendance_rate: 0 });
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const userData = user as any;
  const hasLecturerProfile = !!userData?.lecturer?.id;

  const [formData, setFormData] = useState({
    mode: 'existing' as 'existing' | 'new',
    course_id: '',
    course_name: '',
    course_code: '',
    programme_id: '',
    new_programme_name: '',
    semester: '',
    academic_year: new Date().getFullYear().toString(),
    section: 'A',
  });

  const [profileForm, setProfileForm] = useState({
    full_name: '',
    department_id: '',
    new_department_name: '',
  });

  useEffect(() => {
    if (user && user.role?.name === 'lecturer') {
      if (hasLecturerProfile) {
        fetchData();
      } else {
        fetchAcademicData();
        setShowProfileModal(true);
        setLoading(false);
      }
    }
  }, [user]);

  const fetchData = async () => {
    try {
      const [classesRes, programmesRes, coursesRes, statsRes] = await Promise.all([
        api.get('/lecturer/classes'),
        api.get('/academic/programmes'),
        api.get('/academic/courses'),
        api.get('/lecturer/stats'),
      ]);
      setClasses(classesRes.data);
      setProgrammes(programmesRes.data);
      setCourses(coursesRes.data);
      setStats(statsRes.data);
    } catch (err: any) {
      console.error('Failed to fetch data', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchAcademicData = async () => {
    try {
      const [programmesRes, deptRes] = await Promise.all([
        api.get('/academic/programmes'),
        api.get('/academic/departments'),
      ]);
      setProgrammes(programmesRes.data);
      setDepartments(deptRes.data);
    } catch (err) {
      console.error('Failed to fetch academic data', err);
    }
  };

  const handleSetupProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError('');
    try {
      await api.post('/lecturer/profile', {
        full_name: profileForm.full_name,
        department_id: profileForm.department_id ? parseInt(profileForm.department_id) : null,
        new_department_name: profileForm.new_department_name || null,
      });
      await refreshUser();
      setShowProfileModal(false);
      fetchData();
    } catch (err: any) {
      const errorData = err.response?.data;
      let errorMessage = 'Failed to create profile';
      if (errorData?.detail) {
        errorMessage = typeof errorData.detail === 'string' ? errorData.detail : JSON.stringify(errorData.detail);
      } else if (err.message) {
        errorMessage = err.message;
      }
      setError(errorMessage);
    } finally {
      setSubmitting(false);
    }
  };

  const handleCreateClass = async (e: React.FormEvent) => {
    e.preventDefault();

    // Client-side validation
    if (!formData.semester) {
      setError('Please enter a semester');
      toast.error('Could not create class', 'Please enter a semester');
      return;
    }

    if (formData.mode === 'new') {
      if (!formData.course_name.trim()) {
        setError('Please enter a course name');
        toast.error('Could not create class', 'Please enter a course name');
        return;
      }
      if (!formData.programme_id && !formData.new_programme_name.trim()) {
        setError('Please select or create a programme');
        toast.error('Could not create class', 'Please select or create a programme');
        return;
      }
    } else {
      if (!formData.course_id) {
        setError('Please select a course');
        toast.error('Could not create class', 'Please select a course');
        return;
      }
    }

    setSubmitting(true);
    setError('');
    try {
      let courseId: number;

      if (formData.mode === 'new') {
        let programmeId: number;

        if (formData.new_programme_name.trim()) {
          const progRes = await api.post('/academic/programmes', {
            name: formData.new_programme_name.trim(),
          }, { toast: false } as ApiRequestConfig);
          programmeId = progRes.data.id;
        } else {
          programmeId = parseInt(formData.programme_id);
        }

        const courseRes = await api.post('/academic/courses', {
          course_name: formData.course_name.trim(),
          course_code: formData.course_code.trim() || null,
          programme_id: programmeId,
        }, { toast: false } as ApiRequestConfig);
        courseId = courseRes.data.id;
      } else {
        courseId = parseInt(formData.course_id);
      }

      await api.post('/academic/classes', {
        course_id: courseId,
        semester: parseInt(formData.semester),
        academic_year: formData.academic_year,
        section: formData.section,
      });

      setShowModal(false);
      resetForm();
      fetchData();
    } catch (err: any) {
      const errorData = err.response?.data;
      let errorMessage = 'Failed to create class';

      if (errorData?.detail) {
        errorMessage = typeof errorData.detail === 'string' ? errorData.detail : JSON.stringify(errorData.detail);
      } else if (errorData?.msg) {
        errorMessage = `${errorData.loc?.join('.') || 'Error'}: ${errorData.msg}`;
      } else if (err.message) {
        errorMessage = err.message;
      } else {
        errorMessage = 'An unexpected error occurred';
      }
      
      setError(errorMessage);
    } finally {
      setSubmitting(false);
    }
  };

  const resetForm = () => {
    setFormData({
      mode: 'existing',
      course_id: '',
      course_name: '',
      course_code: '',
      programme_id: '',
      new_programme_name: '',
      semester: '',
      academic_year: new Date().getFullYear().toString(),
      section: 'A',
    });
  };

  const filteredCourses = formData.programme_id
    ? courses.filter((c) => c.programme_id === parseInt(formData.programme_id))
    : courses;

  const startAttendance = async (classId: number) => {
    try {
      const location = await getBrowserLocation();
      const now = new Date();
      const sessionRes = await api.post(`/academic/classes/${classId}/sessions`, {
        class_id: classId,
        session_date: now.toISOString().split('T')[0],
      }, { toast: false } as ApiRequestConfig);

      const classSessionId = sessionRes.data.id;

      const response = await api.post('/attendance-sessions', {
        class_session_id: classSessionId,
        expires_in_minutes: 15,
        max_uses: 100,
        latitude: location.latitude,
        longitude: location.longitude,
        radius_meters: parseInt(getStoredAttendanceRadius(), 10),
      });
      window.location.href = `/dashboard/lecturer/session/${response.data.session_id}?token=${response.data.token}`;
    } catch (err) {
      console.error('Failed to start attendance', err);
      const message = err instanceof Error ? err.message : 'Unable to start attendance.';
      toast.error('Could not start session', message);
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

  if (!hasLecturerProfile) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center min-h-[60vh]">
          <Card className="max-w-lg w-full mx-4">
            <div className="text-center mb-6">
              <div className="inline-flex h-16 w-16 items-center justify-center rounded-full bg-indigo-100 text-indigo-600 mb-4">
                <User className="h-8 w-8" />
              </div>
              <h1 className="text-2xl font-bold text-slate-900">Complete Your Profile</h1>
              <p className="text-slate-500 mt-2">
                Set up your lecturer profile to start creating classes
              </p>
            </div>

            <form onSubmit={handleSetupProfile} className="space-y-4">
              {error && <Alert variant="error">{error}</Alert>}

              <Input
                label="Full Name"
                value={profileForm.full_name}
                onChange={(e) => setProfileForm({ ...profileForm, full_name: e.target.value })}
                placeholder="e.g. John Doe"
                required
              />

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Department</label>
                <SearchableSelect
                  options={departments.map((d) => ({ value: d.id, label: d.name }))}
                  value={profileForm.department_id}
                  onChange={(val) => setProfileForm({ ...profileForm, department_id: val as string, new_department_name: '' })}
                  placeholder="Search or select department..."
                  allowClear
                />
                <p className="text-xs text-slate-500 mt-1">Or create new below</p>
              </div>

              <Input
                label="New Department Name"
                value={profileForm.new_department_name}
                onChange={(e) => setProfileForm({ ...profileForm, new_department_name: e.target.value, department_id: '' })}
                placeholder="e.g. Computer Science"
              />

              <Button type="submit" isLoading={submitting} className="w-full">
                Complete Setup
              </Button>
            </form>
          </Card>
        </div>
      </DashboardLayout>
    );
  }

  const statCards = [
    { label: 'Classes', value: stats.total_classes || classes.length, icon: BookOpen, color: 'emerald' },
    { label: 'Total Students', value: stats.total_students || 0, icon: Users, color: 'indigo' },
    { label: 'Attendance Rate', value: `${stats.attendance_rate || 0}%`, icon: Play, color: 'purple' },
  ];

  const colorMap: Record<string, string> = {
    emerald: 'bg-emerald-50 text-emerald-600',
    indigo: 'bg-indigo-50 text-indigo-600',
    purple: 'bg-purple-50 text-purple-600',
  };

  return (
    <DashboardLayout>
      <div className="space-y-8">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl lg:text-3xl font-bold text-slate-900">
              Welcome back, {userData?.lecturer?.full_name || 'Lecturer'}
            </h1>
            <p className="text-slate-500 mt-1">Manage your classes and track attendance</p>
          </div>
          <Button leftIcon={<Plus className="h-4 w-4" />} onClick={() => setShowModal(true)}>
            New Class
          </Button>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
          {statCards.map((stat) => (
            <Card key={stat.label} className="relative overflow-hidden">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-slate-500">{stat.label}</p>
                  <p className="text-2xl font-bold text-slate-900 mt-1">{stat.value}</p>
                </div>
                <div className={`h-12 w-12 rounded-xl flex items-center justify-center ${colorMap[stat.color]}`}>
                  <stat.icon className="h-6 w-6" />
                </div>
              </div>
            </Card>
          ))}
        </div>

        <div>
          <h2 className="text-lg font-semibold text-slate-900 mb-4">Your Classes</h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {classes.map((cls) => (
              <Card key={cls.id} className="group hover:shadow-md transition-shadow">
                <div className="flex flex-col h-full">
                  <div className="flex items-start justify-between mb-4">
                    <Badge variant="info">{cls.course.course_code || 'N/A'}</Badge>
                    <span className="text-xs font-medium text-slate-400">
                      Section {cls.section || 'A'}
                    </span>
                  </div>

                  <h3 className="text-base font-semibold text-slate-900 leading-tight mb-1">
                    {cls.course.course_name}
                  </h3>
                  <p className="text-sm text-slate-500 mb-2">
                    {cls.course.programme?.name || 'No programme'}
                  </p>
                  <p className="text-sm text-slate-400 mb-4">
                    Semester {cls.semester}, {cls.academic_year}
                  </p>

                  <div className="mt-auto flex items-center gap-4 text-sm text-slate-500 pb-4">
                    <div className="flex items-center gap-1.5">
                      <Users className="h-4 w-4" />
                      <span>{cls.student_count || 0} students</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Play className="h-4 w-4" />
                      <span>{cls.session_count || 0} sessions</span>
                    </div>
                  </div>

                  <div className="flex gap-2 pt-4 border-t border-slate-100">
                    <Button
                      onClick={() => router.push(`/dashboard/lecturer/classes/${cls.id}`)}
                      className="flex-1"
                      size="sm"
                      leftIcon={<Play className="h-3.5 w-3.5 fill-current" />}
                    >
                      Take Attendance
                    </Button>
                  </div>
                </div>
              </Card>
            ))}

            {classes.length === 0 && (
              <div className="sm:col-span-2 lg:col-span-3 py-12 text-center border-2 border-dashed border-slate-200 rounded-2xl">
                <GraduationCap className="h-12 w-12 text-slate-300 mx-auto" />
                <p className="mt-4 text-slate-500 font-medium">No classes yet.</p>
                <p className="text-slate-400 text-sm mt-1">Click &quot;New Class&quot; to create your first class.</p>
              </div>
            )}
          </div>
        </div>

        <Modal isOpen={showModal} onClose={() => { setShowModal(false); resetForm(); }} title="Create New Class">
          <form onSubmit={handleCreateClass} className="space-y-4">
            {error && <Alert variant="error">{error}</Alert>}
            
            <div className="flex gap-2 mb-4">
              <button
                type="button"
                onClick={() => setFormData({ ...formData, mode: 'existing' })}
                className={`flex-1 py-2 px-4 rounded-lg text-sm font-medium transition-colors ${
                  formData.mode === 'existing'
                    ? 'bg-indigo-100 text-indigo-700'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                Select Existing Course
              </button>
              <button
                type="button"
                onClick={() => setFormData({ ...formData, mode: 'new' })}
                className={`flex-1 py-2 px-4 rounded-lg text-sm font-medium transition-colors ${
                  formData.mode === 'new'
                    ? 'bg-indigo-100 text-indigo-700'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                Create New Course
              </button>
            </div>

            {formData.mode === 'existing' ? (
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Programme</label>
                  <SearchableSelect
                    options={programmes.map((p) => ({ value: p.id, label: p.name }))}
                    value={formData.programme_id}
                    onChange={(val) => setFormData({ ...formData, programme_id: val as string, course_id: '' })}
                    placeholder="Search or select programme..."
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Course</label>
                  <SearchableSelect
                    options={filteredCourses.map((c) => ({
                      value: c.id,
                      label: `${c.course_name}${c.course_code ? ` (${c.course_code})` : ''}`
                    }))}
                    value={formData.course_id}
                    onChange={(val) => setFormData({ ...formData, course_id: val as string })}
                    placeholder="Search or select course..."
                  />
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <Input
                  label="Course Name"
                  value={formData.course_name}
                  onChange={(e) => setFormData({ ...formData, course_name: e.target.value })}
                  placeholder="e.g. Introduction to Computer Science"
                  required
                />

                <Input
                  label="Course Code (optional)"
                  value={formData.course_code}
                  onChange={(e) => setFormData({ ...formData, course_code: e.target.value })}
                  placeholder="e.g. CS101"
                />

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Programme</label>
                  <SearchableSelect
                    options={programmes.map((p) => ({ value: p.id, label: p.name }))}
                    value={formData.programme_id}
                    onChange={(val) => setFormData({ ...formData, programme_id: val as string, new_programme_name: '' })}
                    placeholder="Search or select existing..."
                    allowClear
                  />
                  <p className="text-xs text-slate-500 mt-1">Or type new programme name below</p>
                </div>

                <Input
                  label="New Programme Name"
                  value={formData.new_programme_name}
                  onChange={(e) => setFormData({ ...formData, new_programme_name: e.target.value, programme_id: '' })}
                  placeholder="e.g. Computer Science"
                />
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              <Input
                label="Semester"
                type="number"
                value={formData.semester}
                onChange={(e) => setFormData({ ...formData, semester: e.target.value })}
                placeholder="e.g. 1"
                min="1"
                max="10"
                required
              />
              <Input
                label="Academic Year"
                value={formData.academic_year}
                onChange={(e) => setFormData({ ...formData, academic_year: e.target.value })}
                placeholder="e.g. 2024"
                required
              />
            </div>

            <Input
              label="Section"
              value={formData.section}
              onChange={(e) => setFormData({ ...formData, section: e.target.value })}
              placeholder="e.g. A"
              maxLength={5}
            />

            <div className="flex gap-3 pt-4">
              <Button type="button" variant="secondary" onClick={() => { setShowModal(false); resetForm(); }} className="flex-1">
                Cancel
              </Button>
              <Button type="submit" isLoading={submitting} className="flex-1">
                Create Class
              </Button>
            </div>
          </form>
        </Modal>
      </div>
    </DashboardLayout>
  );
}

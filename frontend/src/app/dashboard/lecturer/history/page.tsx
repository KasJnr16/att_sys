'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import api from '@/lib/api';
import { useAuth } from '@/hooks/useAuth';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card } from '@/components/ui/Card';
import { Loader } from '@/components/ui/Loader';
import { Badge } from '@/components/ui/Badge';
import { BookOpen, Users, Calendar, ChevronRight, GraduationCap } from 'lucide-react';

interface ClassItem {
  id: number;
  course: {
    course_code: string;
    course_name: string;
    programme?: { name: string };
  };
  section: string;
  semester: number;
  academic_year: string;
  student_count?: number;
  session_count?: number;
}

export default function HistoryIndexPage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const [classes, setClasses] = useState<ClassItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user && user.role?.name === 'lecturer') {
      fetchClasses();
    }
  }, [user]);

  const fetchClasses = async () => {
    try {
      const response = await api.get('/lecturer/classes');
      setClasses(response.data);
    } catch (err) {
      console.error('Failed to fetch classes', err);
    } finally {
      setLoading(false);
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

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-indigo-50 flex items-center justify-center text-indigo-600">
            <BookOpen className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Attendance History</h1>
            <p className="text-sm text-gray-500">Select a class to view attendance records</p>
          </div>
        </div>

        {classes.length === 0 ? (
          <Card className="p-12 text-center">
            <div className="h-16 w-16 rounded-full bg-gray-100 flex items-center justify-center mx-auto mb-4">
              <GraduationCap className="h-8 w-8 text-gray-400" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">No Classes Found</h3>
            <p className="text-gray-500 mb-4">You don&apos;t have any classes assigned yet.</p>
          </Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {classes.map((cls) => (
              <div
                key={cls.id}
                className="cursor-pointer group"
                onClick={() => router.push(`/dashboard/lecturer/history/${cls.id}`)}
              >
                <Card className="h-full hover:shadow-lg hover:border-indigo-200 transition-all duration-200 p-0 overflow-hidden">
                  <div className="p-6">
                    <div className="flex items-start justify-between mb-4">
                      <Badge variant="info">{cls.course.course_code}</Badge>
                      <ChevronRight className="h-5 w-5 text-gray-400 group-hover:text-indigo-600 group-hover:translate-x-1 transition-all" />
                    </div>
                    <h3 className="font-semibold text-gray-900 mb-1 line-clamp-2">
                      {cls.course.course_name}
                    </h3>
                    {cls.course.programme && (
                      <p className="text-sm text-gray-500 mb-4">{cls.course.programme.name}</p>
                    )}
                    <div className="flex items-center gap-4 text-sm text-gray-500">
                      <div className="flex items-center gap-1.5">
                        <Users className="h-4 w-4" />
                        <span>{cls.student_count || 0} students</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <Calendar className="h-4 w-4" />
                        <span>{cls.session_count || 0} sessions</span>
                      </div>
                    </div>
                  </div>
                  <div className="px-6 py-3 bg-gray-50 border-t border-gray-100 flex items-center justify-between text-xs text-gray-500">
                    <span>Section {cls.section || 'A'}</span>
                    <span>Sem {cls.semester} &bull; {cls.academic_year}</span>
                  </div>
                </Card>
              </div>
            ))}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}

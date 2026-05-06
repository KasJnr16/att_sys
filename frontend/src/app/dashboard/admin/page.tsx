'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { 
  Users, 
  BookOpen, 
  GraduationCap, 
  ShieldCheck, 
  History,
  TrendingUp,
  UserPlus,
  PlusCircle
} from 'lucide-react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Loader } from '@/components/ui/Loader';

export default function AdminDashboard() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [stats, setStats] = useState<any>(null);

  useEffect(() => {
    if (authLoading) {
      return;
    }

    if (!user) {
      router.replace('/auth/lecturer');
      return;
    }

    if (user.role.name !== 'admin') {
      router.replace('/dashboard');
      return;
    }

    const timer = window.setTimeout(() => {
      setStats({
        total_students: 1240,
        total_lecturers: 85,
        total_courses: 42,
        active_sessions: 8,
        recent_logs: [
          { id: 1, action: 'User Created', user: 'admin@uni.edu', target: 'lecturer@uni.edu', time: '2 mins ago' },
          { id: 2, action: 'Attendance Closed', user: 'lecturer@uni.edu', target: 'CS101 - Lecture 4', time: '15 mins ago' },
          { id: 3, action: 'Device Enrolled', user: 'student@uni.edu', target: 'iPhone 15 Pro', time: '1 hour ago' },
        ],
      });
    }, 800);

    return () => window.clearTimeout(timer);
  }, [authLoading, router, user]);

  if (authLoading || (user?.role.name === 'admin' && !stats)) {
    return (
      <DashboardLayout>
        <div className="flex h-[60vh] items-center justify-center">
          <Loader size="xl" />
        </div>
      </DashboardLayout>
    );
  }

  if (!user || user.role.name !== 'admin') {
    return null;
  }

  return (
    <DashboardLayout>
      <div className="space-y-8">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 tracking-tight">System Administration</h1>
            <p className="text-gray-500 mt-1">Global overview of university attendance and user security.</p>
          </div>
          <div className="flex gap-3">
            <Button variant="outline" leftIcon={<UserPlus className="h-4 w-4" />}>
              Add User
            </Button>
            <Button leftIcon={<PlusCircle className="h-4 w-4" />}>
              Create Course
            </Button>
          </div>
        </div>

        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          <Card className="border-none shadow-md">
            <div className="flex items-center gap-4">
              <div className="h-12 w-12 rounded-2xl bg-indigo-50 flex items-center justify-center text-indigo-600">
                <Users className="h-6 w-6" />
              </div>
              <div>
                <p className="text-xs font-semibold text-gray-400 uppercase">Total Users</p>
                <p className="text-2xl font-bold text-gray-900">{stats.total_students + stats.total_lecturers}</p>
              </div>
            </div>
          </Card>
          <Card className="border-none shadow-md">
            <div className="flex items-center gap-4">
              <div className="h-12 w-12 rounded-2xl bg-green-50 flex items-center justify-center text-green-600">
                <BookOpen className="h-6 w-6" />
              </div>
              <div>
                <p className="text-xs font-semibold text-gray-400 uppercase">Courses</p>
                <p className="text-2xl font-bold text-gray-900">{stats.total_courses}</p>
              </div>
            </div>
          </Card>
          <Card className="border-none shadow-md">
            <div className="flex items-center gap-4">
              <div className="h-12 w-12 rounded-2xl bg-amber-50 flex items-center justify-center text-amber-600">
                <ShieldCheck className="h-6 w-6" />
              </div>
              <div>
                <p className="text-xs font-semibold text-gray-400 uppercase">Active Sessions</p>
                <p className="text-2xl font-bold text-gray-900">{stats.active_sessions}</p>
              </div>
            </div>
          </Card>
          <Card className="border-none shadow-md">
            <div className="flex items-center gap-4">
              <div className="h-12 w-12 rounded-2xl bg-purple-50 flex items-center justify-center text-purple-600">
                <TrendingUp className="h-6 w-6" />
              </div>
              <div>
                <p className="text-xs font-semibold text-gray-400 uppercase">Compliance</p>
                <p className="text-2xl font-bold text-gray-900">98.2%</p>
              </div>
            </div>
          </Card>
        </div>

        <div className="grid gap-8 lg:grid-cols-3">
          <div className="lg:col-span-2 space-y-6">
            <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-indigo-600" />
              Security Audit Logs
            </h2>
            <Card className="p-0 overflow-hidden border-none shadow-lg">
              <div className="divide-y divide-gray-100">
                {stats.recent_logs.map((log: any) => (
                  <div key={log.id} className="p-4 hover:bg-gray-50 transition-colors flex items-center justify-between">
                    <div className="flex items-start gap-4">
                      <div className="h-10 w-10 rounded-full bg-gray-50 flex items-center justify-center shrink-0">
                        <History className="h-5 w-5 text-gray-400" />
                      </div>
                      <div>
                        <p className="text-sm font-bold text-gray-900">{log.action}</p>
                        <p className="text-xs text-gray-500 mt-0.5">
                          <span className="font-medium text-gray-700">{log.user}</span> acted on <span className="font-medium text-gray-700">{log.target}</span>
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-[10px] font-bold text-gray-400 uppercase">{log.time}</p>
                      <Badge className="mt-1" variant="info">Success</Badge>
                    </div>
                  </div>
                ))}
              </div>
              <div className="p-4 bg-gray-50 border-t border-gray-100 text-center">
                <button className="text-sm font-bold text-indigo-600 hover:text-indigo-700 transition-colors">
                  View full audit trail →
                </button>
              </div>
            </Card>
          </div>

          <div className="space-y-6">
            <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
              <GraduationCap className="h-5 w-5 text-indigo-600" />
              Quick Actions
            </h2>
            <div className="grid gap-4">
              <Card className="p-4 hover:bg-indigo-50 transition-colors cursor-pointer group border-l-4 border-l-indigo-600">
                <h4 className="font-bold text-gray-900 group-hover:text-indigo-700">Manage Programmes</h4>
                <p className="text-xs text-gray-500 mt-1">Configure university departments and degrees.</p>
              </Card>
              <Card className="p-4 hover:bg-indigo-50 transition-colors cursor-pointer group border-l-4 border-l-indigo-600">
                <h4 className="font-bold text-gray-900 group-hover:text-indigo-700">Enrollment Overview</h4>
                <p className="text-xs text-gray-500 mt-1">Global student-to-course mapping.</p>
              </Card>
              <Card className="p-4 hover:bg-indigo-50 transition-colors cursor-pointer group border-l-4 border-l-indigo-600">
                <h4 className="font-bold text-gray-900 group-hover:text-indigo-700">System Health</h4>
                <p className="text-xs text-gray-500 mt-1">Monitor API latency and DB performance.</p>
              </Card>
            </div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}

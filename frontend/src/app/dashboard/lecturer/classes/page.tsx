'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import api from '@/lib/api';
import { BookOpen, Users, ArrowRight, Trash2 } from 'lucide-react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Loader } from '@/components/ui/Loader';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';

interface ClassData {
  id: number;
  course: { course_code: string; course_name: string };
  section: string;
  semester: number;
  academic_year: string;
  student_count?: number;
}

export default function LecturerClassesPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [classes, setClasses] = useState<ClassData[]>([]);
  const [loading, setLoading] = useState(true);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [classToDelete, setClassToDelete] = useState<ClassData | null>(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (user && (user.role?.name === 'lecturer' || user.role?.name === 'admin')) {
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

  const confirmDelete = (cls: ClassData, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setClassToDelete(cls);
    setShowDeleteModal(true);
  };

  const deleteClass = async () => {
    if (!classToDelete) return;
    setDeleting(true);
    try {
      await api.delete(`/academic/classes/${classToDelete.id}`);
      setShowDeleteModal(false);
      setClassToDelete(null);
      fetchClasses();
    } catch (err) {
      console.error('Failed to delete class', err);
    } finally {
      setDeleting(false);
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
      <div className="space-y-8">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">My Classes</h1>
            <p className="text-slate-500 mt-1">View and manage your class details</p>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {classes.map((cls) => (
            <Link key={cls.id} href={`/dashboard/lecturer/classes/${cls.id}`}>
              <Card className="h-full hover:shadow-md transition-shadow cursor-pointer group">
                <div className="flex flex-col h-full">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-2">
                      <Badge variant="info">{cls.course.course_code}</Badge>
                      <button
                        onClick={(e) => confirmDelete(cls, e)}
                        className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                        title="Delete class"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                    <span className="text-xs font-medium text-slate-400">
                      Section {cls.section || 'A'}
                    </span>
                  </div>

                  <h3 className="text-base font-semibold text-slate-900 leading-tight mb-1">
                    {cls.course.course_name}
                  </h3>
                  <p className="text-sm text-slate-500 mb-4">
                    Semester {cls.semester}, {cls.academic_year}
                  </p>

                  <div className="mt-auto flex items-center gap-4 text-sm text-slate-500 pb-4">
                    <div className="flex items-center gap-1.5">
                      <Users className="h-4 w-4" />
                      <span>{cls.student_count || 0}</span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-4 border-t border-slate-100">
                    <span className="text-sm text-indigo-600 font-medium group-hover:text-indigo-700">
                      View Details
                    </span>
                    <ArrowRight className="h-4 w-4 text-indigo-600 group-hover:translate-x-1 transition-transform" />
                  </div>
                </div>
              </Card>
            </Link>
          ))}

          {classes.length === 0 && (
            <div className="sm:col-span-2 lg:col-span-3 py-12 text-center border-2 border-dashed border-slate-200 rounded-2xl">
              <BookOpen className="h-12 w-12 text-slate-300 mx-auto" />
              <p className="mt-4 text-slate-500 font-medium">No classes found</p>
              <p className="text-slate-400 text-sm mt-1">
                Create a class from the dashboard to get started
              </p>
            </div>
          )}
        </div>
      </div>

      <Modal isOpen={showDeleteModal} onClose={() => setShowDeleteModal(false)} title="Delete Class">
        <div className="space-y-6">
          <p className="text-gray-600">
            Are you sure you want to delete <span className="font-semibold">{classToDelete?.course.course_name}</span>? 
            This will remove all associated sessions and cannot be undone.
          </p>
          <div className="flex gap-3">
            <Button variant="secondary" onClick={() => setShowDeleteModal(false)} className="flex-1">
              Cancel
            </Button>
            <Button variant="danger" onClick={deleteClass} isLoading={deleting} className="flex-1">
              Delete
            </Button>
          </div>
        </div>
      </Modal>
    </DashboardLayout>
  );
}

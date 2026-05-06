'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { Loader } from '@/components/ui/Loader';

export default function DashboardPage() {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (loading) {
      return;
    }

    if (!user) {
      router.replace('/auth/lecturer');
      return;
    }

    if (user.role.name === 'lecturer') {
      router.replace('/dashboard/lecturer');
      return;
    }

    if (user.role.name === 'student') {
      router.replace('/');
      return;
    }

    if (user.role.name === 'admin') {
      router.replace('/dashboard/admin');
    }
  }, [loading, router, user]);

  return (
    <div className="flex min-h-screen items-center justify-center">
      <Loader size="xl" />
    </div>
  );
}

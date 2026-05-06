'use client';

import { useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Loader } from '@/components/ui/Loader';

export default function AttendanceRedirectPage() {
  const { token } = useParams<{ token: string }>();
  const router = useRouter();

  useEffect(() => {
    if (token) {
      router.replace(`/verify?token=${token}`);
    }
  }, [router, token]);

  return (
    <div className="flex min-h-screen items-center justify-center">
      <Loader size="xl" />
    </div>
  );
}

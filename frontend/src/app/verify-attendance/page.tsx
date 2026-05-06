'use client';

import { Suspense, useEffect, useMemo } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Loader } from '@/components/ui/Loader';

function LegacyRedirect() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const target = useMemo(() => {
    const token = searchParams.get('token');
    const sessionId = searchParams.get('sessionId');
    const params = new URLSearchParams();

    if (token) {
      params.set('token', token);
    }

    if (sessionId) {
      params.set('sessionId', sessionId);
    }

    const query = params.toString();
    return query ? `/verify?${query}` : '/verify';
  }, [searchParams]);

  useEffect(() => {
    router.replace(target);
  }, [router, target]);

  return (
    <div className="flex min-h-screen items-center justify-center">
      <Loader size="xl" />
    </div>
  );
}

export default function VerifyAttendanceLegacyRoute() {
  return (
    <Suspense fallback={<div className="flex min-h-screen items-center justify-center">Loading...</div>}>
      <LegacyRedirect />
    </Suspense>
  );
}

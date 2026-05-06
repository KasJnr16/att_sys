'use client';

import Link from 'next/link';
import { GraduationCap, ShieldAlert } from 'lucide-react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';

export default function StudentDashboardPage() {
  return (
    <DashboardLayout>
      <div className="flex min-h-[60vh] items-center justify-center">
        <Card className="max-w-xl text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-amber-100 text-amber-600">
            <ShieldAlert className="h-8 w-8" />
          </div>
          <h1 className="text-2xl font-bold text-slate-900">Student Dashboard Disabled</h1>
          <p className="mt-3 text-slate-500">
            Students no longer use a dashboard. Attendance verification now happens only through the lecturer&apos;s live session link.
          </p>
          <div className="mt-6 flex justify-center">
            <Link href="/">
              <Button leftIcon={<GraduationCap className="h-4 w-4" />}>
                Return Home
              </Button>
            </Link>
          </div>
        </Card>
      </div>
    </DashboardLayout>
  );
}

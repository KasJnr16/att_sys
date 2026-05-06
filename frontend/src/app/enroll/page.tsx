'use client';

import Link from 'next/link';
import { Fingerprint, GraduationCap, ShieldCheck } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';

export default function EnrollPage() {
  return (
    <div className="min-h-screen bg-[#09090b] py-12">
      <div className="mx-auto max-w-2xl px-4">
        <div className="mb-8 text-center">
          <Link href="/" className="inline-flex items-center gap-2 text-slate-400 transition-colors hover:text-white">
            <GraduationCap className="h-5 w-5" />
            <span className="font-semibold">UniAtt</span>
          </Link>
        </div>

        <Card className="border border-slate-800 bg-slate-900/70 text-center shadow-2xl">
          <div className="mx-auto mb-5 flex h-20 w-20 items-center justify-center rounded-2xl bg-indigo-500/10 text-indigo-400">
            <ShieldCheck className="h-9 w-9" />
          </div>
          <h1 className="text-3xl font-bold text-white">Device Enrollment Moved</h1>
          <p className="mt-4 text-slate-400">
            Students no longer create dashboard accounts or enroll devices from a separate page.
            Device registration now happens directly inside the live attendance verification flow.
          </p>
          <div className="mt-6 rounded-2xl border border-slate-800 bg-slate-950/60 p-5 text-left">
            <div className="flex items-start gap-3 text-slate-300">
              <Fingerprint className="mt-0.5 h-5 w-5 text-indigo-400" />
              <p>
                Ask your lecturer for the active attendance link or QR code, enter the 6-digit session code,
                then continue with your index number and passkey or fingerprint.
              </p>
            </div>
          </div>
          <div className="mt-8 flex justify-center">
            <Link href="/">
              <Button>Back to Home</Button>
            </Link>
          </div>
        </Card>
      </div>
    </div>
  );
}

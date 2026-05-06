import Link from 'next/link';
import { ArrowRight, ShieldCheck, QrCode, BarChart3, GraduationCap, CheckCircle, Fingerprint } from 'lucide-react';
import { Button } from '@/components/ui/Button';

const features = [
  {
    icon: ShieldCheck,
    title: 'Biometric Security',
    description: 'WebAuthn ensures attendance is tied to the actual student, not just their credentials.',
  },
  {
    icon: QrCode,
    title: 'Instant QR Sessions',
    description: 'Lecturers start sessions in seconds. Students verify from any device with a browser.',
  },
  {
    icon: BarChart3,
    title: 'Live Dashboard',
    description: 'Track attendance as it happens. Export reports with a single click.',
  },
  {
    icon: GraduationCap,
    title: 'Focused Access',
    description: 'Lecturers and admins manage the system, while students verify attendance directly from the live session flow.',
  },
];

const stats = [
  { value: '99.9%', label: 'Uptime' },
  { value: '<2s', label: 'Verification Time' },
  { value: '100%', label: 'Attendance Accuracy' },
];

const steps = [
  {
    number: '01',
    title: 'Lecturer starts session',
    description: 'Create a QR code attendance session for your class in seconds.',
  },
  {
    number: '02',
    title: 'Students scan & verify',
    description: 'Students scan the QR or open the link, then confirm with biometrics.',
  },
  {
    number: '03',
    title: 'Records saved instantly',
    description: 'Attendance is verified and stored in real-time with full audit trail.',
  },
];

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-[#09090b] text-slate-50 overflow-x-hidden">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_80%_at_50%_-20%,rgba(99,102,241,0.15),transparent)]" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_60%_60%_at_80%_100%,rgba(99,102,241,0.08),transparent)]" />
      
      <header className="relative z-10 mx-auto max-w-7xl px-6 py-6">
        <nav className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 shadow-lg shadow-indigo-500/25">
              <GraduationCap className="h-5 w-5 text-white" />
            </div>
            <span className="text-xl font-bold">UniAtt</span>
          </div>
          <div className="flex items-center gap-4">
            <Link href="/auth/lecturer" className="hidden sm:block">
              <Button variant="ghost" size="sm">Sign In</Button>
            </Link>
            <Link href="/auth/lecturer">
              <Button size="sm">Get Started</Button>
            </Link>
          </div>
        </nav>
      </header>

      <main className="relative z-10 mx-auto max-w-7xl px-6 pb-24 pt-16">
        <section className="text-center max-w-4xl mx-auto">
          <div className="inline-flex items-center gap-2 rounded-full border border-indigo-500/30 bg-indigo-500/10 px-4 py-1.5 text-sm font-medium text-indigo-300 mb-6 animate-fade-in">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-indigo-500" />
            </span>
            Now in use at universities worldwide
          </div>
          
          <h1 className="text-5xl sm:text-6xl lg:text-7xl font-bold tracking-tight leading-[1.1] mb-6 animate-slide-up">
            <span className="bg-gradient-to-r from-white via-slate-200 to-slate-400 bg-clip-text text-transparent">
              Fraud-proof attendance
            </span>
            <br />
            <span className="bg-gradient-to-r from-indigo-400 via-purple-400 to-pink-400 bg-clip-text text-transparent">
              for modern classrooms
            </span>
          </h1>
          
          <p className="text-lg sm:text-xl text-slate-400 max-w-2xl mx-auto mb-10 animate-slide-up" style={{ animationDelay: '100ms' }}>
            Biometric verification meets QR code simplicity. No more proxy attendance. 
            Just secure, instant, verifiable attendance records.
          </p>
          
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 animate-slide-up" style={{ animationDelay: '200ms' }}>
            <Link href="/auth/lecturer">
              <Button size="xl" rightIcon={<ArrowRight className="h-5 w-5" />}>
                Start as Lecturer
              </Button>
            </Link>
            <Link href="/verify">
              <Button size="xl" variant="outline" className="border-slate-700 text-slate-300 hover:bg-slate-800/50 hover:border-slate-600">
                <Fingerprint className="h-5 w-5 mr-2" />
                Verify Attendance
              </Button>
            </Link>
          </div>
        </section>

        <section className="mt-20 grid grid-cols-2 sm:grid-cols-3 gap-6 max-w-3xl mx-auto animate-fade-in" style={{ animationDelay: '300ms' }}>
          {stats.map((stat) => (
            <div key={stat.label} className="text-center p-6 rounded-2xl border border-white/5 bg-white/[0.02] backdrop-blur-sm">
              <div className="text-3xl sm:text-4xl font-bold text-white mb-1">{stat.value}</div>
              <div className="text-sm text-slate-500">{stat.label}</div>
            </div>
          ))}
        </section>

        <section className="mt-32">
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold mb-4">Built for security and simplicity</h2>
            <p className="text-slate-400 max-w-2xl mx-auto">
              Every feature designed to eliminate attendance fraud while keeping the process frictionless.
            </p>
          </div>
          
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {features.map((feature, index) => (
              <div 
                key={feature.title} 
                className="group relative rounded-2xl border border-white/10 bg-gradient-to-b from-white/[0.05] to-transparent p-6 transition-all duration-300 hover:border-indigo-500/30 hover:bg-white/[0.08] animate-slide-up"
                style={{ animationDelay: `${index * 100}ms` }}
              >
                <div className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-xl bg-indigo-500/10 text-indigo-400 group-hover:bg-indigo-500/20 transition-colors">
                  <feature.icon className="h-6 w-6" />
                </div>
                <h3 className="text-lg font-semibold mb-2">{feature.title}</h3>
                <p className="text-sm text-slate-400 leading-relaxed">{feature.description}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="mt-32">
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold mb-4">How it works</h2>
            <p className="text-slate-400 max-w-2xl mx-auto">
              From lecture hall to attendance record in three simple steps.
            </p>
          </div>
          
          <div className="grid gap-8 lg:grid-cols-3">
            {steps.map((step, index) => (
              <div key={step.number} className="relative">
                <div className="text-[120px] font-bold text-white/5 absolute -top-8 -left-2 select-none leading-none">
                  {step.number}
                </div>
                <div className="relative pt-8">
                  <h3 className="text-xl font-semibold mb-3">{step.title}</h3>
                  <p className="text-slate-400">{step.description}</p>
                </div>
                {index < steps.length - 1 && (
                  <div className="hidden lg:block absolute top-16 right-0 translate-x-1/2 w-24">
                    <div className="h-px bg-gradient-to-r from-transparent via-white/20 to-transparent" />
                  </div>
                )}
              </div>
            ))}
          </div>
        </section>

        <section className="mt-32">
          <div className="relative rounded-3xl border border-white/10 bg-gradient-to-b from-white/[0.03] to-transparent p-8 sm:p-12 text-center overflow-hidden">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(99,102,241,0.1),transparent_50%)]" />
            <div className="relative">
              <h2 className="text-3xl sm:text-4xl font-bold mb-4">Ready to modernize your classroom?</h2>
              <p className="text-slate-400 max-w-xl mx-auto mb-8">
                Join universities already using UniAtt for secure, verifiable attendance tracking.
              </p>
              <Link href="/auth/lecturer">
                <Button size="xl" rightIcon={<ArrowRight className="h-5 w-5" />}>
                  Get Started Free
                </Button>
              </Link>
            </div>
          </div>
        </section>
      </main>

      <footer className="relative z-10 border-t border-white/5">
        <div className="mx-auto max-w-7xl px-6 py-12">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-6">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600">
                <GraduationCap className="h-4 w-4 text-white" />
              </div>
              <span className="text-lg font-semibold">UniAtt</span>
            </div>
            <div className="flex items-center gap-8 text-sm text-slate-500">
              <span className="flex items-center gap-2">
                <CheckCircle className="h-4 w-4 text-emerald-500" />
                SOC 2 Compliant
              </span>
            </div>
          </div>
          <div className="mt-8 pt-8 border-t border-white/5 flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-slate-500">
            <p>2026 UniAtt. Secure attendance for modern universities.</p>
            <div className="flex items-center gap-6">
              <a href="#" className="hover:text-slate-300 transition-colors">Privacy</a>
              <a href="#" className="hover:text-slate-300 transition-colors">Terms</a>
              <a href="#" className="hover:text-slate-300 transition-colors">Contact</a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}

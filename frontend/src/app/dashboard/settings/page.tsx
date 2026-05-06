'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Alert } from '@/components/ui/Alert';
import { Loader } from '@/components/ui/Loader';
import { User, Mail, Lock, Clock } from 'lucide-react';
import { SearchableSelect } from '@/components/ui/SearchableSelect';
import api, { handleApiError } from '@/lib/api';
import { toast } from '@/lib/toast';
import {
  ATTENDANCE_EXPIRATION_KEY,
  ATTENDANCE_RADIUS_KEY,
  DEFAULT_ATTENDANCE_RADIUS,
  getStoredAttendanceExpiration,
  getStoredAttendanceRadius,
} from '@/lib/attendancePreferences';

const EXPIRATION_OPTIONS = [
  { value: '5', label: '5 minutes' },
  { value: '10', label: '10 minutes' },
  { value: '15', label: '15 minutes' },
  { value: '20', label: '20 minutes' },
  { value: '30', label: '30 minutes' },
  { value: '60', label: '60 minutes' },
];

export default function SettingsPage() {
  const { user, loading: authLoading, refreshUser } = useAuth();
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');

  const [passwordForm, setPasswordForm] = useState({
    password: '',
    confirmPassword: '',
  });

  const [attendancePrefs, setAttendancePrefs] = useState({
    expiration_minutes: '15',
    radius_meters: DEFAULT_ATTENDANCE_RADIUS,
  });

  useEffect(() => {
    setAttendancePrefs({
      expiration_minutes: getStoredAttendanceExpiration(),
      radius_meters: getStoredAttendanceRadius(),
    });
  }, []);

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (passwordForm.password && passwordForm.password !== passwordForm.confirmPassword) {
      setError('Passwords do not match');
      toast.error('Could not save password', 'Passwords do not match');
      return;
    }

    if (passwordForm.password && passwordForm.password.length < 6) {
      setError('Password must be at least 6 characters');
      toast.error('Could not save password', 'Password must be at least 6 characters');
      return;
    }

    setLoading(true);
    try {
      const updateData: { password?: string } = {};
      if (passwordForm.password) {
        updateData.password = passwordForm.password;
      }

      if (Object.keys(updateData).length === 0) {
        setError('No changes to save');
        toast.info('Nothing to update', 'Make a change before saving your password');
        setLoading(false);
        return;
      }

      await api.put('/auth/me', updateData);
      await refreshUser();
      setSuccess('Password updated successfully');
      setPasswordForm({
        password: '',
        confirmPassword: '',
      });
    } catch (err: any) {
      setError(handleApiError(err));
    } finally {
      setLoading(false);
    }
  };

  const handleAttendancePrefsSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const normalizedRadius = String(
      Math.min(1000, Math.max(1, Number.parseInt(attendancePrefs.radius_meters, 10) || 50))
    );
    localStorage.setItem(ATTENDANCE_EXPIRATION_KEY, attendancePrefs.expiration_minutes);
    localStorage.setItem(ATTENDANCE_RADIUS_KEY, normalizedRadius);
    setAttendancePrefs((current) => ({ ...current, radius_meters: normalizedRadius }));
    setSuccess('Attendance preferences saved');
    setError('');
    toast.success('Preferences saved', 'Your attendance session defaults have been updated');
  };

  if (authLoading) {
    return (
      <DashboardLayout>
        <div className="flex h-[60vh] items-center justify-center">
          <Loader size="xl" />
        </div>
      </DashboardLayout>
    );
  }

  const getDisplayName = () => {
    if (user?.role?.name === 'lecturer' && (user as any)?.lecturer?.full_name) {
      return (user as any).lecturer.full_name;
    }
    if (user?.role?.name === 'student' && (user as any)?.student?.full_name) {
      return (user as any).student.full_name;
    }
    return user?.email?.split('@')[0] || 'User';
  };

  return (
    <DashboardLayout>
      <div className="max-w-2xl mx-auto space-y-8">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Settings</h1>
          <p className="text-slate-500 mt-1">Manage your profile and account settings</p>
        </div>

        {error && <Alert variant="error">{error}</Alert>}
        {success && <Alert variant="success">{success}</Alert>}

        <Card>
          <div className="flex items-center gap-3 mb-6 pb-6 border-b border-slate-100">
            <div className="h-12 w-12 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600">
              <User className="h-6 w-6" />
            </div>
            <div>
              <p className="font-semibold text-slate-900">{getDisplayName()}</p>
              <p className="text-sm text-slate-500 flex items-center gap-1">
                <Mail className="h-3.5 w-3.5" />
                {user?.email || 'Email'}
              </p>
            </div>
          </div>

          <form onSubmit={handlePasswordSubmit} className="space-y-6">
            <div className="pt-4 border-t border-slate-100">
              <h3 className="text-sm font-semibold text-slate-900 mb-4 flex items-center gap-2">
                <Lock className="h-4 w-4" />
                Change Password
              </h3>
              <div className="space-y-4">
                <Input
                  label="New Password"
                  type="password"
                  value={passwordForm.password}
                  onChange={(e) => setPasswordForm({ ...passwordForm, password: e.target.value })}
                  placeholder="Leave blank to keep current password"
                  leftIcon={<Lock className="h-5 w-5" />}
                />
                <Input
                  label="Confirm Password"
                  type="password"
                  value={passwordForm.confirmPassword}
                  onChange={(e) => setPasswordForm({ ...passwordForm, confirmPassword: e.target.value })}
                  placeholder="Confirm new password"
                  leftIcon={<Lock className="h-5 w-5" />}
                />
              </div>
            </div>

            <div className="flex justify-end pt-4">
              <Button type="submit" isLoading={loading}>
                Save Password
              </Button>
            </div>
          </form>
        </Card>

        {user?.role?.name === 'lecturer' && (
          <Card>
            <form onSubmit={handleAttendancePrefsSubmit} className="space-y-6">
              <div className="pb-6 border-b border-slate-100">
                <h3 className="text-sm font-semibold text-slate-900 flex items-center gap-2">
                  <Clock className="h-4 w-4" />
                  Attendance Preferences
                </h3>
                <p className="text-xs text-slate-500 mt-1">
                  Set your default preferences for attendance sessions
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Default Link Expiration
                </label>
                <SearchableSelect
                  options={EXPIRATION_OPTIONS}
                  value={attendancePrefs.expiration_minutes}
                  onChange={(val) => setAttendancePrefs({ ...attendancePrefs, expiration_minutes: val as string })}
                  placeholder="Select expiration time..."
                />
                <p className="text-xs text-slate-500 mt-1">
                  QR code links will expire after this time by default
                </p>
              </div>

              <Input
                label="Attendance Radius (meters)"
                type="number"
                min="1"
                max="1000"
                value={attendancePrefs.radius_meters}
                onChange={(e) => setAttendancePrefs({ ...attendancePrefs, radius_meters: e.target.value })}
                helperText="Students must be within this distance from the lecturer's token-generation point."
              />

              <div className="flex justify-end pt-4">
                <Button type="submit">
                  Save Preferences
                </Button>
              </div>
            </form>
          </Card>
        )}

        <Card>
          <h3 className="text-sm font-semibold text-slate-900 mb-4">Account Information</h3>
          <div className="space-y-3 text-sm">
            <div className="flex justify-between py-2 border-b border-slate-50">
              <span className="text-slate-500">Role</span>
              <span className="font-medium text-slate-900 capitalize">{user?.role?.name || 'N/A'}</span>
            </div>
            <div className="flex justify-between py-2 border-b border-slate-50">
              <span className="text-slate-500">Email</span>
              <span className="font-medium text-slate-900">{user?.email || 'N/A'}</span>
            </div>
            <p className="text-xs text-slate-400 pt-2">
              Email cannot be changed. Contact administrator if you need to update your email.
            </p>
          </div>
        </Card>
      </div>
    </DashboardLayout>
  );
}

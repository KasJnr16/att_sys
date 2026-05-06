'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import api from '@/lib/api';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card } from '@/components/ui/Card';
import { Loader } from '@/components/ui/Loader';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { ArrowLeft, Download, Calendar, Users, BookOpen, Check, X } from 'lucide-react';

interface AttendanceRecord {
  session_id: number;
  status: string;
  timestamp: string | null;
}

interface Student {
  id: number;
  student_index: string;
  full_name: string;
}

interface Session {
  id: number;
  date: string;
}

interface AttendanceRow {
  student: Student;
  attendance: AttendanceRecord[];
}

interface ClassInfo {
  course_name: string;
  course_code: string;
  programme_name: string;
}

interface AttendanceMatrixData {
  class: ClassInfo;
  sessions: Session[];
  rows: AttendanceRow[];
}

const getExcelColumnName = (columnNumber: number) => {
  let dividend = columnNumber;
  let columnName = '';

  while (dividend > 0) {
    const modulo = (dividend - 1) % 26;
    columnName = String.fromCharCode(65 + modulo) + columnName;
    dividend = Math.floor((dividend - modulo) / 26);
  }

  return columnName;
};

export default function AttendanceHistoryPage() {
  const { classId } = useParams();
  const router = useRouter();
  const [data, setData] = useState<AttendanceMatrixData | null>(null);
  const [loading, setLoading] = useState(true);
  const [showTimestamps, setShowTimestamps] = useState(true);

  useEffect(() => {
    if (classId) {
      fetchMatrix();
    }
  }, [classId]);

  const fetchMatrix = async () => {
    try {
      const response = await api.get(`/lecturer/classes/${classId}/attendance-matrix`);
      setData(response.data);
    } catch (err) {
      console.error('Failed to fetch attendance matrix', err);
    } finally {
      setLoading(false);
    }
  };

  const stats = useMemo(() => {
    if (!data) return null;
    const totalStudents = data.rows.length;
    const totalSessions = data.sessions.length;

    const sessionStats = data.sessions.map((session) => {
      let present = 0;
      data.rows.forEach((row) => {
        const att = row.attendance.find((a) => a.session_id === session.id);
        if (att?.status === 'present') present++;
      });
      return {
        sessionId: session.id,
        present,
        absent: totalStudents - present,
        percentage: totalStudents > 0 ? Math.round((present / totalStudents) * 100) : 0,
      };
    });

    const studentStats = data.rows.map((row) => {
      const present = row.attendance.filter((a) => a.status === 'present').length;
      return {
        studentId: row.student.id,
        present,
        percentage: totalSessions > 0 ? Math.round((present / totalSessions) * 100) : 0,
      };
    });

    return { totalStudents, totalSessions, sessionStats, studentStats };
  }, [data]);

  const getStudentStats = useCallback(
    (studentId: number) => {
      return stats?.studentStats.find((s) => s.studentId === studentId);
    },
    [stats]
  );

  const getSessionStats = useCallback(
    (sessionId: number) => {
      return stats?.sessionStats.find((s) => s.sessionId === sessionId);
    },
    [stats]
  );

  const exportAttendanceTable = async () => {
    if (!data) return;

    const XlsxPopulateModule = await import('xlsx-populate/browser/xlsx-populate');
    const XlsxPopulate = XlsxPopulateModule.default;
    const workbook = await XlsxPopulate.fromBlankAsync();
    const sheet = workbook.sheet(0);

    const sessionLabels = data.sessions.map((session) =>
      new Date(session.date).toLocaleDateString('en-GB', {
        day: '2-digit',
        month: 'short',
        year: '2-digit',
      })
    );

    const totalColumns = 2 + sessionLabels.length;
    const lastColumn = getExcelColumnName(totalColumns);
    const tableHeaders = ['Student Index', 'Student Name', ...sessionLabels];

    sheet.name('Attendance');

    sheet.range(`A1:${lastColumn}1`).merged(true).value(data.class.course_name).style({
      bold: true,
      fontSize: 18,
      horizontalAlignment: 'center',
      verticalAlignment: 'center',
      fill: 'E0E7FF',
    });

    sheet.range(`A2:${lastColumn}2`).merged(true).value(data.class.programme_name).style({
      bold: true,
      fontSize: 13,
      horizontalAlignment: 'center',
      verticalAlignment: 'center',
      fill: 'ECFDF5',
    });

    sheet.row(1).height(26);
    sheet.row(2).height(22);

    sheet.range(`A4:${lastColumn}4`).value([tableHeaders]).style({
      bold: true,
      horizontalAlignment: 'center',
      verticalAlignment: 'center',
      fill: 'F8FAFC',
      border: true,
    });

    const tableRows = data.rows.map((row) => [
      row.student.student_index,
      row.student.full_name,
      ...data.sessions.map((session) => {
        const attendance = row.attendance.find((att) => att.session_id === session.id);
        return attendance?.status === 'present' ? '✓' : '✗';
      }),
    ]);

    if (tableRows.length > 0) {
      const lastDataRow = tableRows.length + 4;
      sheet.range(`A5:${lastColumn}${lastDataRow}`).value(tableRows).style({
        border: true,
        verticalAlignment: 'center',
      });
      if (sessionLabels.length > 0) {
        sheet.range(`C5:${lastColumn}${lastDataRow}`).style({
          horizontalAlignment: 'center',
        });
      }
    } else {
      sheet.range(`A5:${lastColumn}5`).merged(true).value('No attendance records available').style({
        italic: true,
        horizontalAlignment: 'center',
        border: true,
      });
    }

    sheet.column('A').width(18);
    sheet.column('B').width(28);
    data.sessions.forEach((_, index) => {
      sheet.column(getExcelColumnName(index + 3)).width(14);
    });

    const blob = await workbook.outputAsync();
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.href = url;
    link.download = `${data.class.course_code || 'attendance'}_attendance_${new Date().toISOString().split('T')[0]}.xlsx`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex h-[60vh] items-center justify-center">
          <Loader size="xl" />
        </div>
      </DashboardLayout>
    );
  }

  if (!data) return null;

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={() => router.back()}
              className="flex h-10 w-10 items-center justify-center rounded-full border border-gray-200 transition-colors hover:bg-gray-100"
            >
              <ArrowLeft className="h-5 w-5 text-gray-600" />
            </button>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Attendance History</h1>
              <p className="text-sm text-gray-500">
                {data.class.course_code} &bull; {data.class.course_name}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowTimestamps(!showTimestamps)}
              className={showTimestamps ? 'border-indigo-200 bg-indigo-50' : ''}
            >
              {showTimestamps ? 'Hide' : 'Show'} Times
            </Button>
            <Button variant="outline" leftIcon={<Download className="h-4 w-4" />} onClick={exportAttendanceTable}>
              Export Excel
            </Button>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <Card className="border-none bg-gradient-to-br from-indigo-500 to-indigo-600 text-white shadow-lg">
            <div className="flex items-center gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-white/20">
                <Users className="h-6 w-6" />
              </div>
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-indigo-100">Total Students</p>
                <p className="text-2xl font-bold">{stats?.totalStudents || 0}</p>
              </div>
            </div>
          </Card>
          <Card className="border-none bg-gradient-to-br from-amber-500 to-amber-600 text-white shadow-lg">
            <div className="flex items-center gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-white/20">
                <Calendar className="h-6 w-6" />
              </div>
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-amber-100">Total Sessions</p>
                <p className="text-2xl font-bold">{stats?.totalSessions || 0}</p>
              </div>
            </div>
          </Card>
          <Card className="border-none bg-gradient-to-br from-emerald-500 to-emerald-600 text-white shadow-lg">
            <div className="flex items-center gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-white/20">
                <BookOpen className="h-6 w-6" />
              </div>
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-emerald-100">Programme</p>
                <p className="truncate text-lg font-bold">{data.class.programme_name}</p>
              </div>
            </div>
          </Card>
        </div>

        {data.sessions.length === 0 ? (
          <Card className="p-12 text-center">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-gray-100">
              <Calendar className="h-8 w-8 text-gray-400" />
            </div>
            <h3 className="mb-2 text-lg font-semibold text-gray-900">No Sessions Yet</h3>
            <p className="mb-4 text-gray-500">Start taking attendance to see records here.</p>
          </Card>
        ) : (
          <Card className="overflow-hidden p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-50 text-xs font-semibold uppercase tracking-wide text-slate-600">
                    <th className="sticky left-0 z-20 min-w-[100px] border-r border-slate-200 bg-slate-50 px-4 py-3 text-left">
                      Index
                    </th>
                    <th className="sticky left-[100px] z-20 min-w-[180px] border-r border-slate-200 bg-slate-50 px-4 py-3 text-left">
                      Student Name
                    </th>
                    {data.sessions.map((session) => {
                      const date = new Date(session.date);
                      return (
                        <th
                          key={session.id}
                          className="min-w-[90px] border-r border-slate-100 px-3 py-3 text-center"
                        >
                          <div className="font-medium">{date.getDate()}</div>
                          <div className="text-[10px] font-normal opacity-70">
                            {date.toLocaleDateString('en-US', { month: 'short' })}
                          </div>
                        </th>
                      );
                    })}
                    <th className="min-w-[80px] bg-slate-100 px-4 py-3 text-center font-semibold">Total %</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {data.rows.map((row, rowIndex) => {
                    const studentStats = getStudentStats(row.student.id);
                    const isEven = rowIndex % 2 === 0;
                    return (
                      <tr
                        key={row.student.id}
                        className={`${isEven ? 'bg-white' : 'bg-slate-50/50'} transition-colors hover:bg-indigo-50/30`}
                      >
                        <td className="sticky left-0 z-10 border-r border-slate-200 bg-inherit px-4 py-3 font-mono text-gray-600">
                          {row.student.student_index}
                        </td>
                        <td className="sticky left-[100px] z-10 border-r border-slate-200 bg-inherit px-4 py-3 font-medium text-gray-900">
                          {row.student.full_name}
                        </td>
                        {row.attendance.map((att) => {
                          const isPresent = att.status === 'present';
                          return (
                            <td
                              key={att.session_id}
                              className={`border-r border-slate-100 px-3 py-2 text-center ${
                                isPresent ? 'bg-emerald-50/50' : 'bg-red-50/30'
                              }`}
                            >
                              <div className="flex flex-col items-center">
                                <Badge
                                  variant={isPresent ? 'success' : 'danger'}
                                  className="min-w-[32px] font-bold"
                                >
                                  {isPresent ? <Check className="h-3 w-3" /> : <X className="h-3 w-3" />}
                                </Badge>
                                {showTimestamps && att.timestamp && (
                                  <span className="mt-1 text-[10px] font-medium text-gray-400">
                                    {new Date(att.timestamp).toLocaleTimeString('en-US', {
                                      hour: '2-digit',
                                      minute: '2-digit',
                                      hour12: false,
                                    })}
                                  </span>
                                )}
                              </div>
                            </td>
                          );
                        })}
                        <td className="bg-slate-50 px-4 py-3 text-center font-semibold">
                          <span
                            className={`${
                              (studentStats?.percentage || 0) >= 75
                                ? 'text-emerald-600'
                                : (studentStats?.percentage || 0) >= 50
                                ? 'text-amber-600'
                                : 'text-red-600'
                            }`}
                          >
                            {studentStats?.percentage || 0}%
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr className="bg-slate-800 text-xs font-semibold text-white">
                    <td className="sticky left-0 z-20 border-r border-slate-700 bg-slate-800 px-4 py-3" colSpan={2}>
                      Session Summary
                    </td>
                    {data.sessions.map((session) => {
                      const sessionStats = getSessionStats(session.id);
                      return (
                        <td key={session.id} className="border-r border-slate-700 px-3 py-3 text-center">
                          <div className="font-bold text-emerald-400">{sessionStats?.present || 0}</div>
                          <div className="text-[10px] font-normal text-slate-400">
                            / {stats?.totalStudents || 0}
                          </div>
                        </td>
                      );
                    })}
                    <td className="bg-slate-900 px-4 py-3 text-center">
                      <span className="text-indigo-300">
                        {stats?.totalSessions
                          ? Math.round(
                              (stats.sessionStats.reduce((acc, sessionStat) => acc + sessionStat.present, 0) /
                                (stats.totalStudents * stats.totalSessions)) *
                                100
                            )
                          : 0}
                        %
                      </span>
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </Card>
        )}

        <div className="flex items-center justify-between text-sm text-gray-500">
          <p>
            Showing {data.rows.length} student{data.rows.length !== 1 ? 's' : ''} across {data.sessions.length} session
            {data.sessions.length !== 1 ? 's' : ''}
          </p>
          <p>Last updated: {new Date().toLocaleString()}</p>
        </div>
      </div>
    </DashboardLayout>
  );
}

export interface Role {
  id: number;
  name: 'admin' | 'lecturer' | 'student';
}

export interface User {
  id: number;
  email: string;
  role: Role;
  is_active: boolean;
  lecturer?: Lecturer;
  student?: Student;
}

export interface Lecturer {
  id: number;
  user_id: number;
  full_name: string;
  department_id?: number;
}

export interface Student {
  id: number;
  user_id: number;
  student_index: string;
  full_name: string;
}

export interface Programme {
  id: number;
  name: string;
}

export interface Course {
  id: number;
  course_code: string;
  course_name: string;
  programme_id: number;
  programme?: Programme;
}

export interface Class {
  id: number;
  course_id: number;
  lecturer_id: number;
  semester: string | number;
  academic_year: string;
  section?: string;
  course?: Course;
  lecturer?: Lecturer;
}

export interface ClassSession {
  id: number;
  class_id: number;
  session_date: string;
  status?: 'scheduled' | 'open' | 'closed' | 'cancelled';
  attendance_session_id?: number;
  parent_class?: Class;
}

export interface AttendanceRecord {
  id: number;
  student_id: number;
  class_session_id: number;
  status: 'present' | 'absent' | 'late' | 'excused';
  verified_at?: string;
  student?: Student;
  class_session?: ClassSession;
}

export interface AttendanceSession {
  id: number;
  class_session_id: number;
  token: string;
  token_hash?: string;
  expires_at: string;
  max_uses: number;
  usage_count: number;
  is_active: boolean;
  created_by: number;
}

export interface AttendanceSessionResponse {
  session_id: number;
  token: string;
  expires_at: string;
  webauthn_options?: PublicKeyCredentialRequestOptions;
  class_info?: {
    course_name: string;
    course_code: string;
    lecturer_name: string;
  };
  session_info?: {
    start_time: string;
    end_time: string;
    date: string;
  };
}

export interface AttendanceMatrixResponse {
  class: {
    course_name: string;
    course_code: string;
    programme_name: string;
  };
  sessions: Array<{
    id: number;
    date: string;
    start: string;
  }>;
  rows: Array<{
    student: {
      id: number;
      student_index: string;
      full_name: string;
    };
    attendance: Array<{
      session_id: number;
      status: string;
      timestamp?: string;
    }>;
  }>;
}

export interface SessionStatus {
  id: number;
  class_session_id: number;
  status: 'active' | 'closed';
  attendance_count: number;
  class_session?: ClassSession;
}

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface RegisterData {
  email: string;
  password: string;
  role_id?: number;
}

export interface ApiError {
  detail: string;
}

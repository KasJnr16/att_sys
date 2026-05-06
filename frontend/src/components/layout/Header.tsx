import React, { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Bell, Search, Menu, X, BookOpen, User, Calendar, Settings } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { Avatar } from '@/components/ui/Avatar';
import api, { ApiRequestConfig } from '@/lib/api';

interface SearchResults {
  classes: Array<{
    id: number;
    course_code: string;
    course_name: string;
    section: string;
    semester: number;
    academic_year: string;
  }>;
  students: Array<{
    id: number;
    student_index: string;
    full_name: string;
    programme: string;
  }>;
  sessions: Array<{
    id: number;
    date: string;
    class_id: number;
    class_name: string;
  }>;
  settings: Array<{
    id: string;
    label: string;
    type: string;
  }>;
}

interface HeaderProps {
  onMenuClick?: () => void;
  isMobileMenuOpen?: boolean;
}

export const Header: React.FC<HeaderProps> = ({ onMenuClick, isMobileMenuOpen }) => {
  const { user } = useAuth();
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SearchResults | null>(null);
  const [showResults, setShowResults] = useState(false);
  const [searching, setSearching] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let active = true;

    const timer = setTimeout(async () => {
      if (searchQuery.length < 2) {
        if (active) {
          setSearchResults(null);
          setShowResults(false);
        }
        return;
      }

      setSearching(true);
      try {
        const response = await api.get('/search', {
          params: { q: searchQuery },
          toast: false,
        } as ApiRequestConfig);
        if (active) {
          setSearchResults(response.data);
          setShowResults(true);
        }
      } catch (err) {
        console.error('Search failed', err);
        if (active) {
          setSearchResults(null);
          setShowResults(false);
        }
      } finally {
        if (active) {
          setSearching(false);
        }
      }
    }, 300);

    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [searchQuery]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
        setShowResults(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleResultClick = (type: string, item: any) => {
    setShowResults(false);
    setSearchQuery('');

    switch (type) {
      case 'class':
        router.push(`/dashboard/lecturer/classes/${item.id}`);
        break;
      case 'student':
        if (user?.role?.name === 'admin') {
          router.push('/dashboard/admin');
        }
        break;
      case 'session':
        router.push(`/dashboard/lecturer/history/${item.class_id}`);
        break;
      case 'setting':
        router.push('/dashboard/settings');
        break;
    }
  };

  const getDisplayName = () => {
    if (user?.role?.name === 'lecturer' && user?.lecturer?.full_name) {
      return user.lecturer.full_name;
    }
    if (user?.role?.name === 'student' && user?.student?.full_name) {
      return user.student.full_name;
    }
    return user?.email?.split('@')[0] || 'User';
  };

  const getRoleLabel = (role: string) => {
    const labels: Record<string, string> = {
      lecturer: 'Lecturer',
      student: 'Student',
      admin: 'Administrator',
    };
    return labels[role] || role;
  };

  const displayName = getDisplayName();
  const visibleStudentResults = user?.role?.name === 'admin' ? searchResults?.students ?? [] : [];

  const hasResults = searchResults && (
    searchResults.classes.length > 0 ||
    visibleStudentResults.length > 0 ||
    searchResults.sessions.length > 0 ||
    searchResults.settings.length > 0
  );

  return (
    <header className="h-16 border-b border-slate-200 bg-white px-4 lg:px-8 flex items-center justify-between sticky top-0 z-20">
      <div className="flex items-center gap-4">
        <button
          onClick={onMenuClick}
          className="lg:hidden p-2 rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-700 transition-colors"
          aria-label="Toggle menu"
        >
          {isMobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>

        <div className="hidden md:block relative group max-w-md flex-1" ref={searchRef}>
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 group-focus-within:text-indigo-500 transition-colors" />
          <input
            type="text"
            placeholder="Search classes, students, records..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onFocus={() => searchResults && setShowResults(true)}
            className="w-full bg-slate-50 border border-transparent rounded-lg py-2 pl-10 pr-4 text-sm focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-300 focus:bg-white transition-all outline-none"
          />

          {showResults && searchQuery.length >= 2 && (
            <div className="absolute top-full left-0 right-0 mt-2 bg-white rounded-xl shadow-xl border border-slate-200 max-h-96 overflow-y-auto z-50">
              {searching ? (
                <div className="p-4 text-center text-slate-500">
                  <div className="animate-pulse">Searching...</div>
                </div>
              ) : hasResults ? (
                <div className="py-2">
                  {searchResults!.classes.length > 0 && (
                    <div>
                      <div className="px-3 py-1.5 text-xs font-semibold text-slate-500 uppercase tracking-wide">Classes</div>
                      {searchResults!.classes.map((item) => (
                        <button
                          key={`class-${item.id}`}
                          onClick={() => handleResultClick('class', item)}
                          className="w-full px-3 py-2.5 flex items-center gap-3 hover:bg-slate-50 text-left"
                        >
                          <BookOpen className="h-4 w-4 text-indigo-500 flex-shrink-0" />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-slate-900 truncate">{item.course_name}</p>
                            <p className="text-xs text-slate-500">{item.course_code} &bull; Section {item.section}</p>
                          </div>
                        </button>
                      ))}
                    </div>
                  )}

                  {visibleStudentResults.length > 0 && (
                    <div>
                      <div className="px-3 py-1.5 text-xs font-semibold text-slate-500 uppercase tracking-wide">Students</div>
                      {visibleStudentResults.map((item) => (
                        <button
                          key={`student-${item.id}`}
                          onClick={() => handleResultClick('student', item)}
                          className="w-full px-3 py-2.5 flex items-center gap-3 hover:bg-slate-50 text-left"
                        >
                          <User className="h-4 w-4 text-emerald-500 flex-shrink-0" />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-slate-900 truncate">{item.full_name}</p>
                            <p className="text-xs text-slate-500">{item.student_index} &bull; {item.programme}</p>
                          </div>
                        </button>
                      ))}
                    </div>
                  )}

                  {searchResults!.sessions.length > 0 && (
                    <div>
                      <div className="px-3 py-1.5 text-xs font-semibold text-slate-500 uppercase tracking-wide">Sessions</div>
                      {searchResults!.sessions.map((item) => (
                        <button
                          key={`session-${item.id}`}
                          onClick={() => handleResultClick('session', item)}
                          className="w-full px-3 py-2.5 flex items-center gap-3 hover:bg-slate-50 text-left"
                        >
                          <Calendar className="h-4 w-4 text-amber-500 flex-shrink-0" />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-slate-900 truncate">{item.class_name}</p>
                            <p className="text-xs text-slate-500">{new Date(item.date).toLocaleDateString()}</p>
                          </div>
                        </button>
                      ))}
                    </div>
                  )}

                  {searchResults!.settings.length > 0 && (
                    <div>
                      <div className="px-3 py-1.5 text-xs font-semibold text-slate-500 uppercase tracking-wide">Settings</div>
                      {searchResults!.settings.map((item) => (
                        <button
                          key={`setting-${item.id}`}
                          onClick={() => handleResultClick('setting', item)}
                          className="w-full px-3 py-2.5 flex items-center gap-3 hover:bg-slate-50 text-left"
                        >
                          <Settings className="h-4 w-4 text-slate-500 flex-shrink-0" />
                          <div className="flex-1">
                            <p className="text-sm font-medium text-slate-900">{item.label}</p>
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              ) : (
                <div className="p-4 text-center text-slate-500">
                  No results found for &quot;{searchQuery}&quot;
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      <div className="flex items-center gap-2 lg:gap-4">
        <button className="relative p-2 rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-700 transition-colors">
          <Bell className="h-5 w-5" />
          <span className="absolute top-1.5 right-1.5 h-2 w-2 bg-red-500 rounded-full" />
        </button>

        <div className="flex items-center gap-3 pl-3 border-l border-slate-200">
          <div className="hidden sm:block text-right">
            <p className="text-sm font-semibold text-slate-900 leading-none">{displayName}</p>
            <p className="text-xs text-slate-500 mt-0.5">{getRoleLabel(user?.role?.name || 'user')}</p>
          </div>
          <Avatar
            fallback={displayName?.charAt(0).toUpperCase() || 'U'}
            size="md"
          />
        </div>
      </div>
    </header>
  );
};

import React, { useState } from 'react';
import { Sidebar } from './Sidebar';
import { Header } from './Header';

interface DashboardLayoutProps {
  children: React.ReactNode;
}

export const DashboardLayout: React.FC<DashboardLayoutProps> = ({ children }) => {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const closeMobileMenu = () => setIsMobileMenuOpen(false);

  return (
    <div className="flex min-h-screen bg-slate-50">
      <div className="hidden lg:flex lg:flex-col lg:sticky lg:top-0 lg:h-screen">
        <Sidebar />
      </div>

      <div className="flex-1 flex flex-col min-w-0">
        <Header
          onMenuClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          isMobileMenuOpen={isMobileMenuOpen}
        />

        {isMobileMenuOpen && (
          <div className="fixed inset-0 z-30 lg:hidden">
            <div className="fixed inset-0 bg-slate-950/55 backdrop-blur-sm" onClick={closeMobileMenu} />
            <div className="fixed inset-y-0 left-0 w-[min(18rem,85vw)] bg-white shadow-2xl">
              <Sidebar onNavigate={closeMobileMenu} />
            </div>
          </div>
        )}

        <main className="flex-1 overflow-y-auto p-4 lg:p-8">
          <div className="max-w-7xl mx-auto">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
};

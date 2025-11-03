'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import DialInterface from '@/components/DialInterface';
import CallHistory from '@/components/CallHistory';
import { ThemeProvider } from '@/components/ThemeProvider';
import ThemeToggle from '@/components/ThemeToggle';

function HomeContent() {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);
  const [activeTab, setActiveTab] = useState<'dial' | 'history'>('dial');

  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    try {
      const response = await fetch('/api/auth/session', {
        credentials: 'include', // Important: include cookies
      });
      const data = await response.json();
      setIsAuthenticated(!!data?.user);
    } catch (error) {
      setIsAuthenticated(false);
    }
  };

  if (isAuthenticated === null) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-slate-800 to-blue-900 dark:from-slate-950 dark:via-slate-900 dark:to-blue-950 transition-colors duration-200">
        <div className="text-white text-xl flex items-center space-x-3">
          <svg className="animate-spin h-8 w-8" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
          <span>Loading...</span>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <>
        <div className="absolute top-4 right-4">
          <ThemeToggle />
        </div>
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-slate-800 to-blue-900 dark:from-slate-950 dark:via-slate-900 dark:to-blue-950 p-4 transition-colors duration-200">
          <div className="max-w-md w-full backdrop-blur-xl bg-white/5 dark:bg-white/5 border border-white/10 dark:border-white/20 shadow-2xl rounded-2xl p-8">
            <div className="text-center mb-8">
              <h1 className="text-3xl font-bold text-white mb-2">AMD Telephony</h1>
              <p className="text-white/70 dark:text-white/80">
                Advanced Answering Machine Detection System
              </p>
            </div>
            <div className="space-y-3">
              <Link
                href="/login"
                className="block w-full bg-gradient-to-r from-slate-700 to-cyan-500 dark:from-slate-600 dark:to-teal-500 text-white text-center py-3 rounded-lg font-semibold hover:from-slate-800 hover:to-cyan-600 dark:hover:from-slate-700 dark:hover:to-teal-600 transition-all transform hover:scale-[1.02] shadow-lg shadow-cyan-500/25 dark:shadow-teal-500/25"
              >
                Sign In
              </Link>
              <Link
                href="/register"
                className="block w-full bg-white/10 dark:bg-white/10 backdrop-blur-sm border border-white/20 dark:border-white/20 text-white text-center py-3 rounded-lg font-semibold hover:bg-white/20 dark:hover:bg-white/20 transition-all transform hover:scale-[1.02]"
              >
                Create Account
              </Link>
            </div>
          </div>
        </div>
      </>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-100 via-blue-50 to-cyan-50 dark:from-slate-900 dark:via-slate-800 dark:to-blue-900 transition-colors duration-200">
      {/* Navbar with gradient */}
      <nav className="bg-gradient-to-r from-slate-900 via-slate-800 to-blue-900 dark:from-slate-950 dark:via-slate-900 dark:to-blue-950 shadow-lg">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex items-center">
              <div className="flex-shrink-0 flex items-center">
                <h1 className="text-2xl font-bold text-white">📞 AMD Telephony</h1>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <ThemeToggle />
              <button
                onClick={async () => {
                  await fetch('/api/auth/sign-out', { method: 'POST' });
                  setIsAuthenticated(false);
                }}
                className="text-white/90 hover:text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-white/10 transition-all duration-200"
              >
                Sign Out
              </button>
            </div>
          </div>
        </div>
      </nav>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Tabs with gradient styling */}
        <div className="mb-8">
          <nav className="flex space-x-2 bg-white/60 dark:bg-slate-800/40 backdrop-blur-sm rounded-lg p-1 shadow-inner border border-white/20 dark:border-slate-700/30">
            <button
              onClick={() => setActiveTab('dial')}
              className={`${
                activeTab === 'dial'
                  ? 'bg-gradient-to-r from-slate-700 to-cyan-500 dark:from-slate-600 dark:to-teal-500 text-white shadow-lg'
                  : 'text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white'
              } flex-1 py-3 px-4 rounded-md font-semibold text-sm transition-all duration-200 transform hover:scale-[1.02]`}
            >
              📞 Dial Call
            </button>
            <button
              onClick={() => setActiveTab('history')}
              className={`${
                activeTab === 'history'
                  ? 'bg-gradient-to-r from-slate-700 to-teal-500 dark:from-slate-600 dark:to-cyan-500 text-white shadow-lg'
                  : 'text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white'
              } flex-1 py-3 px-4 rounded-md font-semibold text-sm transition-all duration-200 transform hover:scale-[1.02]`}
            >
              📋 Call History
            </button>
          </nav>
        </div>

        {/* Content with glassmorphism */}
        <div className="backdrop-blur-sm bg-white/70 dark:bg-slate-800/30 rounded-2xl shadow-xl border border-white/20 dark:border-slate-700/50 p-6 md:p-8 transition-colors duration-200">
          {activeTab === 'dial' && <DialInterface />}
          {activeTab === 'history' && <CallHistory />}
        </div>
      </div>
    </div>
  );
}

export default function Home() {
  return (
    <ThemeProvider>
      <HomeContent />
    </ThemeProvider>
  );
}
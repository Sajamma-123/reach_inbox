import React, { useState } from 'react';
import { useAuth } from './context/AuthContext';
import { LoginPage } from './pages/LoginPage';
import { DashboardPage } from './pages/DashboardPage';
import { ScheduledPage } from './pages/ScheduledPage';
import { SentPage } from './pages/SentPage';
import { Navbar } from './components/common/Navbar';
import { Sidebar } from './components/common/Sidebar';
import { ComposeModal } from './components/compose/ComposeModal';
import { Loader2 } from 'lucide-react';

export const App: React.FC = () => {
  const { user, loading, refreshUser } = useAuth();
  const [currentTab, setCurrentTab] = useState<'dashboard' | 'scheduled' | 'sent'>('dashboard');
  const [isComposeOpen, setIsComposeOpen] = useState(false);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#070a0f] flex items-center justify-center text-slate-400">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-8 h-8 animate-spin text-brand-500" />
          <p className="text-xs font-medium">Initializing ReachInbox Session...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <LoginPage />;
  }

  const slackConnected = !!user.slackConnection?.isActive;

  return (
    <div className="min-h-screen bg-[#0b0e14] text-slate-100 flex flex-col font-['Inter',sans-serif]">
      {/* Top Navbar */}
      <Navbar />

      <div className="flex-1 flex overflow-hidden">
        {/* Left Sidebar */}
        <Sidebar
          currentTab={currentTab}
          onSelectTab={setCurrentTab}
          onOpenCompose={() => setIsComposeOpen(true)}
          slackConnected={slackConnected}
        />

        {/* Main Content Area */}
        <main className="flex-1 overflow-y-auto bg-[#0b0e14]">
          {currentTab === 'dashboard' && (
            <DashboardPage
              onOpenCompose={() => setIsComposeOpen(true)}
              onSelectTab={setCurrentTab}
            />
          )}

          {currentTab === 'scheduled' && <ScheduledPage />}

          {currentTab === 'sent' && <SentPage />}
        </main>
      </div>

      {/* Compose Campaign Modal */}
      <ComposeModal
        isOpen={isComposeOpen}
        onClose={() => setIsComposeOpen(false)}
        onSuccess={() => {
          refreshUser();
          setCurrentTab('scheduled');
        }}
      />
    </div>
  );
};

export default App;

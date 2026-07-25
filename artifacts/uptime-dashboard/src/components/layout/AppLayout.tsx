import { ReactNode } from 'react';
import { Navbar } from './Navbar';
import { useMonitorWebSocket } from '@/hooks/use-websocket';
import { AddMonitorModal } from '@/components/AddMonitorModal';

export function AppLayout({ children }: { children: ReactNode }) {
  // Initialize websocket globally
  useMonitorWebSocket();

  return (
    <div className="min-h-screen bg-background flex flex-col font-sans">
      <Navbar />
      <main className="flex-1 container mx-auto px-4 sm:px-8 py-8 flex flex-col">
        {children}
      </main>
      <AddMonitorModal />
    </div>
  );
}

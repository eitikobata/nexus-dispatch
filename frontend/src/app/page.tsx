'use client';

import { DirectiveBoard } from '@/components/DirectiveBoard';
import { RosterPanel } from '@/components/RosterPanel';
import { ConnectionIndicator } from '@/components/ConnectionIndicator';
import { useNexusSocket } from '@/hooks/useNexusSocket';
import { RadioTower } from 'lucide-react';

export default function DashboardPage() {
  const { connected } = useNexusSocket();

  return (
    <main className="mx-auto max-w-[1600px] p-4 md:p-6">
      <header className="mb-6 flex items-center justify-between border-b border-line pb-4">
        <div className="flex items-center gap-2">
          <RadioTower size={18} className="text-teal" />
          <div>
            <h1 className="font-mono text-lg tracking-wide text-white">NEXUS</h1>
            <p className="text-xs text-ash">Dispatch console — Handler view</p>
          </div>
        </div>
        <ConnectionIndicator connected={connected} />
      </header>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_320px]">
        <DirectiveBoard />
        <RosterPanel />
      </div>
    </main>
  );
}

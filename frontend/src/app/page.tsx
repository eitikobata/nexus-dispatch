'use client';

import { DirectiveBoard } from '@/components/DirectiveBoard';
import { RosterPanel } from '@/components/RosterPanel';
import { ConnectionIndicator } from '@/components/ConnectionIndicator';
import { AgentBanner } from '@/components/AgentBanner';
import { useNexusSocket } from '@/hooks/useNexusSocket';
import { RadioTower, BarChart3 } from 'lucide-react';

const GRAFANA_URL = process.env.NEXT_PUBLIC_GRAFANA_URL;

export default function DashboardPage() {
  const { connected } = useNexusSocket();

  return (
    <>
      <header className="border-b border-line px-4 py-4 md:px-6">
        <div className="mx-auto flex max-w-[1600px] items-center justify-between">
          <div className="flex items-center gap-2">
            <RadioTower size={18} className="text-teal" />
            <div>
              <h1 className="font-mono text-lg tracking-wide text-white">N-SEC</h1>
              <p className="text-xs text-ash">Nexus dispatch console — Handler view</p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            {GRAFANA_URL && (
              <a
                href={GRAFANA_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 rounded border border-line px-2 py-1 font-mono text-xs text-ash transition hover:border-teal hover:text-teal"
              >
                <BarChart3 size={13} />
                Live metrics
              </a>
            )}
            <ConnectionIndicator connected={connected} />
          </div>
        </div>
      </header>

      <AgentBanner />

      <main className="mx-auto max-w-[1600px] p-4 md:p-6">
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_320px]">
          <DirectiveBoard />
          <RosterPanel />
        </div>
      </main>
    </>
  );
}

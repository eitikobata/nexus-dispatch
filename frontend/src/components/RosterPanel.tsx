'use client';

import { useOperatives, useSetOperativeStatus } from '@/hooks/useOperatives';
import { StatusPill } from './StatusPill';
import { Users } from 'lucide-react';

export function RosterPanel() {
  const { data: operatives, isLoading } = useOperatives();
  const setStatus = useSetOperativeStatus();

  const available = (operatives ?? []).filter((o) => o.status === 'AVAILABLE').length;
  const total = operatives?.length ?? 0;

  return (
    <div className="rounded border border-line bg-panel p-3">
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Users size={14} className="text-ash" />
          <h3 className="font-mono text-xs uppercase tracking-wider text-ash">Roster</h3>
        </div>
        <span className="font-mono text-xs text-teal">
          {available}/{total} available
        </span>
      </div>

      {isLoading ? (
        <p className="font-mono text-xs text-ash">Loading roster…</p>
      ) : (
        <div className="flex flex-col gap-1.5" style={{ maxHeight: '70vh', overflowY: 'auto' }}>
          {(operatives ?? []).map((op) => (
            <div key={op.id} className="flex items-center justify-between rounded border border-line/50 px-2 py-1.5 text-sm">
              <div>
                <p className="font-medium text-white">{op.codename}</p>
                <p className="font-mono text-[10px] text-ash">{op.skills.map((s) => s.name).join(', ')}</p>
              </div>
              <div className="flex items-center gap-2">
                <StatusPill status={op.status} />
                <button
                  onClick={() =>
                    setStatus.mutate({
                      operativeId: op.id,
                      status: op.status === 'OFF_DUTY' ? 'AVAILABLE' : 'OFF_DUTY',
                    })
                  }
                  disabled={setStatus.isPending || op.status === 'ASSIGNED' || op.status === 'BUSY'}
                  title={op.status === 'OFF_DUTY' ? 'Bring online' : 'Take off duty'}
                  className="rounded border border-line px-1.5 py-0.5 font-mono text-[9px] text-ash transition hover:border-teal hover:text-teal disabled:opacity-30"
                >
                  {op.status === 'OFF_DUTY' ? 'ONLINE' : 'OFFLINE'}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

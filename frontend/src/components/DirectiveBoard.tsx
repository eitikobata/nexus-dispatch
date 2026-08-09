'use client';

import { useDirectives } from '@/hooks/useDirectives';
import { useOperatives } from '@/hooks/useOperatives';
import { DirectiveCard } from './DirectiveCard';
import { DirectiveStatus } from '@/lib/types';

const COLUMNS: { status: DirectiveStatus; label: string }[] = [
  { status: 'QUEUED', label: 'Queued' },
  { status: 'ASSIGNED', label: 'Assigned' },
  { status: 'IN_PROGRESS', label: 'In progress' },
  { status: 'COMPLETED', label: 'Completed' },
  { status: 'FAILED', label: 'Failed' },
];

export function DirectiveBoard() {
  const { data: directives, isLoading } = useDirectives();
  const { data: operatives } = useOperatives();

  if (isLoading) {
    return <p className="font-mono text-sm text-ash">Loading directives…</p>;
  }

  const byStatus = (status: DirectiveStatus) =>
    (directives ?? [])
      .filter((d) => d.status === status)
      .sort((a, b) => new Date(b.queuedAt).getTime() - new Date(a.queuedAt).getTime());

  return (
    <div className="grid grid-cols-1 gap-3 md:grid-cols-5">
      {COLUMNS.map((col) => {
        const items = byStatus(col.status);
        return (
          <div key={col.status} className="flex flex-col gap-2">
            <div className="flex items-center justify-between px-1">
              <h3 className="font-mono text-xs uppercase tracking-wider text-ash">{col.label}</h3>
              <span className="font-mono text-xs text-ash">{items.length}</span>
            </div>
            <div className="flex flex-col gap-2 overflow-y-auto" style={{ maxHeight: '70vh' }}>
              {items.length === 0 ? (
                <p className="px-1 font-mono text-[11px] text-ash/50">— empty —</p>
              ) : (
                items
                  .slice(0, 20)
                  .map((d) => <DirectiveCard key={d.id} directive={d} operatives={operatives ?? []} />)
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

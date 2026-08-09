'use client';

import { useState } from 'react';
import { Directive, Operative } from '@/lib/types';
import { PriorityBadge } from './PriorityBadge';
import { useEscalate, useReassign } from '@/hooks/useDirectives';
import { ArrowUpCircle, Repeat } from 'lucide-react';

function timeAgo(iso: string): string {
  const seconds = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  return `${Math.floor(minutes / 60)}h ago`;
}

export function DirectiveCard({ directive, operatives }: { directive: Directive; operatives: Operative[] }) {
  const [reassignOpen, setReassignOpen] = useState(false);
  const reassign = useReassign();
  const escalate = useEscalate();

  const activeAssignment = directive.assignments.find((a) => !a.finishedAt);
  const availableOperatives = operatives.filter(
    (op) => op.status === 'AVAILABLE' && op.skills.some((s) => s.id === directive.requiredSkill.id),
  );

  return (
    <div className="rounded border border-line bg-panel p-3 text-sm">
      <div className="mb-2 flex items-start justify-between gap-2">
        <p className="font-medium text-white">{directive.title}</p>
        <PriorityBadge priority={directive.priority} />
      </div>

      <p className="mb-2 font-mono text-xs text-ash">{directive.requiredSkill.name}</p>

      {activeAssignment?.operative && (
        <p className="mb-2 font-mono text-xs text-teal">→ {activeAssignment.operative.codename}</p>
      )}

      <div className="flex items-center justify-between">
        <span className="font-mono text-[10px] text-ash">{timeAgo(directive.queuedAt)}</span>

        {directive.status === 'QUEUED' && (
          <div className="flex gap-1">
            <button
              onClick={() => escalate.mutate(directive.id)}
              disabled={escalate.isPending}
              title="Escalate priority"
              className="rounded border border-line p-1 text-ash transition hover:border-amber hover:text-amber disabled:opacity-40"
            >
              <ArrowUpCircle size={14} />
            </button>
            <button
              onClick={() => setReassignOpen((v) => !v)}
              title="Reassign manually"
              className="rounded border border-line p-1 text-ash transition hover:border-teal hover:text-teal"
            >
              <Repeat size={14} />
            </button>
          </div>
        )}
      </div>

      {reassignOpen && (
        <div className="mt-2 border-t border-line pt-2">
          {availableOperatives.length === 0 ? (
            <p className="font-mono text-[10px] text-ash">No available operative with this skill right now.</p>
          ) : (
            <div className="flex flex-wrap gap-1">
              {availableOperatives.map((op) => (
                <button
                  key={op.id}
                  onClick={() => {
                    reassign.mutate({ directiveId: directive.id, operativeId: op.id });
                    setReassignOpen(false);
                  }}
                  className="rounded border border-line px-2 py-0.5 font-mono text-[10px] text-ash transition hover:border-teal hover:text-teal"
                >
                  {op.codename}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

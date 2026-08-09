import { Priority } from '@/lib/types';

const STYLES: Record<Priority, string> = {
  LOW: 'text-ash border-line',
  MEDIUM: 'text-teal border-teal/40',
  HIGH: 'text-amber border-amber/40',
  CRITICAL: 'text-coral border-coral/50 animate-pulse',
};

export function PriorityBadge({ priority }: { priority: Priority }) {
  return (
    <span className={`inline-block rounded border px-1.5 py-0.5 font-mono text-[10px] tracking-wider ${STYLES[priority]}`}>
      {priority}
    </span>
  );
}

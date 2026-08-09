import { OperativeStatus } from '@/lib/types';

const STYLES: Record<OperativeStatus, string> = {
  AVAILABLE: 'bg-teal/15 text-teal',
  ASSIGNED: 'bg-amber/15 text-amber',
  BUSY: 'bg-amber/15 text-amber',
  OFF_DUTY: 'bg-ash/15 text-ash',
};

export function StatusPill({ status }: { status: OperativeStatus }) {
  return (
    <span className={`inline-block rounded-full px-2 py-0.5 font-mono text-[10px] tracking-wider ${STYLES[status]}`}>
      {status.replace('_', ' ')}
    </span>
  );
}

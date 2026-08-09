export function ConnectionIndicator({ connected }: { connected: boolean }) {
  return (
    <div className="flex items-center gap-2 font-mono text-xs text-ash">
      <span className="relative flex h-2 w-2">
        {connected && (
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-teal opacity-60" />
        )}
        <span className={`relative inline-flex h-2 w-2 rounded-full ${connected ? 'bg-teal' : 'bg-ash'}`} />
      </span>
      {connected ? 'LIVE' : 'RECONNECTING'}
    </div>
  );
}

'use client';

import Image from 'next/image';
import { useEffect, useState } from 'react';
import { Volume2, VolumeX } from 'lucide-react';
import { useAmbientAudio } from '@/hooks/useAmbientAudio';

const LINES = [
  'Standing by, Handler. Route me anywhere.',
  "Directive accepted. I'll take it from here.",
  "Nexus routing's clean today — nobody's stuck in queue.",
  "SLA's ticking. You want this escalated, Handler?",
  'Comms open. Talk to me.',
  "Another one in the queue? I've got this.",
  "Off duty's overrated. Put me back in rotation.",
  "Mission's done. What's next on the board?",
];

const LINE_INTERVAL_MS = 6000;

export function AgentBanner() {
  const [lineIndex, setLineIndex] = useState(0);
  const [visible, setVisible] = useState(true);
  const { muted, toggleMute } = useAmbientAudio('/nexus-ambient.m4a');

  useEffect(() => {
    const interval = setInterval(() => {
      setVisible(false);
      const swap = setTimeout(() => {
        setLineIndex((i) => (i + 1) % LINES.length);
        setVisible(true);
      }, 250);
      return () => clearTimeout(swap);
    }, LINE_INTERVAL_MS);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="relative w-full overflow-hidden border-b border-line" style={{ aspectRatio: '1920 / 420' }}>
      <Image
        src="/n-sec-agent-banner.jpg"
        alt="N-SEC field operative on standby, Nexus Station background"
        fill
        priority
        className="object-cover"
        style={{ objectPosition: 'center center' }}
      />

      <div className="absolute inset-0 bg-gradient-to-t from-void via-transparent to-void/40" />

      <button
        onClick={toggleMute}
        title={muted ? 'Unmute ambient audio' : 'Mute ambient audio'}
        className="absolute right-3 top-3 rounded border border-line/60 bg-void/70 p-1.5 text-ash backdrop-blur transition hover:border-teal hover:text-teal"
      >
        {muted ? <VolumeX size={14} /> : <Volume2 size={14} />}
      </button>

      <div className="absolute bottom-3 left-1/2 w-[min(90%,520px)] -translate-x-1/2">
        <div
          className={`rounded border border-teal/30 bg-void/80 px-4 py-2.5 text-center backdrop-blur transition-opacity duration-300 ${
            visible ? 'opacity-100' : 'opacity-0'
          }`}
        >
          <p className="font-mono text-xs text-teal">{LINES[lineIndex]}</p>
        </div>
      </div>
    </div>
  );
}

'use client';

import { useEffect, useRef, useState } from 'react';

// Browsers block audio autoplay with sound — the track starts muted and
// only plays audibly after the person explicitly unmutes. Autoplay is
// attempted (muted) so the loop is already running and in sync the moment
// they unmute, instead of restarting from zero.
export function useAmbientAudio(src: string) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [muted, setMuted] = useState(true);

  useEffect(() => {
    const audio = new Audio(src);
    audio.loop = true;
    audio.muted = true;
    audio.volume = 0.35;
    audio.play().catch(() => {
      // Autoplay blocked entirely (some mobile browsers) — fine, it'll
      // start on the first user interaction with the mute toggle instead.
    });
    audioRef.current = audio;

    return () => {
      audio.pause();
      audioRef.current = null;
    };
  }, [src]);

  const toggleMute = () => {
    const audio = audioRef.current;
    if (!audio) return;
    const next = !muted;
    audio.muted = next;
    if (!next && audio.paused) {
      audio.play().catch(() => {});
    }
    setMuted(next);
  };

  return { muted, toggleMute };
}

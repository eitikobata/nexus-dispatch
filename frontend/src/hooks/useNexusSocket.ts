'use client';

import { useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { getSocket } from '@/lib/socket';

const DIRECTIVE_EVENTS = ['directive:queued', 'directive:assigned', 'directive:completed', 'directive:failed'];
const OPERATIVE_EVENTS = ['operative:status'];

// Subscribes once, invalidates the relevant query on any relevant event.
// This is deliberately dumb — it doesn't try to patch the cache in place
// event-by-event, which is exactly the kind of thing that drifts out of
// sync with the server over a long-running session. A refetch is cheap
// enough here that correctness wins over saving one request.
export function useNexusSocket() {
  const queryClient = useQueryClient();
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    const socket = getSocket();

    const onConnect = () => setConnected(true);
    const onDisconnect = () => setConnected(false);
    const onDirectiveEvent = () => queryClient.invalidateQueries({ queryKey: ['directives'] });
    const onOperativeEvent = () => queryClient.invalidateQueries({ queryKey: ['operatives'] });
    const onSlaBreach = () => queryClient.invalidateQueries({ queryKey: ['directives'] });

    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);
    setConnected(socket.connected);

    for (const event of DIRECTIVE_EVENTS) socket.on(event, onDirectiveEvent);
    for (const event of OPERATIVE_EVENTS) socket.on(event, onOperativeEvent);
    socket.on('sla:breach', onSlaBreach);

    return () => {
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
      for (const event of DIRECTIVE_EVENTS) socket.off(event, onDirectiveEvent);
      for (const event of OPERATIVE_EVENTS) socket.off(event, onOperativeEvent);
      socket.off('sla:breach', onSlaBreach);
    };
  }, [queryClient]);

  return { connected };
}

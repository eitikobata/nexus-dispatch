'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { DirectiveStatus } from '@/lib/types';

export function useDirectives(status?: DirectiveStatus) {
  return useQuery({
    queryKey: ['directives', status ?? 'all'],
    queryFn: () => api.getDirectives(status),
    refetchInterval: 15000, // fallback poll — WebSocket invalidation handles the common case
  });
}

export function useReassign() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ directiveId, operativeId }: { directiveId: string; operativeId: string }) =>
      api.reassign(directiveId, operativeId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['directives'] });
      queryClient.invalidateQueries({ queryKey: ['operatives'] });
    },
  });
}

export function useEscalate() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (directiveId: string) => api.escalate(directiveId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['directives'] }),
  });
}

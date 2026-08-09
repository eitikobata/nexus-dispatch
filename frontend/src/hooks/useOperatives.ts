'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { OperativeStatus } from '@/lib/types';

export function useOperatives() {
  return useQuery({
    queryKey: ['operatives'],
    queryFn: () => api.getOperatives(),
    refetchInterval: 15000,
  });
}

export function useSetOperativeStatus() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ operativeId, status }: { operativeId: string; status: OperativeStatus }) =>
      api.setOperativeStatus(operativeId, status),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['operatives'] }),
  });
}

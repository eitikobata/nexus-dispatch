import { Directive, DirectiveStatus, Operative, OperativeStatus } from './types';

const BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3000';

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...init?.headers },
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.message ?? `Request failed: ${res.status}`);
  }
  return res.json();
}

export const api = {
  getDirectives: (status?: DirectiveStatus) =>
    request<Directive[]>(`/directives${status ? `?status=${status}` : ''}`),

  getOperatives: () => request<Operative[]>('/operatives'),

  reassign: (directiveId: string, operativeId: string) =>
    request<unknown>(`/directives/${directiveId}/reassign`, {
      method: 'POST',
      body: JSON.stringify({ operativeId }),
    }),

  escalate: (directiveId: string) =>
    request<unknown>(`/directives/${directiveId}/escalate`, { method: 'POST' }),

  setOperativeStatus: (operativeId: string, status: OperativeStatus) =>
    request<Operative>(`/operatives/${operativeId}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    }),
};

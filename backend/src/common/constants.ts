// Fixed skill set for the demo. A real product would let skills be created
// dynamically, but RabbitMQ topology (one queue per skill) is asserted at
// bootstrap, so the set needs to be known ahead of time here.
export const SKILLS = ['recon', 'infiltration', 'sabotage', 'extraction', 'hacking'] as const;
export type SkillName = (typeof SKILLS)[number];

export const DIRECTIVE_CATEGORIES = [
  'Recover asset',
  'Disable outpost defenses',
  'Extract informant',
  'Plant listening device',
  'Breach data vault',
  'Escort convoy',
  'Sabotage supply line',
] as const;

// Maps Directive.priority to a RabbitMQ message priority (queues are
// declared with x-max-priority: 10). Higher number = handled first,
// best-effort, by consumers pulling from the same skill queue.
export const PRIORITY_WEIGHT: Record<string, number> = {
  LOW: 1,
  MEDIUM: 4,
  HIGH: 7,
  CRITICAL: 10,
};

export const RABBITMQ_MAX_PRIORITY = 10;

// How long a message waits in the per-skill retry queue before it's
// dead-lettered back onto the main skill queue for another attempt.
export const RETRY_DELAY_MS = 5000;

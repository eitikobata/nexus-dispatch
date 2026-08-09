export type DirectiveStatus = 'QUEUED' | 'ASSIGNED' | 'IN_PROGRESS' | 'COMPLETED' | 'FAILED';
export type Priority = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
export type OperativeStatus = 'AVAILABLE' | 'ASSIGNED' | 'BUSY' | 'OFF_DUTY';

export interface Skill {
  id: string;
  name: string;
}

export interface Operative {
  id: string;
  codename: string;
  status: OperativeStatus;
  skills: Skill[];
}

export interface Assignment {
  id: string;
  operativeId: string;
  assignedAt: string;
  acceptedAt: string | null;
  finishedAt: string | null;
  outcome: 'SUCCESS' | 'FAILED' | 'ABORTED' | null;
  operative?: Operative;
}

export interface Directive {
  id: string;
  title: string;
  category: string;
  priority: Priority;
  status: DirectiveStatus;
  estimatedDurationSec: number;
  queuedAt: string;
  assignedAt: string | null;
  completedAt: string | null;
  requiredSkill: Skill;
  assignments: Assignment[];
}

export type Brand<T, Name extends string> = T & { readonly __brand: Name };

export type CompanyId = Brand<string, 'CompanyId'>;
export type WorkId = Brand<string, 'WorkId'>;
export type UserId = Brand<string, 'UserId'>;
export type LearningAreaId = Brand<string, 'LearningAreaId'>;
export type CompetencyId = Brand<string, 'CompetencyId'>;
export type UnitId = Brand<string, 'UnitId'>;

export type Role = 'superadmin' | 'admin' | 'tutor' | 'rh' | 'collaborator';

export interface Company {
  id: CompanyId;
  name: string;
  active: boolean;
}

export interface Work {
  id: WorkId;
  companyId: CompanyId;
  name: string;
  status: 'planning' | 'active' | 'completed' | 'archived';
}

export interface Membership {
  userId: UserId;
  companyId: CompanyId;
  role: Role;
  active: boolean;
}

export type LearningState = 'not_started' | 'in_practice' | 'consolidated' | 'review' | 'pending_review';

export interface LearningProgress {
  userId: UserId;
  competencyId: CompetencyId;
  level: 'N1' | 'N2' | 'N3' | 'N4' | 'N5';
  state: LearningState;
  completedUnits: UnitId[];
  lastActivityAt?: string;
}

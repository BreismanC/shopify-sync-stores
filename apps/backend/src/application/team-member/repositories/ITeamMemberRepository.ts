import {
  TeamMember,
  TeamInvitation,
  InvitationStatus,
} from '../../../domain/entities/team_member.entity';

export abstract class ITeamMemberRepository {
  abstract findByUserIdAndTenantId(
    userId: string,
    tenantId: string,
  ): Promise<TeamMember | null>;
  /** Incluye soft-deleted (para revive al re-aceptar). */
  abstract findByUserIdAndTenantIdWithDeleted(
    userId: string,
    tenantId: string,
  ): Promise<TeamMember | null>;
  abstract save(teamMember: TeamMember): Promise<TeamMember>;
  abstract create(teamMember: Partial<TeamMember>): TeamMember;
  abstract findByTenantId(tenantId: string): Promise<TeamMember[]>;
  abstract softDelete(teamMember: TeamMember): Promise<void>;
  abstract recover(teamMember: TeamMember): Promise<TeamMember>;
}

export abstract class ITeamInvitationRepository {
  abstract findByToken(token: string): Promise<TeamInvitation | null>;
  abstract findById(id: string): Promise<TeamInvitation | null>;
  abstract findByTenantId(tenantId: string): Promise<TeamInvitation[]>;
  abstract findByEmailAndTenant(
    email: string,
    tenantId: string,
  ): Promise<TeamInvitation | null>;
  abstract save(invitation: TeamInvitation): Promise<TeamInvitation>;
  abstract create(invitation: Partial<TeamInvitation>): TeamInvitation;
  abstract findPendingExpired(now: Date): Promise<TeamInvitation[]>;
  abstract markExpired(ids: string[]): Promise<void>;
}

export { TeamMember, TeamInvitation, InvitationStatus };

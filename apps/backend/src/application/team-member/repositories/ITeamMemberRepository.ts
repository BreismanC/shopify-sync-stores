import { TeamMember } from '../../../domain/entities/team_member.entity';

export abstract class ITeamMemberRepository {
  abstract findByUserIdAndTenantId(
    userId: string,
    tenantId: string,
  ): Promise<TeamMember | null>;
  abstract save(teamMember: TeamMember): Promise<TeamMember>;
  abstract create(teamMember: Partial<TeamMember>): TeamMember;
  abstract findByTenantId(tenantId: string): Promise<TeamMember[]>;
}

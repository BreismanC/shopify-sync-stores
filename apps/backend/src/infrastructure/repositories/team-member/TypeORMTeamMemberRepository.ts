import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TeamMember } from '../../../domain/entities/team_member.entity';
import { ITeamMemberRepository } from '../../../application/team-member/repositories/ITeamMemberRepository';

@Injectable()
export class TypeORMTeamMemberRepository implements ITeamMemberRepository {
  constructor(
    @InjectRepository(TeamMember)
    private readonly teamMemberRepository: Repository<TeamMember>,
  ) {}

  async findByUserIdAndTenantId(
    userId: string,
    tenantId: string,
  ): Promise<TeamMember | null> {
    return this.teamMemberRepository.findOne({ where: { userId, tenantId } });
  }

  async save(teamMember: TeamMember): Promise<TeamMember> {
    return this.teamMemberRepository.save(teamMember);
  }

  create(teamMember: Partial<TeamMember>): TeamMember {
    return this.teamMemberRepository.create(teamMember);
  }

  async findByTenantId(tenantId: string): Promise<TeamMember[]> {
    return this.teamMemberRepository.find({ where: { tenantId } });
  }
}

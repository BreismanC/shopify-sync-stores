import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThan, In } from 'typeorm';
import {
  TeamInvitation,
  InvitationStatus,
} from '../../../domain/entities/team_member.entity';
import { ITeamInvitationRepository } from '../../../application/team-invitation/repositories/ITeamInvitationRepository';

@Injectable()
export class TypeORMTeamInvitationRepository implements ITeamInvitationRepository {
  constructor(
    @InjectRepository(TeamInvitation)
    private readonly repository: Repository<TeamInvitation>,
  ) {}

  findByToken(token: string): Promise<TeamInvitation | null> {
    return this.repository.findOne({ where: { token } });
  }

  findById(id: string): Promise<TeamInvitation | null> {
    return this.repository.findOne({ where: { id } });
  }

  findByTenantId(tenantId: string): Promise<TeamInvitation[]> {
    return this.repository.find({ where: { tenantId } });
  }

  findByEmailAndTenant(
    email: string,
    tenantId: string,
  ): Promise<TeamInvitation | null> {
    return this.repository
      .createQueryBuilder('invitation')
      .where('invitation.tenantId = :tenantId', { tenantId })
      .andWhere('LOWER(invitation.email) = LOWER(:email)', { email })
      .getOne();
  }

  save(invitation: TeamInvitation): Promise<TeamInvitation> {
    return this.repository.save(invitation);
  }

  create(invitation: Partial<TeamInvitation>): TeamInvitation {
    return this.repository.create(invitation);
  }

  findPendingExpired(now: Date): Promise<TeamInvitation[]> {
    return this.repository.find({
      where: {
        status: InvitationStatus.PENDING,
        expiresAt: LessThan(now),
      },
    });
  }

  async markExpired(ids: string[]): Promise<void> {
    if (ids.length === 0) return;
    await this.repository.update(
      { id: In(ids) },
      { status: InvitationStatus.EXPIRED },
    );
  }
}

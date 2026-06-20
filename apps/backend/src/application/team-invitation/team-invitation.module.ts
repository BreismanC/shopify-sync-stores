import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TeamMember, TeamInvitation } from '../../domain/entities/team_member.entity';
import { User } from '../../domain/entities/user.entity';
import { Tenant } from '../../domain/entities/tenant.entity';
import { ITeamMemberRepository } from '../team-member/repositories/ITeamMemberRepository';
import {
  ITEAM_INVITATION_REPOSITORY,
  ITeamInvitationRepository,
} from './repositories/ITeamInvitationRepository';
import { TypeORMTeamInvitationRepository } from '../../infrastructure/repositories/team-member/TypeORMTeamInvitationRepository';
import { TeamInvitationService } from './team-invitation.service';
import { TeamInvitationController } from './team-invitation.controller';
import { AuthModule } from '../auth/auth.module';
import { TenantModule } from '../tenant/tenant.module';
import { TeamMemberModule } from '../team-member/team.module';
import { EmailModule } from '../../infrastructure/services/email/email.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([TeamMember, TeamInvitation, User, Tenant]),
    forwardRef(() => AuthModule),
    forwardRef(() => TenantModule),
    forwardRef(() => TeamMemberModule),
    forwardRef(() => EmailModule),
  ],
  controllers: [TeamInvitationController],
  providers: [
    TeamInvitationService,
    { provide: ITEAM_INVITATION_REPOSITORY, useClass: TypeORMTeamInvitationRepository },
  ],
  exports: [TeamInvitationService],
})
export class TeamInvitationModule {}

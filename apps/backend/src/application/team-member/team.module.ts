import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TeamMember } from '../../domain/entities/team_member.entity';
import { ITeamMemberRepository } from './repositories/ITeamMemberRepository';
import { TypeORMTeamMemberRepository } from '../../infrastructure/repositories/team-member/TypeORMTeamMemberRepository';

@Module({
  imports: [TypeOrmModule.forFeature([TeamMember])],
  providers: [
    {
      provide: ITeamMemberRepository,
      useClass: TypeORMTeamMemberRepository,
    },
  ],
  exports: [ITeamMemberRepository],
})
export class TeamMemberModule {}

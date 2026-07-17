import { IsString, IsEmail, IsNotEmpty, IsOptional } from 'class-validator';

export class InviteTeamMemberDto {
  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsEmail()
  email!: string;

  @IsOptional()
  @IsString()
  role?: string;
}

import { IsString, IsEmail, IsNotEmpty } from 'class-validator';

export class InviteTeamMemberDto {
  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsEmail()
  email!: string;

  @IsString()
  @IsNotEmpty()
  role!: string;
}

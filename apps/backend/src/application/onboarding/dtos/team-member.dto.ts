import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsEnum,
  IsEmail,
} from 'class-validator';
import { StoreRole } from '../../../domain/enums/store-role.enum';

export class UpdateTeamMemberDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  name?: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  role?: string;
}

export class DeleteTeamMemberParamsDto {
  @IsString()
  @IsNotEmpty()
  id!: string;
}

export class StoreRoleFilterDto {
  @IsOptional()
  @IsEnum(StoreRole)
  role?: StoreRole;
}

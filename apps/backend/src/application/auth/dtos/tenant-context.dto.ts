import { IsString, IsUUID, Length } from 'class-validator';

export class SelectTenantDto {
  @IsUUID()
  tenantId: string;
}

export class UpsertAuthTenantDto {
  @IsString()
  @Length(2, 120)
  name: string;
}

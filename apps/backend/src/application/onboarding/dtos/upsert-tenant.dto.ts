import { IsString, MinLength, IsNotEmpty } from 'class-validator';

export class UpsertTenantDto {
  @IsString()
  @IsNotEmpty()
  @MinLength(3, {
    message: 'El nombre de la empresa debe tener al menos 3 caracteres',
  })
  name!: string;
}

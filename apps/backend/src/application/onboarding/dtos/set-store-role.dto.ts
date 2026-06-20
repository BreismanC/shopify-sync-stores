import { IsEnum, IsUUID } from 'class-validator';
import { StoreRole } from '../../../domain/enums/store-role.enum';

export class SetStoreRoleDto {
  @IsUUID()
  storeId!: string;

  @IsEnum(StoreRole, { message: 'El rol debe ser SOURCE o VENDOR' })
  role!: StoreRole;
}

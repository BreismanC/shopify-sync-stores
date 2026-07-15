import { IsEmail, IsNotEmpty, IsString, MaxLength } from 'class-validator';
import { Transform } from 'class-transformer';
import { normalizeStoreKey } from '../../../domain/entities/store.entity';

export class ConnectByStoreKeyDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(64)
  @Transform(({ value }) =>
    typeof value === 'string' ? normalizeStoreKey(value) : value,
  )
  storeKey!: string;
}

export class SendStoreKeyEmailDto {
  @IsEmail()
  @IsNotEmpty()
  email!: string;
}

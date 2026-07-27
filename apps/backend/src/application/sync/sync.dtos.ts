import {
  IsArray,
  IsIn,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  Min,
} from 'class-validator';
import { Transform, Type } from 'class-transformer';

export class ListProductsDto {
  @IsOptional() @IsUUID() sourceStoreId?: string;
  @IsOptional() @IsString() search?: string;
  @IsOptional() @Type(() => Number) @Min(1) page = 1;
  @IsOptional() @Type(() => Number) @Min(1) @Max(100) perPage = 20;
  @IsOptional() @IsIn(['title', 'createdAt']) sortBy: 'title' | 'createdAt' =
    'createdAt';
  @IsOptional()
  @IsIn(['asc', 'desc'])
  @Transform(({ value }) => String(value).toLowerCase())
  order: 'asc' | 'desc' = 'desc';
}

export class CreateSyncBatchDto {
  @IsUUID() sourceStoreId: string;
  @IsOptional() @IsArray() @IsUUID('4', { each: true }) productIds: string[] =
    [];
}

export class UpdateSyncSettingsDto {
  @IsOptional() @IsObject() productRules?: Record<string, unknown>;
  @IsOptional() @IsObject() orderRules?: Record<string, unknown>;
  @IsOptional() @IsObject() inventoryRules?: Record<string, unknown>;
}

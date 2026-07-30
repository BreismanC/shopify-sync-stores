import { IsString, IsNotEmpty } from 'class-validator';

export class ConnectStoreDto {
  @IsString()
  @IsNotEmpty()
  shopifyShopUrl!: string;

  @IsString()
  @IsNotEmpty()
  shopifyAccessToken!: string;

  @IsString()
  @IsNotEmpty()
  shopifyApiSecret!: string;

  @IsString()
  @IsNotEmpty()
  shopifyApiKey!: string;
}

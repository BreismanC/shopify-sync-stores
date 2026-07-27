import {
  Body,
  Controller,
  Get,
  Param,
  Put,
  Req,
  UseGuards,
} from '@nestjs/common';
import { IsBoolean, IsOptional, IsString } from 'class-validator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { TenantMembershipGuard } from '../auth/guards/tenant-membership.guard';
import { IInventoryRepository } from './repositories/inventory.repository';

class UpsertLocationMappingDto {
  @IsString() sourceLocationId: string;
  @IsString() vendorLocationId: string;
  @IsOptional() @IsBoolean() isActive?: boolean;
}

@Controller('tenant/:tenantId/connections/:connectionId/inventory-locations')
@UseGuards(JwtAuthGuard, TenantMembershipGuard)
export class InventoryController {
  constructor(private readonly inventory: IInventoryRepository) {}
  @Get()
  list(
    @Req() req: { tenantId: string },
    @Param('connectionId') connectionId: string,
  ) {
    return this.inventory.listMappings(req.tenantId, connectionId);
  }
  @Put()
  async upsert(
    @Req() req: { tenantId: string },
    @Param('connectionId') connectionId: string,
    @Body() body: UpsertLocationMappingDto,
  ) {
    const existing = await this.inventory.findLocationMapping(
      connectionId,
      body.sourceLocationId,
    );
    const mapping =
      existing ??
      this.inventory.createMapping({
        tenantId: req.tenantId,
        connectionId,
        sourceLocationId: body.sourceLocationId,
      });
    mapping.vendorLocationId = body.vendorLocationId;
    mapping.isActive = body.isActive ?? true;
    return this.inventory.saveMapping(mapping);
  }
}

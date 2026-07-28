import {
  Body,
  Controller,
  Get,
  Inject,
  NotFoundException,
  Param,
  Post,
  Put,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { TenantMembershipGuard } from '../auth/guards/tenant-membership.guard';
import { UserRole } from '../../domain/enums/user-role.enum';
import {
  CreateSyncBatchDto,
  ListProductsDto,
  UpdateSyncSettingsDto,
} from './sync.dtos';
import {
  CreateSyncBatchUseCase,
  GetProductsUseCase,
  GetProductSourcesUseCase,
  QueueStoreReconciliationUseCase,
  UpdateSyncSettingsUseCase,
} from './sync.use-cases';
import { ISyncRepository } from './repositories/sync.repositories';

interface TenantRequest {
  tenantId: string;
  user: { id: string; role: UserRole };
}

@Controller('tenant/:tenantId')
@UseGuards(JwtAuthGuard, TenantMembershipGuard)
export class SyncController {
  constructor(
    private readonly getProducts: GetProductsUseCase,
    private readonly getProductSources: GetProductSourcesUseCase,
    private readonly createBatch: CreateSyncBatchUseCase,
    private readonly reconciliation: QueueStoreReconciliationUseCase,
    private readonly settings: UpdateSyncSettingsUseCase,
    @Inject(ISyncRepository) private readonly syncRepository: ISyncRepository,
  ) {}

  @Get('product-sources')
  sources(@Req() req: TenantRequest) {
    return this.getProductSources.execute(req.tenantId);
  }

  @Get('products')
  async products(@Req() req: TenantRequest, @Query() query: ListProductsDto) {
    const result = await this.getProducts.execute(req.tenantId, query);
    return {
      ...result,
      pagination: {
        page: query.page,
        perPage: query.perPage,
        total: result.total,
        totalPages: Math.max(1, Math.ceil(result.total / query.perPage)),
      },
    };
  }

  @Post('product-sources/:sourceStoreId/refresh')
  refreshSource(
    @Req() req: TenantRequest,
    @Param('sourceStoreId') sourceStoreId: string,
  ) {
    return this.reconciliation.execute(
      req.tenantId,
      sourceStoreId,
      req.user.role,
    );
  }

  @Post('sync-batches')
  sync(@Req() req: TenantRequest, @Body() body: CreateSyncBatchDto) {
    return this.createBatch.execute({
      tenantId: req.tenantId,
      userId: req.user.id,
      userRole: req.user.role,
      ...body,
    });
  }

  @Get('sync-batches/active')
  activeBatch(
    @Req() req: TenantRequest,
    @Query('sourceStoreId') sourceStoreId: string,
  ) {
    return this.syncRepository.findActiveBatch(req.tenantId, sourceStoreId);
  }

  @Get('initial-sync/active')
  activeInitialSync(
    @Req() req: TenantRequest,
    @Query('storeId') storeId: string,
  ) {
    return this.syncRepository.findActiveInitialSyncJob(req.tenantId, storeId);
  }

  @Get('sync-batches/:batchId')
  async batch(@Req() req: TenantRequest, @Param('batchId') batchId: string) {
    const batch = await this.syncRepository.findBatch(req.tenantId, batchId);
    if (!batch) throw new NotFoundException('Batch no encontrado.');
    return batch;
  }

  @Get('sync-settings')
  globalSettings(@Req() req: TenantRequest) {
    return this.settings.get(req.tenantId, null);
  }

  @Put('sync-settings')
  updateGlobalSettings(
    @Req() req: TenantRequest,
    @Body() body: UpdateSyncSettingsDto,
  ) {
    return this.settings.execute(req.tenantId, null, body);
  }

  @Get('connections/:connectionId/sync-settings')
  connectionSettings(
    @Req() req: TenantRequest,
    @Param('connectionId') connectionId: string,
  ) {
    return this.settings.get(req.tenantId, connectionId);
  }

  @Put('connections/:connectionId/sync-settings')
  updateConnectionSettings(
    @Req() req: TenantRequest,
    @Param('connectionId') connectionId: string,
    @Body() body: UpdateSyncSettingsDto,
  ) {
    return this.settings.execute(req.tenantId, connectionId, body);
  }
}

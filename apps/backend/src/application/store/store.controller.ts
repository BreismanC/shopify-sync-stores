import {
  Controller,
  Get,
  Inject,
  NotFoundException,
  Query,
  Req,
  UseGuards,
  Post,
  Body,
  Delete,
  Param,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { IStoreRepository } from './repositories/IStoreRepository';
import { ListStoresDto } from './dtos/list-stores.dto';
import { StoreConnectionService } from './store-connection.service';
import {
  ConnectByStoreKeyDto,
  SendStoreKeyEmailDto,
} from './dtos/connect-by-store-key.dto';
import { User } from '../../domain/entities/user.entity';

interface RequestWithUser extends Request {
  user: User;
}

function pickSafeStore(store: any) {
  if (!store) return store;
  const { accessToken, ...safe } = store;
  return safe;
}

@Controller('stores')
@UseGuards(JwtAuthGuard)
export class StoreController {
  constructor(
    @Inject(IStoreRepository)
    private readonly storeRepository: IStoreRepository,
    private readonly connectionService: StoreConnectionService,
  ) {}

  @Get('me')
  async getMyStore(@Req() req: RequestWithUser) {
    const tenantId = req.user?.tenantId;
    if (!tenantId) {
      throw new NotFoundException({
        code: 'STORE_NOT_FOUND',
        message: 'No hay un tenant activo asociado al usuario.',
      });
    }

    const stores = await this.storeRepository.findByTenantId(tenantId);
    const store = stores[0];
    if (!store) {
      throw new NotFoundException({
        code: 'STORE_NOT_FOUND',
        message: 'El tenant no tiene una tienda conectada.',
      });
    }

    return { store: pickSafeStore(store) };
  }

  @Get()
  async listStores(@Req() req: RequestWithUser, @Query() query: ListStoresDto) {
    const tenantId = req.user?.tenantId;
    if (!tenantId) {
      throw new NotFoundException({
        code: 'TENANT_NOT_FOUND',
        message: 'No hay tenant activo.',
      });
    }

    const page = query.page ?? 1;
    const perPage = query.perPage ?? 10;
    const sortBy = query.sortBy ?? 'createdAt';
    const order = query.order ?? 'desc';

    const { data, total } = await this.storeRepository.findByTenantIdPaginated(
      tenantId,
      {
        search: query.search,
        page,
        perPage,
        sortBy,
        order,
      },
    );

    const totalPages = Math.ceil(total / perPage) || 1;

    return {
      data: data.map((s) => pickSafeStore(s)),
      pagination: {
        total,
        page,
        perPage,
        lastPage: totalPages,
        totalPages,
      },
    };
  }

  @Get('connections')
  async listConnections(
    @Req() req: RequestWithUser,
    @Query() query: ListStoresDto,
  ) {
    const page = query.page ?? 1;
    const perPage = query.perPage ?? 10;
    const sortBy =
      (query.sortBy as 'connectedAt' | 'isActive') ?? 'connectedAt';
    const order = query.order ?? 'desc';

    return this.connectionService.listConnections(req.user?.tenantId, {
      search: query.search,
      page,
      perPage,
      sortBy,
      order,
    });
  }

  @Post('connections')
  @HttpCode(HttpStatus.CREATED)
  async connect(
    @Req() req: RequestWithUser,
    @Body() body: ConnectByStoreKeyDto,
  ) {
    const result = await this.connectionService.connectByStoreKey(
      req.user,
      body.storeKey,
    );
    return {
      connection: result.connection,
      store: result.store,
    };
  }

  @Post('connections/email')
  @HttpCode(HttpStatus.OK)
  async sendKey(
    @Req() req: RequestWithUser,
    @Body() body: SendStoreKeyEmailDto,
  ) {
    return this.connectionService.sendStoreKeyByEmail(req.user, body.email);
  }

  @Delete('connections/:connectionId')
  @HttpCode(HttpStatus.OK)
  async disconnect(
    @Req() req: RequestWithUser,
    @Param('connectionId') connectionId: string,
  ) {
    return this.connectionService.disconnect(req.user, connectionId);
  }
}

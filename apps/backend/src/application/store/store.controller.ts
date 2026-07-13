import {
  Controller,
  Get,
  Inject,
  NotFoundException,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { IStoreRepository } from './repositories/IStoreRepository';
import { ListStoresDto } from './dtos/list-stores.dto';

interface RequestWithUser extends Request {
  user: {
    id: string;
    tenantId?: string | null;
    [key: string]: any;
  };
}

/**
 * Endpoints del dashboard para acceder a la tienda del tenant actual.
 *
 * - GET /api/stores/me: devuelve la tienda activa del tenant del usuario.
 *   Si el tenant no tiene tienda, responde **404** para que el frontend
 *   redirija al usuario a /unauthorized?reason=store-not-found.
 *
 * - GET /api/stores: lista paginada server-side de las tiendas conectadas
 *   del tenant autenticado, con búsqueda y ordenamiento.
 *
 * Diferencia con GET /api/onboarding/store/status (que devuelve
 * `{ store: null }`): este endpoint está pensado para rutas donde
 * la tienda YA DEBE existir (dashboard, products, etc.), no durante
 * el onboarding.
 */
@Controller('stores')
@UseGuards(JwtAuthGuard)
export class StoreController {
  constructor(
    @Inject(IStoreRepository)
    private readonly storeRepository: IStoreRepository,
  ) {}

  @Get('me')
  async getMyStore(@Req() req: RequestWithUser) {
    const tenantId = req.user.tenantId;
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

    return { store };
  }

  @Get()
  async listStores(
    @Req() req: RequestWithUser,
    @Query() query: ListStoresDto,
  ) {
    const tenantId = req.user.tenantId;
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

    const totalPages = Math.ceil(total / perPage);

    return {
      data,
      pagination: {
        total,
        page,
        perPage,
        lastPage: totalPages,
        totalPages,
      },
    };
  }
}

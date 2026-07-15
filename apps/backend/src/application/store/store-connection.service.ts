import {
  Injectable,
  Inject,
  NotFoundException,
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { Store } from '../../domain/entities/store.entity';
import { StoreConnection } from '../../domain/entities/store-connection.entity';
import { StoreRole } from '../../domain/enums/store-role.enum';
import { UserRole } from '../../domain/enums/user-role.enum';
import { User } from '../../domain/entities/user.entity';
import { IStoreRepository } from './repositories/IStoreRepository';
import {
  IStoreConnectionRepository,
  ListConnectionsOptions,
  StoreConnectionListItem,
} from './repositories/IStoreConnectionRepository';
import { EmailService } from '../../infrastructure/services/email/resend.service';

export interface ConnectByStoreKeyInput {
  storeKey: string;
}

export interface StoreConnectionView {
  id: string;
  sourceStoreId: string;
  vendorStoreId: string;
  isActive: boolean;
  connectedAt: Date;
  disconnectedAt: Date | null;
}

export interface StoreConnectionCreatedResult {
  connection: StoreConnectionView;
  store: {
    id: string;
    shopifyShopId: string;
    role: StoreRole;
    storeKey: string | null;
    isActive: boolean;
    tenantId: string;
  };
}

export interface SendStoreKeyEmailInput {
  email: string;
}

export interface CurrentStoreView {
  id: string;
  shopifyShopId: string;
  role: StoreRole;
  isActive: boolean;
  storeKey: string | null;
  tenantId: string;
  createdAt: Date;
  updatedAt: Date;
}

@Injectable()
export class StoreConnectionService {
  private readonly logger = new Logger(StoreConnectionService.name);

  constructor(
    @Inject(IStoreRepository)
    private readonly storeRepository: IStoreRepository,
    @Inject('ISTORE_CONNECTION_REPOSITORY')
    private readonly connectionRepository: IStoreConnectionRepository,
    private readonly emailService: EmailService,
  ) {}

  async getCurrentStore(tenantId: string | null | undefined): Promise<Store> {
    if (!tenantId) {
      throw new NotFoundException({
        code: 'STORE_NOT_FOUND',
        message: 'No hay tenant activo asociado al usuario.',
      });
    }
    const stores = await this.storeRepository.findByTenantId(tenantId);
    if (stores.length === 0) {
      throw new NotFoundException({
        code: 'STORE_NOT_FOUND',
        message: 'El tenant no tiene una tienda conectada.',
      });
    }
    return stores[0];
  }

  async listConnections(
    tenantId: string | null | undefined,
    options: ListConnectionsOptions,
  ): Promise<{
    data: StoreConnectionListItem[];
    pagination: {
      total: number;
      page: number;
      perPage: number;
      lastPage: number;
      totalPages: number;
    };
  }> {
    const current = await this.getCurrentStore(tenantId);
    const { data, total } =
      await this.connectionRepository.findConnectedByStore(current.id, options);
    return {
      data,
      pagination: {
        total,
        page: options.page,
        perPage: options.perPage,
        lastPage: Math.ceil(total / options.perPage) || 1,
        totalPages: Math.ceil(total / options.perPage) || 1,
      },
    };
  }

  async connectByStoreKey(
    user: User,
    storeKey: string,
  ): Promise<StoreConnectionCreatedResult> {
    this.assertCanManage(user);

    if (!user.tenantId) {
      throw new BadRequestException({
        code: 'TENANT_REQUIRED',
        message: 'El usuario no pertenece a un tenant activo.',
      });
    }

    const current = await this.getCurrentStore(user.tenantId);

    const normalizedKey = (storeKey ?? '').trim().toUpperCase();
    if (!normalizedKey) {
      throw new BadRequestException({
        code: 'STORE_KEY_REQUIRED',
        message: 'El storeKey es requerido.',
      });
    }

    const target = await this.storeRepository.findByStoreKey(normalizedKey);
    if (!target) {
      throw new NotFoundException({
        code: 'STORE_KEY_NOT_FOUND',
        message: 'No existe una tienda con esa clave.',
      });
    }

    if (target.id === current.id) {
      throw new BadRequestException({
        code: 'SELF_CONNECTION',
        message: 'No podés conectar tu propia tienda.',
      });
    }

    if (target.tenantId === current.tenantId) {
      throw new BadRequestException({
        code: 'SAME_TENANT',
        message: 'La tienda destino pertenece al mismo tenant.',
      });
    }

    if (current.role === target.role) {
      const code =
        current.role === StoreRole.SOURCE
          ? 'SOURCE_SOURCE_NOT_ALLOWED'
          : 'VENDOR_VENDOR_NOT_ALLOWED';
      throw new BadRequestException({
        code,
        message: 'Ambas tiendas tienen el mismo rol.',
      });
    }

    const sourceStoreId =
      current.role === StoreRole.SOURCE ? current.id : target.id;
    const vendorStoreId =
      current.role === StoreRole.VENDOR ? current.id : target.id;
    const initiatedByStoreId = current.id;

    const existing = await this.connectionRepository.findPair(
      sourceStoreId,
      vendorStoreId,
    );

    if (existing && existing.isActive) {
      throw new ConflictException({
        code: 'CONNECTION_ALREADY_EXISTS',
        message: 'Ya existe una conexión activa entre estas tiendas.',
      });
    }

    let connection: StoreConnection;
    if (existing) {
      existing.isActive = true;
      existing.connectedAt = new Date();
      existing.disconnectedAt = null;
      existing.initiatedByStoreId = initiatedByStoreId;
      existing.initiatedByUserId = user.id;
      connection = await this.connectionRepository.save(existing);
    } else {
      const created = this.connectionRepository.create({
        sourceStoreId,
        vendorStoreId,
        initiatedByStoreId,
        initiatedByUserId: user.id,
        isActive: true,
        connectedAt: new Date(),
        disconnectedAt: null,
      });
      connection = await this.connectionRepository.save(created);
    }

    return {
      connection: this.toConnectionView(connection),
      store: this.toStoreView(target),
    };
  }

  async sendStoreKeyByEmail(
    user: User,
    email: string,
  ): Promise<{ message: string }> {
    this.assertCanManage(user);

    const current = await this.getCurrentStore(user.tenantId);

    if (!current.storeKey) {
      throw new BadRequestException({
        code: 'STORE_KEY_MISSING',
        message: 'La tienda actual aún no tiene un storeKey asignado.',
      });
    }

    await this.emailService.sendStoreConnectionKeyEmail({
      to: email,
      senderName: user.name ?? user.email,
      role: current.role,
      shopifyShopId: current.shopifyShopId,
      storeKey: current.storeKey,
    });

    return { message: 'Store key enviada correctamente.' };
  }

  async disconnect(
    user: User,
    connectionId: string,
  ): Promise<{ connection: StoreConnectionView }> {
    this.assertCanManage(user);

    const current = await this.getCurrentStore(user.tenantId);

    const connection = await this.connectionRepository.findAccessibleByStore(
      current.id,
      connectionId,
    );
    if (!connection) {
      throw new NotFoundException({
        code: 'CONNECTION_NOT_FOUND',
        message: 'Conexión no encontrada o no accesible.',
      });
    }

    if (!connection.isActive) {
      throw new ConflictException({
        code: 'CONNECTION_ALREADY_DISCONNECTED',
        message: 'La conexión ya está inactiva.',
      });
    }

    connection.isActive = false;
    connection.disconnectedAt = new Date();
    const saved = await this.connectionRepository.save(connection);

    return { connection: this.toConnectionView(saved) };
  }

  async hasActiveConnection(
    storeId: string,
    connectionId: string,
  ): Promise<boolean> {
    return this.connectionRepository.hasActiveConnection(storeId, connectionId);
  }

  private assertCanManage(user: User) {
    if (!user) {
      throw new ForbiddenException({
        code: 'FORBIDDEN',
        message: 'Acción no autorizada.',
      });
    }
    if (user.role !== UserRole.OWNER && user.role !== UserRole.ADMIN) {
      throw new ForbiddenException({
        code: 'FORBIDDEN',
        message: 'Solo OWNER y ADMIN pueden gestionar conexiones.',
      });
    }
  }

  private toConnectionView(c: StoreConnection): StoreConnectionView {
    return {
      id: c.id,
      sourceStoreId: c.sourceStoreId,
      vendorStoreId: c.vendorStoreId,
      isActive: c.isActive,
      connectedAt: c.connectedAt,
      disconnectedAt: c.disconnectedAt,
    };
  }

  private toStoreView(s: Store) {
    return {
      id: s.id,
      shopifyShopId: s.shopifyShopId,
      role: s.role,
      storeKey: s.storeKey,
      isActive: s.isActive,
      tenantId: s.tenantId,
    };
  }
}

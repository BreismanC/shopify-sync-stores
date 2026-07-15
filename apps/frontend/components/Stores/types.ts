export interface PaginationMeta {
  total: number;
  page: number;
  perPage: number;
  lastPage: number;
  totalPages: number;
}

export interface ConnectionRow {
  id: string;
  storeId: string;
  shopifyShopId: string;
  role: 'SOURCE' | 'VENDOR';
  isActive: boolean;
  connectedAt: string;
}

export interface StoreConnectionListResponse {
  data: ConnectionRow[];
  pagination: PaginationMeta;
}

export interface StoreConnectionCreateResponse {
  connection: ConnectionRow;
  store: {
    id: string;
    shopifyShopId: string;
    role: 'SOURCE' | 'VENDOR';
    isActive: boolean;
    storeKey: string;
  };
}

export interface InviteByEmailResponse {
  message: string;
}

export type StoreRole = 'SOURCE' | 'VENDOR';

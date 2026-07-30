export interface PaginationMeta {
  total: number;
  page: number;
  perPage: number;
  lastPage?: number;
  totalPages: number;
}

export type OrderPushStatus = 'PUSHED' | 'NOT_PUSHED';

export interface OrderPayout {
  id: string;
  grossAmount: string;
  commissionAmount: string;
  netAmount: string;
  currency: string;
  status: 'PENDING' | 'PAID' | string;
  paidAt: string | null;
}

export interface OrderRow {
  id: string;
  connectionId: string;
  vendorStoreId: string;
  sourceStoreId: string;
  vendorShopifyOrderId: string;
  sourceShopifyOrderId: string | null;
  status: string;
  pushStatus?: OrderPushStatus;
  customerName?: string | null;
  itemCount?: number;
  currency: string | null;
  subtotal: string;
  payload?: Record<string, unknown>;
  lastError?: string | null;
  createdAt: string;
  updatedAt: string;
  payout: OrderPayout | null;
}

export interface OrderListResponse {
  data: OrderRow[];
  pagination: PaginationMeta;
}

export interface OrderDetailItem {
  id: string;
  vendorLineItemId: string;
  sourceVariantId: string;
  sourceLineItemId: string | null;
  quantity: number;
  unitPrice: string;
  title: string | null;
  sku: string | null;
  image: string | null;
}

export interface OrderDetailPayout {
  id: string;
  grossAmount: string;
  commissionAmount: string;
  netAmount: string;
  currency: string;
  status: 'PENDING' | 'PAID' | string;
  paidAt: string | null;
}

export interface OrderDetailCustomer {
  name: string | null;
  email: string | null;
  contactEmail: string | null;
  shippingAddress: string | null;
  billingAddress: string | null;
}

export interface OrderDetail {
  id: string;
  status: string;
  currency: string | null;
  subtotal: string;
  payload: Record<string, unknown>;
  lastError: string | null;
  vendorShopifyOrderId: string;
  sourceShopifyOrderId: string | null;
  sourceStoreId: string;
  sourceStoreDomain: string | null;
  vendorStoreId: string;
  vendorStoreDomain: string | null;
  connectionId: string;
  payout: OrderDetailPayout | null;
  customer: OrderDetailCustomer;
  items: OrderDetailItem[];
  createdAt: string;
  updatedAt: string;
}

export interface OrderPushResult {
  sourceShopifyOrderId: string | null;
  status: 'CREATED' | 'ALREADY_PUSHED';
}

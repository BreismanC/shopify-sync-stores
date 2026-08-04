import { asScalarString } from '../common/scalar';

const SHOPIFY_PRODUCT_STATUSES = new Set(['ACTIVE', 'DRAFT', 'ARCHIVED']);

export function sourcePublicationStatus(status: unknown) {
  const normalized = asScalarString(status, 'DRAFT').toUpperCase();
  return SHOPIFY_PRODUCT_STATUSES.has(normalized) ? normalized : 'DRAFT';
}

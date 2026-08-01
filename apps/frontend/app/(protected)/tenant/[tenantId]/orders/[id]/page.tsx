import { auth } from '@/auth';
import { redirect } from 'next/navigation';
import OrderDetailClient from '../../../../orders/[id]/order-detail-client';

interface OrderDetailTenantPageProps {
  params: Promise<{ tenantId: string; id: string }>;
}

export default async function OrderDetailTenantPage({
  params,
}: OrderDetailTenantPageProps) {
  const session = await auth();
  const { id, tenantId } = await params;

  if (!session?.user?.tenantId) {
    redirect('/auth/login');
  }

  return <OrderDetailClient orderId={id} tenantId={tenantId} />;
}

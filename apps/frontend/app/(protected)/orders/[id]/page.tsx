import { auth } from '@/auth';
import { redirect } from 'next/navigation';
import OrderDetailClient from './order-detail-client';

interface OrderDetailPageProps {
  params: Promise<{ id: string }>;
}

export default async function OrderDetailPage({ params }: OrderDetailPageProps) {
  const session = await auth();
  const { id } = await params;
  const tenantId = session?.user?.tenantId;

  if (!tenantId) {
    redirect('/auth/login');
  }

  return <OrderDetailClient orderId={id} tenantId={tenantId} />;
}

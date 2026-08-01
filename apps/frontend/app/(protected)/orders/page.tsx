import { auth } from '@/auth';
import OrdersClient from './orders-client';
import { redirect } from 'next/navigation';

export default async function OrdersPage() {
  const session = await auth();
  const tenantId = session?.user.tenantId;

  if (!tenantId) {
    redirect('/auth/login');
  }

  return <OrdersClient tenantId={tenantId} />;
}

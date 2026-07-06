import { APIGatewayProxyResult } from 'aws-lambda';
import { initializeDatabase } from '../shared/initialize';
import { createSubscriptionRepository } from '@shopify-sync/database';
import { SubscriptionStatus } from '@shopify-sync/database';

export async function handler(): Promise<APIGatewayProxyResult> {
  console.log('[CheckPendingPayments] Starting...');

  try {
    await initializeDatabase();
    const repo = await createSubscriptionRepository();

    // Find PENDING_PAYMENT subscriptions older than 48 hours
    const pendingPayments = await repo.findPendingPayment(48);
    console.log(`[CheckPendingPayments] Found ${pendingPayments.length} pending payments older than 48h`);

    const now = new Date();
    let notifiedCount = 0;

    for (const subscription of pendingPayments) {
      // Check if pending for more than 7 days → mark as EXPIRED
      const createdAt = new Date(subscription.createdAt);
      const daysDiff = (now.getTime() - createdAt.getTime()) / (1000 * 60 * 60 * 24);

      if (daysDiff > 7) {
        await repo.updateStatus(subscription.id, SubscriptionStatus.EXPIRED);
        console.log(`[CheckPendingPayments] Subscription ${subscription.id} marked EXPIRED (pending > 7 days)`);
      } else {
        // TODO: Send email notification to user
        console.log(`[CheckPendingPayments] Subscription ${subscription.id} pending (${Math.floor(daysDiff)} days)`);
      }
      notifiedCount++;
    }

    return {
      statusCode: 200,
      body: JSON.stringify({
        success: true,
        message: 'Pending payments check completed',
        processedCount: notifiedCount,
        timestamp: now.toISOString(),
      }),
    };
  } catch (error) {
    console.error('[CheckPendingPayments] Error:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({
        success: false,
        message: 'Error checking pending payments',
        error: error instanceof Error ? error.message : 'Unknown error',
      }),
    };
  }
}

export default handler;
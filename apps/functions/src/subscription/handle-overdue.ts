import { APIGatewayProxyResult } from 'aws-lambda';
import { initializeDatabase } from '../shared/initialize';
import { createSubscriptionRepository } from '@shopify-sync/database';
import { SubscriptionStatus } from '@shopify-sync/database';

export async function handler(): Promise<APIGatewayProxyResult> {
  console.log('[HandleOverdue] Starting...');

  try {
    await initializeDatabase();
    const repo = await createSubscriptionRepository();

    // Find overdue subscriptions (SUSPENDED)
    const overdueSubscriptions = await repo.findOverdue(0);
    console.log(`[HandleOverdue] Found ${overdueSubscriptions.length} suspended subscriptions`);

    const now = new Date();
    let processedCount = 0;

    for (const subscription of overdueSubscriptions) {
      // Get the date when subscription was suspended (using updatedAt)
      const updatedAt = new Date(subscription.updatedAt);
      const daysSuspended = (now.getTime() - updatedAt.getTime()) / (1000 * 60 * 60 * 24);

      if (daysSuspended >= 90) {
        // After 90 days suspended → mark as CANCELED
        await repo.updateStatus(subscription.id, SubscriptionStatus.CANCELED);
        console.log(`[HandleOverdue] Subscription ${subscription.id} CANCELED (90+ days overdue)`);
      } else if (daysSuspended >= 7) {
        // After 7 days suspended → notify user
        // TODO: Send overdue notification email
        console.log(`[HandleOverdue] Subscription ${subscription.id} overdue notice (${Math.floor(daysSuspended)} days suspended)`);
      }

      processedCount++;
    }

    return {
      statusCode: 200,
      body: JSON.stringify({
        success: true,
        message: 'Overdue payments handling completed',
        processedCount,
        timestamp: now.toISOString(),
      }),
    };
  } catch (error) {
    console.error('[HandleOverdue] Error:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({
        success: false,
        message: 'Error handling overdue payments',
        error: error instanceof Error ? error.message : 'Unknown error',
      }),
    };
  }
}

export default handler;
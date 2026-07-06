import { APIGatewayProxyResult } from 'aws-lambda';
import { initializeDatabase } from '../shared/initialize';
import { createSubscriptionRepository } from '@shopify-sync/database';
import { SubscriptionStatus } from '@shopify-sync/database';

export async function handler(): Promise<APIGatewayProxyResult> {
  console.log('[CheckUpcomingBilling] Starting...');

  try {
    await initializeDatabase();
    const repo = await createSubscriptionRepository();

    // Find subscriptions with nextBillingDate in the next 3 days
    const threeDaysFromNow = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000);
    const upcoming = await repo.findByNextBillingDate(threeDaysFromNow);
    console.log(`[CheckUpcomingBilling] Found ${upcoming.length} subscriptions with upcoming billing in 3 days`);

    const now = new Date();
    let notifiedCount = 0;

    for (const subscription of upcoming) {
      // TODO: Send email reminder to user
      console.log(`[CheckUpcomingBilling] Billing reminder for subscription ${subscription.id} (tenant: ${subscription.tenantId}, nextBilling: ${subscription.nextBillingDate})`);
      notifiedCount++;
    }

    return {
      statusCode: 200,
      body: JSON.stringify({
        success: true,
        message: 'Upcoming billing check completed',
        reminderCount: notifiedCount,
        timestamp: now.toISOString(),
      }),
    };
  } catch (error) {
    console.error('[CheckUpcomingBilling] Error:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({
        success: false,
        message: 'Error checking upcoming billing',
        error: error instanceof Error ? error.message : 'Unknown error',
      }),
    };
  }
}

export default handler;
import { APIGatewayProxyResult } from 'aws-lambda';
import { initializeDatabase } from '../shared/initialize';
import { createSubscriptionRepository } from '@shopify-sync/database';
import { SubscriptionStatus, SubscriptionPlan } from '@shopify-sync/database';
import { MoreThan } from 'typeorm';

export async function handler(): Promise<APIGatewayProxyResult> {
  console.log('[CheckExpirations] Starting...');

  try {
    await initializeDatabase();
    const repo = await createSubscriptionRepository();
    const now = new Date();

    // Find expired trials: trialEndDate < now AND status = ACTIVE AND planType = TRIAL
    const expiredTrials = await repo.findExpired(now);
    console.log(`[CheckExpirations] Found ${expiredTrials.length} expired trials`);

    let updatedCount = 0;
    for (const subscription of expiredTrials) {
      await repo.updateStatus(subscription.id, SubscriptionStatus.EXPIRED);
      console.log(`[CheckExpirations] Marked subscription ${subscription.id} as EXPIRED (tenant: ${subscription.tenantId})`);
      updatedCount++;
    }

    return {
      statusCode: 200,
      body: JSON.stringify({
        success: true,
        message: 'Expiration check completed',
        expiredCount: updatedCount,
        timestamp: now.toISOString(),
      }),
    };
  } catch (error) {
    console.error('[CheckExpirations] Error:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({
        success: false,
        message: 'Error checking expirations',
        error: error instanceof Error ? error.message : 'Unknown error',
      }),
    };
  }
}

export default handler;
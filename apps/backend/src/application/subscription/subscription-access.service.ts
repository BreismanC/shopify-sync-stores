import { Injectable } from '@nestjs/common';
import { ISubscriptionRepository } from './repositories/ISubscriptionRepository';
import { SubscriptionPlan } from '../../domain/enums/subscription-plan.enum';

export enum FeatureKey {
  CAN_SYNC_INVENTORY = 'canSyncInventory',
  CAN_SYNC_ORDERS = 'canSyncOrders',
  CAN_ACCESS_MARKETPLACE = 'canAccessMarketplace',
  CAN_INVITE_TEAM = 'canInviteTeam',
}

export interface PlanLimits {
  maxConnections: number;
  maxStores: number;
  maxTeamMembers: number;
  canSyncInventory: boolean;
  canSyncOrders: boolean;
  canAccessMarketplace: boolean;
  canInviteTeam: boolean;
}

@Injectable()
export class SubscriptionAccessService {
  private readonly limits: Record<SubscriptionPlan, PlanLimits> = {
    [SubscriptionPlan.TRIAL]: {
      maxConnections: 1,
      maxStores: 1,
      maxTeamMembers: 0,
      canSyncInventory: false,
      canSyncOrders: false,
      canAccessMarketplace: false,
      canInviteTeam: false,
    },
    [SubscriptionPlan.BASIC]: {
      maxConnections: 3,
      maxStores: 2,
      maxTeamMembers: 3,
      canSyncInventory: true,
      canSyncOrders: false,
      canAccessMarketplace: false,
      canInviteTeam: true,
    },
    [SubscriptionPlan.PRO]: {
      maxConnections: 10,
      maxStores: 5,
      maxTeamMembers: 10,
      canSyncInventory: true,
      canSyncOrders: true,
      canAccessMarketplace: true,
      canInviteTeam: true,
    },
    [SubscriptionPlan.ENTERPRISE]: {
      maxConnections: -1, // unlimited
      maxStores: -1,
      maxTeamMembers: -1,
      canSyncInventory: true,
      canSyncOrders: true,
      canAccessMarketplace: true,
      canInviteTeam: true,
    },
  };

  constructor(
    private readonly subscriptionRepository: ISubscriptionRepository,
  ) {}

  async getPlanLimits(tenantId: string): Promise<PlanLimits> {
    const subscription =
      await this.subscriptionRepository.findByTenantId(tenantId);
    if (!subscription) {
      // Default: TRIAL limits si no hay suscripción
      return this.limits[SubscriptionPlan.TRIAL];
    }
    return this.limits[subscription.planType];
  }

  async canAccessFeature(
    tenantId: string,
    feature: FeatureKey,
  ): Promise<boolean> {
    const limits = await this.getPlanLimits(tenantId);
    const value = limits[feature];
    return value === true;
  }

  async canAddConnection(
    tenantId: string,
    currentCount: number,
  ): Promise<boolean> {
    const limits = await this.getPlanLimits(tenantId);
    if (limits.maxConnections === -1) return true;
    return currentCount < limits.maxConnections;
  }

  async canAddStore(tenantId: string, currentCount: number): Promise<boolean> {
    const limits = await this.getPlanLimits(tenantId);
    if (limits.maxStores === -1) return true;
    return currentCount < limits.maxStores;
  }

  async canAddTeamMember(
    tenantId: string,
    currentCount: number,
  ): Promise<boolean> {
    const limits = await this.getPlanLimits(tenantId);
    if (limits.maxTeamMembers === -1) return true;
    return currentCount < limits.maxTeamMembers;
  }

  async getRemainingConnections(
    tenantId: string,
    currentCount: number,
  ): Promise<number> {
    const limits = await this.getPlanLimits(tenantId);
    if (limits.maxConnections === -1) return -1; // unlimited
    return Math.max(0, limits.maxConnections - currentCount);
  }
}

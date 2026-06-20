import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
} from 'typeorm';
import { Tenant } from './tenant.entity';
import { SubscriptionPlan } from '../enums/subscription-plan.enum';
import { SubscriptionStatus } from '../enums/subscription-status.enum';
import { BillingPeriod } from '../enums/billing-period.enum';

@Entity('subscriptions')
export class Subscription {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Tenant)
  tenant: Tenant;

  @Column()
  tenantId: string;

  @Column({
    type: 'enum',
    enum: SubscriptionPlan,
  })
  planType: SubscriptionPlan;

  @Column({
    type: 'enum',
    enum: SubscriptionStatus,
    default: SubscriptionStatus.ACTIVE,
  })
  status: SubscriptionStatus;

  @CreateDateColumn()
  startDate: Date;

  @Column({ type: 'timestamp', nullable: true })
  trialEndDate: Date;

  // === CAMPOS NUEVOS PARA MERCADOPAGO ===
  @Column({ nullable: true })
  externalSubscriptionId: string;

  @Column({ nullable: true })
  externalPlanId: string;

  @Column({
    type: 'enum',
    enum: BillingPeriod,
    default: BillingPeriod.MONTHLY,
  })
  billingPeriod: BillingPeriod;

  @Column({ default: false })
  autoRecurrent: boolean;

  @Column({ type: 'timestamptz', nullable: true })
  lastBillingDate: Date;

  @Column({ type: 'timestamptz', nullable: true })
  nextBillingDate: Date;

  @Column({ nullable: true })
  paymentMethodId: string;

  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
  amountPaid: number;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
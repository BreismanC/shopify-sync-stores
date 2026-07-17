import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { TenantStatus } from '../enums/tenant-status.enum';
import { OnboardingStatus } from '../enums/onboarding-status.enum';

@Entity('tenants')
export class Tenant {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  name: string;

  @Column({
    type: 'enum',
    enum: TenantStatus,
    default: TenantStatus.ACTIVE,
  })
  status: TenantStatus;

  @Column({
    type: 'enum',
    enum: OnboardingStatus,
    default: OnboardingStatus.PENDING_TENANT_CONFIG,
  })
  onboardingStatus: OnboardingStatus;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}

import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
  UpdateDateColumn,
} from "typeorm";
import { Tenant } from "./tenant.entity";
import { User } from "./user.entity";
import { UserRole } from "../enums/user-role.enum";
import { MembershipStatus } from "../enums/membership-status.enum";

@Entity("tenant_memberships")
@Unique("UQ_tenant_memberships_user_tenant", ["userId", "tenantId"])
@Index("IDX_tenant_memberships_user_status", ["userId", "status"])
@Index("IDX_tenant_memberships_tenant_status", ["tenantId", "status"])
export class TenantMembership {
  @PrimaryGeneratedColumn("uuid")
  id: string;
  @ManyToOne(() => User, { onDelete: "CASCADE" })
  @JoinColumn({ name: "userId" })
  user: User;
  @Column("uuid")
  userId: string;
  @ManyToOne(() => Tenant, { onDelete: "CASCADE" })
  @JoinColumn({ name: "tenantId" })
  tenant: Tenant;
  @Column("uuid")
  tenantId: string;
  @Column({ type: "enum", enum: UserRole, default: UserRole.MEMBER })
  role: UserRole;
  @Column({
    type: "enum",
    enum: MembershipStatus,
    default: MembershipStatus.ACTIVE,
  })
  status: MembershipStatus;
  @CreateDateColumn()
  createdAt: Date;
  @UpdateDateColumn()
  updatedAt: Date;
}

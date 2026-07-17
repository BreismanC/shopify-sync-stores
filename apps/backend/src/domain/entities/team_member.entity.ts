import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  DeleteDateColumn,
  ManyToOne,
  Unique,
  Index,
} from 'typeorm';
import { User } from './user.entity';
import { Tenant } from './tenant.entity';

/**
 * TeamMember — asociación activa entre un User y un Tenant.
 * El user ya existe y aceptó la invitación.
 * Soft-delete vía `deletedAt` (revoke / remover del equipo).
 */
@Entity('team_members')
@Unique(['userId', 'tenantId'])
export class TeamMember {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => User)
  user: User;

  @Column()
  userId: string;

  @ManyToOne(() => Tenant)
  tenant: Tenant;

  @Column()
  tenantId: string;

  @Column()
  role: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @DeleteDateColumn({ nullable: true })
  deletedAt: Date | null;
}

export enum InvitationStatus {
  PENDING = 'PENDING',
  ACCEPTED = 'ACCEPTED',
  EXPIRED = 'EXPIRED',
  REVOKED = 'REVOKED',
}

/**
 * TeamInvitation — invitación pendiente a un tenant.
 * Contiene el token de aceptación (24h) y los datos del invitado.
 * NO requiere que el User exista: se crea con name+email y, al aceptar,
 * se crea el User (si no existe) y el TeamMember.
 */
@Entity('team_invitations')
@Index(['token'], { unique: true })
@Index(['tenantId', 'email'])
export class TeamInvitation {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Tenant)
  tenant: Tenant;

  @Column()
  tenantId: string;

  @Column()
  email: string;

  @Column()
  name: string;

  @Column()
  role: string;

  @Column({ unique: true })
  token: string;

  @Column({ type: 'timestamptz' })
  expiresAt: Date;

  @Column({
    type: 'enum',
    enum: InvitationStatus,
    default: InvitationStatus.PENDING,
  })
  status: InvitationStatus;

  @ManyToOne(() => User, { nullable: true })
  acceptedBy: User | null;

  @Column({ nullable: true })
  acceptedById: string | null;

  @Column({ type: 'timestamptz', nullable: true })
  acceptedAt: Date | null;

  @ManyToOne(() => User)
  invitedBy: User;

  @Column()
  invitedById: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}

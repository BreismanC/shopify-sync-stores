import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
} from 'typeorm';
import { Tenant } from './tenant.entity';
import { UserRole } from '../enums/user-role.enum';

@Entity('users')
export class User {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Tenant, { nullable: true })
  tenant: Tenant | null;

  @Column({ nullable: true })
  tenantId: string | null;

  @Column({ unique: true })
  email: string;

  @Column()
  name: string;

  @Column({ nullable: true })
  password: string;

  @Column({
    type: 'enum',
    enum: UserRole,
    default: UserRole.MEMBER,
  })
  role: UserRole;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}

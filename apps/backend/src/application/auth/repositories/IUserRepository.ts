import { User } from '../../../domain/entities/user.entity';

export const IUSER_REPOSITORY = 'IUSER_REPOSITORY';

export abstract class IUserRepository {
  abstract findByEmail(email: string): Promise<User | null>;
  abstract findById(id: string): Promise<User | null>;
  abstract findByTenantId(tenantId: string): Promise<User[]>;
  abstract save(user: User): Promise<User>;
  abstract create(user: Partial<User>): User;
  abstract updatePassword(email: string, password: string): Promise<void>;
}

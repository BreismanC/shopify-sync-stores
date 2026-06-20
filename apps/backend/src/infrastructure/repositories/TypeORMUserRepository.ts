import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../../domain/entities/user.entity';
import { IUserRepository } from '../../application/auth/repositories/IUserRepository';

@Injectable()
export class TypeORMUserRepository implements IUserRepository {
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
  ) {}

  async findByEmail(email: string): Promise<User | null> {
    return this.userRepository.findOne({ where: { email } });
  }

  async findById(id: string): Promise<User | null> {
    return this.userRepository.findOne({ where: { id } });
  }

  async findByTenantId(tenantId: string): Promise<User[]> {
    return this.userRepository.find({ where: { tenantId } });
  }

  async save(user: User): Promise<User> {
    return this.userRepository.save(user);
  }

  create(user: Partial<User>): User {
    return this.userRepository.create(user);
  }

  async updatePassword(email: string, password: string): Promise<void> {
    await this.userRepository.update({ email }, { password });
  }
}

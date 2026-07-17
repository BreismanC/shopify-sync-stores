import {
  Injectable,
  BadRequestException,
  ConflictException,
  NotFoundException,
  Inject,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomBytes } from 'crypto';
import {
  ITEAM_INVITATION_REPOSITORY,
  ITeamInvitationRepository,
} from './repositories/ITeamInvitationRepository';
import {
  IUSER_REPOSITORY,
  IUserRepository,
} from '../auth/repositories/IUserRepository';
import { ITenantRepository } from '../tenant/repositories/ITenantRepository';
import { ITeamMemberRepository } from '../team-member/repositories/ITeamMemberRepository';
import {
  TeamInvitation,
  InvitationStatus,
} from '../../domain/entities/team_member.entity';
import { UserRole } from '../../domain/enums/user-role.enum';
import { EmailService } from '../../infrastructure/services/email/resend.service';

export const INVITATION_TTL_HOURS = 24;

export interface CreateInvitationInput {
  email: string;
  name: string;
  role?: string;
}

export interface UpsertInvitationOptions {
  /** Si true, envía el email de invitación. Default false (solo agrega al equipo). */
  sendEmail?: boolean;
}

@Injectable()
export class TeamInvitationService {
  private readonly logger = new Logger(TeamInvitationService.name);
  private readonly frontendUrl: string;

  constructor(
    @Inject(ITEAM_INVITATION_REPOSITORY)
    private readonly invitationRepository: ITeamInvitationRepository,
    private readonly teamMemberRepository: ITeamMemberRepository,
    @Inject(IUSER_REPOSITORY)
    private readonly userRepository: IUserRepository,
    private readonly tenantRepository: ITenantRepository,
    private readonly emailService: EmailService,
    private readonly configService: ConfigService,
  ) {
    this.frontendUrl =
      this.configService.get<string>('FRONTEND_URL') || 'http://localhost:3000';
  }

  /**
   * Crea o reactiva una invitación PENDING para el tenant.
   * - Reutiliza filas REVOKED / EXPIRED / PENDING del mismo email (evita 409).
   * - Solo conflictúa si ya hay un TeamMember activo.
   * - Por defecto NO envía email (el owner usa "Enviar invitaciones").
   */
  async createAndSend(
    tenantId: string,
    invitedById: string,
    input: CreateInvitationInput,
    options: UpsertInvitationOptions = {},
  ): Promise<TeamInvitation> {
    const sendEmail = options.sendEmail === true;
    const email = input.email?.trim().toLowerCase();
    const name = input.name?.trim();
    const role = (input.role?.trim() || UserRole.MEMBER).toUpperCase();

    if (!email || !email.includes('@')) {
      throw new BadRequestException('Email inválido');
    }
    if (!name) {
      throw new BadRequestException('Nombre requerido');
    }

    const tenant = await this.tenantRepository.findById(tenantId);
    if (!tenant) {
      throw new NotFoundException('Tenant no encontrado');
    }

    const inviter = await this.userRepository.findById(invitedById);
    if (!inviter) {
      throw new NotFoundException('Usuario invitador no encontrado');
    }

    if (inviter.email?.toLowerCase() === email) {
      throw new BadRequestException(
        'No podés invitarte a vos mismo al equipo',
      );
    }

    // Miembro activo (no soft-deleted) → conflicto real
    const existingUser = await this.userRepository.findByEmail(email);
    if (existingUser) {
      const activeMember =
        await this.teamMemberRepository.findByUserIdAndTenantId(
          existingUser.id,
          tenantId,
        );
      if (activeMember) {
        throw new ConflictException(
          'Este email ya es miembro activo de este espacio de trabajo',
        );
      }
      // Owner del tenant (sin fila en team_members)
      if (
        existingUser.tenantId === tenantId &&
        existingUser.role === UserRole.OWNER
      ) {
        throw new ConflictException(
          'Este email ya es el dueño de este espacio de trabajo',
        );
      }
    }

    let invitation = await this.invitationRepository.findByEmailAndTenant(
      email,
      tenantId,
    );

    const token = this.generateToken();
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + INVITATION_TTL_HOURS);

    if (invitation) {
      // Reactivar / actualizar la misma fila (PENDING, REVOKED, EXPIRED, ACCEPTED soft-removed)
      invitation.token = token;
      invitation.expiresAt = expiresAt;
      invitation.name = name;
      invitation.role = role;
      invitation.status = InvitationStatus.PENDING;
      invitation.acceptedById = null;
      invitation.acceptedAt = null;
      invitation.invitedById = invitedById;
    } else {
      invitation = this.invitationRepository.create({
        tenantId,
        email,
        name,
        role,
        token,
        expiresAt,
        status: InvitationStatus.PENDING,
        invitedById,
      });
    }

    const saved = await this.invitationRepository.save(invitation);

    if (sendEmail) {
      await this.dispatchInvitationEmail(saved, inviter.name, tenant.name);
    }

    return saved;
  }

  /**
   * Envía (o reenvía) el email de todas las invitaciones PENDING del tenant.
   */
  async sendPendingInvites(
    tenantId: string,
    invitedById: string,
  ): Promise<{ sent: number; sentAt: string }> {
    const tenant = await this.tenantRepository.findById(tenantId);
    if (!tenant) {
      throw new NotFoundException('Tenant no encontrado');
    }
    const inviter = await this.userRepository.findById(invitedById);
    if (!inviter) {
      throw new NotFoundException('Usuario invitador no encontrado');
    }

    const invitations = await this.invitationRepository.findByTenantId(tenantId);
    const pending = invitations.filter(
      (i) =>
        i.status === InvitationStatus.PENDING &&
        i.expiresAt.getTime() > Date.now(),
    );

    let sent = 0;
    for (const inv of pending) {
      // Renovar token/expiración al reenviar
      inv.token = this.generateToken();
      const expiresAt = new Date();
      expiresAt.setHours(expiresAt.getHours() + INVITATION_TTL_HOURS);
      inv.expiresAt = expiresAt;
      await this.invitationRepository.save(inv);
      await this.dispatchInvitationEmail(inv, inviter.name, tenant.name);
      sent += 1;
    }

    return { sent, sentAt: new Date().toISOString() };
  }

  /**
   * Acepta una invitación: crea el User (si no existe), crea/revive el TeamMember
   * y marca la invitación como ACCEPTED.
   */
  async accept(
    token: string,
    password: string,
  ): Promise<{ user: { id: string; email: string }; tenantId: string }> {
    const invitation = await this.invitationRepository.findByToken(token);
    if (!invitation) {
      throw new NotFoundException('Invitación no encontrada');
    }

    if (invitation.status === InvitationStatus.ACCEPTED) {
      throw new ConflictException('Esta invitación ya fue aceptada');
    }
    if (invitation.status === InvitationStatus.REVOKED) {
      throw new ConflictException('Esta invitación fue revocada');
    }
    if (
      invitation.status === InvitationStatus.EXPIRED ||
      invitation.expiresAt.getTime() < Date.now()
    ) {
      if (invitation.status !== InvitationStatus.EXPIRED) {
        invitation.status = InvitationStatus.EXPIRED;
        await this.invitationRepository.save(invitation);
      }
      throw new BadRequestException('La invitación expiró');
    }

    if (!password || password.length < 6) {
      throw new BadRequestException(
        'La contraseña debe tener al menos 6 caracteres',
      );
    }

    let user = await this.userRepository.findByEmail(invitation.email);
    if (!user) {
      const bcrypt = await import('bcrypt');
      const hashedPassword = await bcrypt.hash(password, 10);
      user = this.userRepository.create({
        email: invitation.email,
        name: invitation.name,
        password: hashedPassword,
        tenantId: invitation.tenantId,
        role: UserRole.MEMBER,
      });
      user = await this.userRepository.save(user);
    } else if (user.tenantId && user.tenantId !== invitation.tenantId) {
      throw new ConflictException(
        'Este email ya está registrado con otro tenant. Iniciá sesión y usá el selector de tenants.',
      );
    } else if (!user.tenantId) {
      user.tenantId = invitation.tenantId;
      user.role = UserRole.MEMBER;
      user = await this.userRepository.save(user);
    }

    const existing =
      await this.teamMemberRepository.findByUserIdAndTenantIdWithDeleted(
        user.id,
        invitation.tenantId,
      );

    if (existing?.deletedAt) {
      existing.role = invitation.role;
      await this.teamMemberRepository.recover(existing);
      await this.teamMemberRepository.save(existing);
    } else if (!existing) {
      const teamMember = this.teamMemberRepository.create({
        userId: user.id,
        tenantId: invitation.tenantId,
        role: invitation.role,
      });
      await this.teamMemberRepository.save(teamMember);
    }

    invitation.status = InvitationStatus.ACCEPTED;
    invitation.acceptedById = user.id;
    invitation.acceptedAt = new Date();
    await this.invitationRepository.save(invitation);

    return {
      user: { id: user.id, email: user.email },
      tenantId: invitation.tenantId,
    };
  }

  /**
   * Lista invitaciones activas del tenant (excluye REVOKED).
   */
  async listByTenant(tenantId: string): Promise<TeamInvitation[]> {
    const all = await this.invitationRepository.findByTenantId(tenantId);
    return all.filter((i) => i.status !== InvitationStatus.REVOKED);
  }

  async peekByToken(token: string): Promise<{
    valid: boolean;
    reason?: string;
    invitation?: {
      email: string;
      name: string;
      role: string;
      expiresAt: Date;
    };
  }> {
    const invitation = await this.invitationRepository.findByToken(token);
    if (!invitation) {
      return { valid: false, reason: 'not_found' };
    }
    if (invitation.status === InvitationStatus.ACCEPTED) {
      return { valid: false, reason: 'already_accepted' };
    }
    if (invitation.status === InvitationStatus.REVOKED) {
      return { valid: false, reason: 'revoked' };
    }
    if (invitation.expiresAt.getTime() < Date.now()) {
      return { valid: false, reason: 'expired' };
    }
    return {
      valid: true,
      invitation: {
        email: invitation.email,
        name: invitation.name,
        role: invitation.role,
        expiresAt: invitation.expiresAt,
      },
    };
  }

  /**
   * Soft-delete: marca la invitación como REVOKED y, si ya era miembro,
   * soft-delete del TeamMember.
   */
  async revoke(tenantId: string, invitationId: string): Promise<void> {
    const invitation = await this.invitationRepository.findById(invitationId);
    if (!invitation || invitation.tenantId !== tenantId) {
      throw new NotFoundException('Invitación no encontrada');
    }
    if (invitation.status === InvitationStatus.REVOKED) {
      return; // idempotente
    }

    const wasAccepted = invitation.status === InvitationStatus.ACCEPTED;
    const acceptedById = invitation.acceptedById;

    invitation.status = InvitationStatus.REVOKED;
    await this.invitationRepository.save(invitation);

    if (wasAccepted && acceptedById) {
      const member = await this.teamMemberRepository.findByUserIdAndTenantId(
        acceptedById,
        tenantId,
      );
      if (member) {
        await this.teamMemberRepository.softDelete(member);
      }
    }
  }

  async expireOld(): Promise<number> {
    const now = new Date();
    const expired = await this.invitationRepository.findPendingExpired(now);
    if (expired.length === 0) return 0;
    await this.invitationRepository.markExpired(expired.map((e) => e.id));
    return expired.length;
  }

  private generateToken(): string {
    return randomBytes(32).toString('hex');
  }

  private async dispatchInvitationEmail(
    invitation: TeamInvitation,
    inviterName: string,
    tenantName: string,
  ): Promise<void> {
    const acceptLink = `${this.frontendUrl}/auth/team-invitation/accept?token=${invitation.token}`;
    try {
      await this.emailService.sendTeamInvitationEmail({
        to: invitation.email,
        inviterName,
        tenantName,
        role: invitation.role,
        acceptLink,
        expiresAt: invitation.expiresAt,
      });
    } catch (err) {
      this.logger.error(
        `No se pudo enviar el email de invitación a ${invitation.email}: ${err}`,
      );
    }
  }
}

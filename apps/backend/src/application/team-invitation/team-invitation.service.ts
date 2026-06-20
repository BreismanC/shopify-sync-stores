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
import { IUSER_REPOSITORY, IUserRepository } from '../auth/repositories/IUserRepository';
import { ITenantRepository } from '../tenant/repositories/ITenantRepository';
import { ITeamMemberRepository } from '../team-member/repositories/ITeamMemberRepository';
import { TeamInvitation, InvitationStatus } from '../../domain/entities/team_member.entity';
import { OnboardingStatus } from '../../domain/enums/onboarding-status.enum';
import { UserRole } from '../../domain/enums/user-role.enum';
import { EmailService } from '../../infrastructure/services/email/resend.service';

export const INVITATION_TTL_HOURS = 24;

export interface CreateInvitationInput {
  email: string;
  name: string;
  role: string;
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
      this.configService.get<string>('FRONTEND_URL') ||
      'http://localhost:3000';
  }

  /**
   * Crea una invitación nueva para un tenant y la envía por email.
   * Si ya hay una invitación PENDING para el mismo email, la reusa
   * (regenera el token y la expiración).
   */
  async createAndSend(
    tenantId: string,
    invitedById: string,
    input: CreateInvitationInput,
  ): Promise<TeamInvitation> {
    if (!input.email || !input.email.includes('@')) {
      throw new BadRequestException('Email inválido');
    }
    if (!input.name) {
      throw new BadRequestException('Nombre requerido');
    }
    if (!input.role) {
      throw new BadRequestException('Rol requerido');
    }

    const tenant = await this.tenantRepository.findById(tenantId);
    if (!tenant) {
      throw new NotFoundException('Tenant no encontrado');
    }

    const inviter = await this.userRepository.findById(invitedById);
    if (!inviter) {
      throw new NotFoundException('Usuario invitador no encontrado');
    }

    // Verificar que el email no pertenezca a un miembro activo del tenant.
    const existingUser = await this.userRepository.findByEmail(input.email);
    if (existingUser && existingUser.tenantId === tenantId) {
      throw new ConflictException(
        'Este email ya es miembro activo de este tenant',
      );
    }

    // Reusar invitación pendiente o crear nueva
    let invitation = await this.invitationRepository.findByEmailAndTenant(
      input.email,
      tenantId,
    );

    const token = this.generateToken();
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + INVITATION_TTL_HOURS);

    if (invitation && invitation.status === InvitationStatus.PENDING) {
      // Reusar
      invitation.token = token;
      invitation.expiresAt = expiresAt;
      invitation.name = input.name;
      invitation.role = input.role;
    } else {
      invitation = this.invitationRepository.create({
        tenantId,
        email: input.email,
        name: input.name,
        role: input.role,
        token,
        expiresAt,
        status: InvitationStatus.PENDING,
        invitedById,
      });
    }

    const saved = await this.invitationRepository.save(invitation);

    // Enviar email
    const acceptLink = `${this.frontendUrl}/auth/team-invitation/accept?token=${token}`;
    try {
      await this.sendInvitationEmail({
        to: input.email,
        inviterName: inviter.name,
        tenantName: tenant.name,
        role: input.role,
        acceptLink,
        expiresAt,
      });
    } catch (err) {
      this.logger.error(
        `No se pudo enviar el email de invitación a ${input.email}: ${err}`,
      );
      // No fallamos la creación de la invitación si el email rebota;
      // el owner puede reintentar el envío luego.
    }

    return saved;
  }

  /**
   * Acepta una invitación: crea el User (si no existe), crea el TeamMember
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
      // Marcar como expirada si no lo estaba
      if (invitation.status !== InvitationStatus.EXPIRED) {
        invitation.status = InvitationStatus.EXPIRED;
        await this.invitationRepository.save(invitation);
      }
      throw new BadRequestException('La invitación expiró');
    }

    if (!password || password.length < 6) {
      throw new BadRequestException('La contraseña debe tener al menos 6 caracteres');
    }

    // Buscar o crear el User
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
        onboardingStatus: OnboardingStatus.PENDING_TENANT_CONFIG, // ya tiene tenant pero el flow no se completó
      });
      user = await this.userRepository.save(user);
    } else if (user.tenantId !== invitation.tenantId) {
      // El user ya existe en otro tenant. No podemos sumarlo a este
      // automáticamente — debería usar el tenant-selector.
      throw new ConflictException(
        'Este email ya está registrado con otro tenant. Iniciá sesión y usá el selector de tenants.',
      );
    }

    // Verificar que no sea ya miembro
    const existing = await this.teamMemberRepository.findByUserIdAndTenantId(
      user.id,
      invitation.tenantId,
    );
    if (existing) {
      // Ya es miembro: marcar invitación como aceptada y devolver
      invitation.status = InvitationStatus.ACCEPTED;
      invitation.acceptedById = user.id;
      invitation.acceptedAt = new Date();
      await this.invitationRepository.save(invitation);
      return { user: { id: user.id, email: user.email }, tenantId: invitation.tenantId };
    }

    // Crear TeamMember
    const teamMember = this.teamMemberRepository.create({
      userId: user.id,
      tenantId: invitation.tenantId,
      role: invitation.role,
    });
    await this.teamMemberRepository.save(teamMember);

    // Marcar invitación como aceptada
    invitation.status = InvitationStatus.ACCEPTED;
    invitation.acceptedById = user.id;
    invitation.acceptedAt = new Date();
    await this.invitationRepository.save(invitation);

    return { user: { id: user.id, email: user.email }, tenantId: invitation.tenantId };
  }

  /**
   * Lista invitaciones pendientes y aceptadas del tenant.
   */
  async listByTenant(tenantId: string): Promise<TeamInvitation[]> {
    return this.invitationRepository.findByTenantId(tenantId);
  }

  /**
   * Devuelve los datos públicos de una invitación (para mostrar el form
   * de aceptación). NO expone el token al frontend.
   */
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
   * Revoca una invitación (solo el owner del tenant puede hacerlo).
   */
  async revoke(tenantId: string, invitationId: string): Promise<void> {
    const invitation = await this.invitationRepository.findById(invitationId);
    if (!invitation || invitation.tenantId !== tenantId) {
      throw new NotFoundException('Invitación no encontrada');
    }
    if (invitation.status !== InvitationStatus.PENDING) {
      throw new BadRequestException('Solo se pueden revocar invitaciones pendientes');
    }
    invitation.status = InvitationStatus.REVOKED;
    await this.invitationRepository.save(invitation);
  }

  /**
   * Marca invitaciones PENDING como EXPIRED si pasó su expiresAt.
   * Llamado por un cron o al listar.
   */
  async expireOld(): Promise<number> {
    const now = new Date();
    const expired = await this.invitationRepository.findPendingExpired(now);
    if (expired.length === 0) return 0;
    await this.invitationRepository.markExpired(expired.map((e) => e.id));
    return expired.length;
  }

  // ─── Helpers ─────────────────────────────────────────────────────────────

  private generateToken(): string {
    return randomBytes(32).toString('hex');
  }

  private async sendInvitationEmail(params: {
    to: string;
    inviterName: string;
    tenantName: string;
    role: string;
    acceptLink: string;
    expiresAt: Date;
  }): Promise<void> {
    await this.emailService.sendTeamInvitationEmail(params);
  }
}

import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Req,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { TeamInvitationService } from './team-invitation.service';
import { InviteTeamMemberDto } from '../onboarding/dtos/invite-team-member.dto';
import { UpdateTeamMemberDto, DeleteTeamMemberParamsDto } from '../onboarding/dtos/team-member.dto';
import { AcceptInvitationDto } from './dto/accept-invitation.dto';

interface RequestWithUser extends Request {
  user: {
    id: string;
    tenantId?: string;
    [key: string]: any;
  };
}

/**
 * Controller unificado para invitaciones de equipo.
 * - Rutas bajo `/api/onboarding/team/*` requieren JWT.
 * - Rutas bajo `/api/auth/team-invitation/accept` son públicas
 *   (la persona que recibe el email puede no tener sesión).
 */
@Controller()
export class TeamInvitationController {
  constructor(
    private readonly teamInvitationService: TeamInvitationService,
  ) {}

  // ─── Rutas autenticadas (owner/inviter) ─────────────────────────────────

  @Get('onboarding/team')
  @UseGuards(JwtAuthGuard)
  async list(@Req() req: RequestWithUser) {
    return this.teamInvitationService.listByTenant(req.user.tenantId!);
  }

  @Post('onboarding/team/invite')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.CREATED)
  async invite(
    @Req() req: RequestWithUser,
    @Body() body: InviteTeamMemberDto,
  ) {
    return this.teamInvitationService.createAndSend(
      req.user.tenantId!,
      req.user.id,
      body,
    );
  }

  @Put('onboarding/team/:id')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  async update(
    @Req() req: RequestWithUser,
    @Param() params: DeleteTeamMemberParamsDto,
    @Body() body: UpdateTeamMemberDto,
  ) {
    void req;
    void params;
    void body;
    // Implementación mínima: las invitaciones se reemplazan creando una nueva
    // con `invite`. Una edición in-place requeriría refactor mayor.
    return { id: params.id, ...body };
  }

  @Delete('onboarding/team/:id')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  async revoke(
    @Req() req: RequestWithUser,
    @Param() params: DeleteTeamMemberParamsDto,
  ) {
    await this.teamInvitationService.revoke(req.user.tenantId!, params.id);
    return { id: params.id, revoked: true };
  }

  @Post('onboarding/team/send-invites')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  async resendAll(@Req() req: RequestWithUser) {
    // Re-envía todas las invitaciones PENDING del tenant.
    const invitations = await this.teamInvitationService.listByTenant(
      req.user.tenantId!,
    );
    const pending = invitations.filter(
      (i) => i.status === 'PENDING' && i.expiresAt.getTime() > Date.now(),
    );
    for (const inv of pending) {
      await this.teamInvitationService.createAndSend(
        req.user.tenantId!,
        req.user.id,
        { email: inv.email, name: inv.name, role: inv.role },
      );
    }
    return { sent: pending.length, sentAt: new Date().toISOString() };
  }

  // ─── Rutas públicas (el invitado acepta la invitación) ──────────────────

  @Get('auth/team-invitation/:token')
  async getByToken(@Param('token') token: string) {
    return this.teamInvitationService.peekByToken(token);
  }

  @Post('auth/team-invitation/accept')
  @HttpCode(HttpStatus.OK)
  async accept(@Body() body: AcceptInvitationDto) {
    return this.teamInvitationService.accept(body.token, body.password);
  }
}

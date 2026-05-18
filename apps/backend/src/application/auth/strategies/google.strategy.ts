import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy, Profile } from 'passport-google-oauth20';
import { AuthService } from '../auth.service';
import { User } from '../../../domain/entities/user.entity';

@Injectable()
export class GoogleStrategy extends PassportStrategy(Strategy, 'google') {
  constructor(private readonly authService: AuthService) {
    const { GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_CALLBACK_URL } =
      process.env;

    if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET || !GOOGLE_CALLBACK_URL) {
      throw new Error(
        'Google OAuth environment variables are not properly set.',
      );
    }

    super({
      clientID: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
      callbackURL: process.env.GOOGLE_CALLBACK_URL!,
      scope: 'email profile',
      passReqToCallback: false,
    });
  }

  async validate(
    accessToken: string,
    refreshToken: string,
    profile: Profile,
  ): Promise<User | null> {
    const { emails, displayName } = profile;
    const email = emails?.[0]?.value;
    const name = displayName;

    if (!email) {
      throw new Error('Google user profile does not contain an email.');
    }

    const tenantId = process.env.DEFAULT_TENANT_ID || 'default-tenant';

    try {
      return await this.authService.validateOrCreateSocialUser({
        email,
        name,
      });
    } catch (err) {
      console.error('Google validation error:', err);
      throw err;
    }
  }
}

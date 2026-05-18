import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy, Profile } from 'passport-facebook';
import { AuthService } from '../auth.service';
import { User } from '../../../domain/entities/user.entity';

@Injectable()
export class FacebookStrategy extends PassportStrategy(Strategy, 'facebook') {
  constructor(private readonly authService: AuthService) {
    super({
      clientID: process.env.FACEBOOK_CLIENT_ID as string,
      clientSecret: process.env.FACEBOOK_CLIENT_SECRET as string,
      callbackURL: process.env.FACEBOOK_CALLBACK_URL as string,
      scope: 'email,public_profile',
      profileFields: ['id', 'emails', 'name'],
    });
  }

  async validate(
    accessToken: string,
    refreshToken: string,
    profile: Profile,
  ): Promise<User | null> {
    const { emails, name } = profile;
    const email = emails?.[0]?.value;
    const displayName =
      `${name?.givenName || ''} ${name?.familyName || ''}`.trim();

    if (!email || !displayName) {
      throw new Error(
        'Facebook user profile is missing required fields (email, name).',
      );
    }

    try {
      const result = await this.authService.validateOrCreateSocialUser({
        email,
        name: displayName,
      });
      console.log('Facebook user validated/created:', result);
      return result;
    } catch (err) {
      console.error('Facebook validation error:', err);
      throw err; // Re-throw to be handled by Passport
    }
  }
}

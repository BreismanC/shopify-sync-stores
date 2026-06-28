import NextAuth from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';
import jwt from 'jsonwebtoken';
import { OnboardingStatus, isValidStatus } from '@/lib/auth/onboarding-status';

const NEXTAUTH_SECRET = process.env.NEXTAUTH_SECRET || 'development-secret-change-in-production';
const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:3001';

export const { handlers, auth, signIn, signOut } = NextAuth({
  trustHost: true,
  secret: NEXTAUTH_SECRET,
  providers: [
    CredentialsProvider({
      name: 'credentials',
      credentials: {
        token: { label: 'Access Token', type: 'text' },
        refreshToken: { label: 'Refresh Token', type: 'text' },
        user: { label: 'User', type: 'text' },
      },
      async authorize(credentials) {
        if (!credentials?.token || !credentials?.refreshToken || !credentials?.user) {
          return null;
        }

        try {
          const user = JSON.parse(credentials.user as string);

          return {
            id: user.id,
            email: user.email,
            name: user.name,
            tenantId: user.tenantId,
            role: user.role,
            accessToken: credentials.token as string,
            refreshToken: credentials.refreshToken as string,
            onboardingStatus: isValidStatus(user.onboardingStatus)
              ? user.onboardingStatus
              : OnboardingStatus.PENDING_TENANT_CONFIG,
          };
        } catch {
          return null;
        }
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user, trigger, session }: { token: any; user?: any; trigger?: string; session?: any }) {
      // Initial sign in
      if (user) {
        token.accessToken = token.accessToken || (user as any).accessToken;
        token.refreshToken = token.refreshToken || (user as any).refreshToken;
        token.user = user;
        token.onboardingStatus = (user as any).onboardingStatus;
      }

      // Check if token is expired or about to expire
      if (token.accessToken) {
        try {
          const decoded = jwt.decode(token.accessToken as string) as { exp?: number; onboardingStatus?: string } | null;
          const now = Math.floor(Date.now() / 1000);
          const fiveMinutes = 5 * 60;

          if (decoded?.exp && decoded.exp < now + fiveMinutes) {
            // Token is about to expire, attempt refresh
            if (token.refreshToken) {
              try {
                const refreshResponse = await fetch(`${BACKEND_URL}/api/auth/refresh`, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ refreshToken: token.refreshToken }),
                });

                if (refreshResponse.ok) {
                  const refreshData = await refreshResponse.json();
                  token.accessToken = refreshData.access_token;
                  token.refreshToken = refreshData.refresh_token;
                  token.user = refreshData.user;
                  if (refreshData.user?.onboardingStatus && isValidStatus(refreshData.user.onboardingStatus)) {
                    token.onboardingStatus = refreshData.user.onboardingStatus;
                  }
                } else {
                  // Refresh failed, return error
                  token.error = 'RefreshAccessTokenError';
                }
              } catch {
                token.error = 'RefreshAccessTokenError';
              }
            }
          }
        } catch {
          // Token is invalid, clear it
          token.accessToken = undefined;
          token.error = 'InvalidToken';
        }
      }

      // Handle session update (e.g., from signOut or step advance)
      // IMPORTANT: NextAuth v5 wraps the data in session.data when
      // updateSession({ onboardingStatus }) is called, so session is:
      // { csrfToken, data: { onboardingStatus } }
      // We must NOT overwrite existing token fields with undefined.
      if (trigger === 'update' && session) {
        if (session.data?.accessToken !== undefined) {
          token.accessToken = session.data.accessToken;
        }
        if (session.data?.refreshToken !== undefined) {
          token.refreshToken = session.data.refreshToken;
        }
        if (session.data?.user !== undefined) {
          token.user = session.data.user;
        }
        const newStatus = session.data?.onboardingStatus ?? session.onboardingStatus;
        if (newStatus && isValidStatus(newStatus)) {
          token.onboardingStatus = newStatus;
          if (token.user) {
            token.user = {
              ...token.user,
              onboardingStatus: newStatus,
            };
          }
        }
        const newTenantId = session.data?.tenantId ?? session.tenantId;
        if (newTenantId !== undefined && token.user) {
          token.user = {
            ...token.user,
            tenantId: newTenantId,
          };
        }
      }

      return token;
    },
    async session({ session, token }: { session: any; token: any }) {
      // Pass access token and user data to the client session
      if (token.error) {
        session.error = token.error;
      }

      if (token.accessToken) {
        session.accessToken = token.accessToken;
      }

      if (token.refreshToken) {
        session.refreshToken = token.refreshToken;
      }

      if (token.user) {
        session.user = {
          ...session.user,
          id: token.user.id,
          email: token.user.email,
          name: token.user.name,
          tenantId: token.user.tenantId,
          role: token.user.role,
          onboardingStatus: isValidStatus(token.onboardingStatus)
            ? token.onboardingStatus
            : (token.user.onboardingStatus as OnboardingStatus) ||
              OnboardingStatus.PENDING_TENANT_CONFIG,
        };
      } else if (token.onboardingStatus) {
        // Sin user en el token, pero al menos propagamos el status
        session.user = {
          ...session.user,
          onboardingStatus: isValidStatus(token.onboardingStatus)
            ? token.onboardingStatus
            : OnboardingStatus.PENDING_TENANT_CONFIG,
        };
      }

      return session;
    },
  },
  pages: {
    signIn: '/auth/login',
    error: '/auth/error',
  },
  session: {
    strategy: 'jwt',
    maxAge: 7 * 24 * 60 * 60, // 7 days - matches refresh token expiry
  },
  cookies: {
    sessionToken: {
      name: 'next-auth.session-token',
      options: {
        httpOnly: true,
        sameSite: 'lax',
        path: '/',
        secure: process.env.NODE_ENV === 'production',
      },
    },
  },
});

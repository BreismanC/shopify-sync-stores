import NextAuth, { type NextAuthOptions, DefaultSession } from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';
import { jwtDecode } from 'jose';

// Extend the built-in types
declare module 'next-auth' {
  interface Session {
    accessToken?: string;
    refreshToken?: string;
    user: {
      id: string;
      email: string;
      name: string;
      tenantId: string | null;
      role: string;
    } & DefaultSession['user'];
  }

  interface User {
    id: string;
    email: string;
    name: string;
    tenantId: string | null;
    role: string;
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    accessToken?: string;
    refreshToken?: string;
    user?: {
      id: string;
      email: string;
      name: string;
      tenantId: string | null;
      role: string;
    };
  }
}

const NEXTAUTH_SECRET = process.env.NEXTAUTH_SECRET || 'development-secret-change-in-production';
const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:4000';

export const authOptions: NextAuthOptions = {
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
          const user = JSON.parse(credentials.user);

          return {
            id: user.id,
            email: user.email,
            name: user.name,
            tenantId: user.tenantId,
            role: user.role,
          };
        } catch {
          return null;
        }
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user, trigger, session }) {
      // Initial sign in
      if (user) {
        token.accessToken = token.accessToken || (user as any).accessToken;
        token.refreshToken = token.refreshToken || (user as any).refreshToken;
        token.user = user as any;
      }

      // Check if token is expired or about to expire
      if (token.accessToken) {
        try {
          const decoded = jwtDecode(token.accessToken) as { exp?: number };
          const now = Math.floor(Date.now() / 1000);
          const fiveMinutes = 5 * 60;

          if (decoded.exp && decoded.exp < now + fiveMinutes) {
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

      // Handle session update (e.g., from signOut)
      if (trigger === 'update' && session) {
        token.accessToken = session.accessToken;
        token.refreshToken = session.refreshToken;
        token.user = session.user;
      }

      return token;
    },
    async session({ session, token }) {
      // Pass access token and user data to the client session
      if (token.error) {
        (session as any).error = token.error;
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
};

const handler = NextAuth(authOptions);

export { handler as GET, handler as POST };

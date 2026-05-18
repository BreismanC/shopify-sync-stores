# API Documentation: Social Authentication Flow (OAuth2)

## Overview
This documentation describes the implementation and usage of the social authentication flow (Google/Facebook) within the authentication system.

## Architecture Principles
The implementation follows **Clean Architecture** and **SOLID** principles:
- **Domain Layer:** Defines the `User` entity.
- **Application Layer:** `AuthService` contains the business logic for validating or creating social users.
- **Infrastructure Layer:** `GoogleStrategy` and `FacebookStrategy` (using Passport.js) handle the external provider communication.
- **Dependency Injection:** All dependencies (repositories, services) are injected via NestJS DI.

## Endpoints

### 1. Initiate Authentication
`GET /auth/google`
`GET /auth/facebook`

- **Purpose:** Starts the OAuth2 flow with the respective provider.
- **Mechanism:** Uses `@UseGuards(AuthGuard('provider'))`.

### 2. Callback Handling
`GET /auth/google/callback`
`GET /auth/facebook/callback`

- **Purpose:** Handles the redirect from the provider and completes the authentication.
- **Mechanism:** 
  1. Validates the provider's token.
  2. Extracts user profile (email, name).
  3. Calls `AuthService.validateOrCreateSocialUser`.
  4. Generates an internal JWT.
  5. **Redirection:** Redirects the user to the configured `FRONTEND_URL` with the following query parameters:
     - `token`: The generated JWT `access_token`.
     - `user`: A URL-encoded JSON string containing the user object.

## Security Considerations
- **JWT-based:** The system uses stateless JWTs for session management.
- **Environment Variables:** Sensitive credentials (`GOOGLE_CLIENT_SECRET`, `AUTH_SECRET`) must be managed via `.env`.
- **Cross-Origin Redirection:** The backend is configured to redirect to a trusted `FRONTEND_URL` to prevent open redirect vulnerabilities.

## Integration for Frontend
The frontend must implement a listener on the `/auth/callback` route to:
1. Extract `token` and `user` from the URL.
2. Store the token (e.g., in LocalStorage or a Cookie).
3. Update the application state with the user info.
4. Redirect the user to the intended landing page (e.g., Dashboard).

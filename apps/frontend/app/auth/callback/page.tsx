"use client";

import { Suspense } from 'react';
import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import AlertStatus from '@/components/AlertStatus';
import {
  OnboardingStatus,
  isValidStatus,
  statusToStep,
} from '@/lib/auth/onboarding-status';

function LoadingFallback() {
  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: '100vh',
      gap: '16px',
      fontFamily: 'system-ui, sans-serif',
    }}>
      <div style={{
        width: '40px',
        height: '40px',
        border: '3px solid #e5e5e5',
        borderTopColor: '#000',
        borderRadius: '50%',
        animation: 'spin 1s linear infinite',
      }} />
      <p>Loading...</p>
      <style>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}

function AuthCallbackContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [error, setError] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(true);

  useEffect(() => {
    const processCallback = async () => {
      const token = searchParams.get('token');
      const userJson = searchParams.get('user');

      if (!token || !userJson) {
        setError('Faltan datos de autenticación. Intenta iniciar sesión de nuevo.');
        setIsProcessing(false);
        return;
      }

      try {
        const user = JSON.parse(userJson);

        // Llamar a nuestra API route que usa signIn de NextAuth en el servidor
        const signInRes = await fetch('/api/auth/signin', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            token: token,
            refreshToken: '',
            user: JSON.stringify(user),
          }),
        });

        const authResult = await signInRes.json();

        if (authResult.error) {
          console.error('Auth error:', authResult.error);
          setError('Error al crear la sesión.');
          setIsProcessing(false);
          return;
        }

        // Redirección por onboardingStatus (no por tenantId).
        const onboardingStatus: OnboardingStatus = isValidStatus(
          user.onboardingStatus,
        )
          ? (user.onboardingStatus as OnboardingStatus)
          : OnboardingStatus.PENDING_TENANT_CONFIG;

        if (onboardingStatus === OnboardingStatus.COMPLETED) {
          // Onboarding completo: revisar tenants
          try {
            const tenantsRes = await fetch('/api/auth/tenant', {
              method: 'GET',
              headers: { 'Content-Type': 'application/json' },
            });

            if (tenantsRes.ok) {
              const tenantsData = await tenantsRes.json();
              const tenants = tenantsData.tenants || [];
              if (tenants.length >= 2) {
                window.location.href = '/tenant-selector';
              } else {
                window.location.href = '/dashboard';
              }
            } else {
              window.location.href = '/dashboard';
            }
          } catch {
            window.location.href = '/dashboard';
          }
        } else {
          // Onboarding pendiente: ir al step derivado del status
          const step = statusToStep(onboardingStatus);
          window.location.href = `/onboarding?step=${step}`;
        }
      } catch (err) {
        console.error('Error parsing auth data:', err);
        setError('Error al procesar los datos de autenticación.');
        setIsProcessing(false);
      }
    };

    processCallback();
  }, [searchParams, router]);

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background px-4">
        <div className="w-full max-w-md space-y-4">
          <AlertStatus status="danger" description={error} />
          <button 
            onClick={() => router.push('/auth/login')}
            className="w-full py-2 text-sm font-medium text-primary hover:underline"
          >
            Volver al Login
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-center min-h-screen bg-background px-4">
      <div className="text-center space-y-4">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto" />
        <p className="text-muted-foreground">Completando el inicio de sesión...</p>
      </div>
    </div>
  );
}

export default function AuthCallbackPage() {
  return (
    <Suspense fallback={<LoadingFallback />}>
      <AuthCallbackContent />
    </Suspense>
  );
}

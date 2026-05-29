"use client";

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import AlertStatus from '@/components/AlertStatus';

export default function AuthCallbackPage() {
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
        
        // Guardar en el storage
        localStorage.setItem('token', token);
        localStorage.setItem('user', JSON.stringify(user));

        // Redirigir según el tenant
        if (!user.tenantId) {
          router.push('/onboarding');
        } else {
          router.push('/dashboard');
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

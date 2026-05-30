"use client";

import { toast } from "sonner";
import { useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Eye, EyeOff } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Form, FormField, FormSubmit } from '@/components/ui/Form';
import { useFormDynamic } from "@/hooks/use-dynamic-form";
import { LoginCredentials } from "@/types/auth";
import { loginSchema } from '@/schemas/auth';
import { validateFormData } from '@/utils/web-validation';

export function LoginForm() {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const [showPassword, setShowPassword] = useState(false);

  const { field, getValues, setFetchStatus, fetchStatus, setTouch } = useFormDynamic({
    email: 'text',
    password: 'text',
  });

  const values = getValues();
  const { isValid, errors } =  validateFormData(loginSchema, values) 

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    console.log("Submitting form")
    const values = getValues() as LoginCredentials;

    if (!isValid) {
      setTouch({ 
        email: true, 
        password: true 
      });
      return;
    }
    
    setFetchStatus('loading');

    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(values),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Credenciales incorrectas');
      }

      const result = await response.json();
      
      // Llamar a nuestra API route que usa signIn de NextAuth en el servidor
      const signInRes = await fetch('/api/auth/signin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token: result.access_token,
          refreshToken: result.refresh_token || result.access_token,
          user: JSON.stringify(result.user),
        }),
      });

      const authResult = await signInRes.json();

      if (authResult.error) {
        console.error('Auth error:', authResult.error);
        toast.error('Error al iniciar sesión');
        setFetchStatus('error');
        return;
      }

      toast.success("Has iniciado sesión correctamente");
      window.location.href = authResult.url || '/dashboard';
      setFetchStatus('success');
    } catch (err: any) {
      toast.error(err.message || "Error al iniciar sesión");
      setFetchStatus('error');
    }
  };

  return (
    <div 
                  className="flex min-h-screen w-full flex-col items-center justify-between p-4 sm:p-6 bg-surface">
      <header 
                  className="w-full flex justify-center py-6 sm:py-8">
        <a href="/" 
                  className="flex items-center gap-2.5 transition-opacity hover:opacity-80">
          <div 
                  className="h-8 w-8 text-primary">
            <svg fill="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 14.59L7.59 13.17a.996.996 0 1 1 1.41-1.41L11 13.75V7c0-.55.45-1 1-1s1 .45 1 1v6.75l2-2a.996.996 0 1 1 1.41 1.41L13.41 16.59a.996.001 0 0 1 -1.41 0z"></path>
            </svg>
          </div>
          <span 
                  className="text-2xl font-bold text-on-background">SyncShop</span>
        </a>
      </header>

      <main 
                  className="flex w-full max-w-md flex-col items-center justify-center">
        <Card 
                  className="w-full rounded-xl border border-outline-variant bg-surface-container-lowest p-6 sm:p-8 shadow-none">
          <div 
                  className="flex flex-col items-center mb-8 gap-2">
            <h1 
                  className="text-on-background tracking-tight text-3xl font-extrabold leading-tight text-center font-sans">
              Inicia sesión
            </h1>
            <p 
                  className="text-on-surface-variant text-sm font-medium">Bienvenido de nuevo a SyncShop</p>
          </div>

          <Form onSubmit={onSubmit} ref={formRef} errors={ errors!} 
                  className="mt-8 space-y-6">
            <div 
                  className="space-y-4">
              <FormField name="email" label="Correo electrónico" field={field('email')}>
                <Input 
                  type="email"
                  className="h-12 bg-surface-container-low focus:ring-primary"
                  placeholder="ejemplo@empresa.com" 
                />
              </FormField>

              <FormField name="password" label="Contraseña" field={field('password')}>
                <div className="relative flex w-full items-stretch">
                  <Input 
                    type={showPassword ? 'text' : 'password'} 
                    className="h-12 bg-surface-container-low pr-10 focus:ring-primary"
                    placeholder="Introduce tu contraseña" 
                  />
                  <button 
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute inset-y-0 right-0 flex items-center pr-3 text-outline hover:text-on-surface transition-colors"
                    aria-label="Mostrar/Ocultar contraseña"
                  >
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </FormField>

              <div 
                  className="pt-2">
                <FormSubmit 
                  
                  className="w-full h-12 font-semibold text-base shadow-none bg-primary text-white"
                  fetchStatus={fetchStatus}
                  buttonProps={{ label: "Iniciar sesión" }}
                /> 
              </div>
            </div>
          </Form>

          <div 
                  className="mt-8 space-y-4">
            <div 
                  className="relative flex items-center">
              <div 
                  className="flex-grow border-t border-outline-variant"></div>
              <span 
                  className="mx-4 flex-shrink text-sm text-on-surface-variant">o</span>
              <div 
                  className="flex-grow border-t border-outline-variant"></div>
            </div>

            <div 
                  className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Button 
                mode="pill" 
                
                  className="h-12 flex items-center justify-center gap-2 font-semibold text-base" 
                type="button"
                onClick={() => {
                  window.location.href = `${process.env.NEXT_PUBLIC_API_URL}/api/auth/google`;
                }}
              >
                Google
              </Button>
              <Button 
                mode="pill" 
                
                  className="h-12 flex items-center justify-center gap-2 font-semibold text-base" 
                type="button"
                onClick={() => {
                  window.location.href = `${process.env.NEXT_PUBLIC_API_URL}/api/auth/facebook`;
                }}
              >
                Facebook
              </Button>
            </div>

            <p 
                  className="text-center text-sm text-on-surface-variant mt-6">
              ¿No tienes cuenta?{' '}
              <button 
                type="button" 
                
                  className="text-primary hover:underline font-semibold"
                onClick={() => router.push('/auth/register')}
              >
                Regístrate
              </button>
            </p>
          </div>
        </Card>
      </main>
    </div>
  );
}

"use client";

import { toast } from "sonner";
import { useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Form, FormField, FormSubmit } from '@/components/ui/Form';
import { useFormDynamic } from "@/hooks/use-dynamic-form";
import { AuthResponse, RegisterCredentials } from "@/types/auth";
import { Eye, EyeOff } from 'lucide-react';
import { registerSchema } from '@/schemas/auth';
import { validateFormData } from '@/utils/web-validation';

export function RegisterForm() {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const [showPassword, setShowPassword] = useState(false);

  const { field, getValues, getFields, setFetchStatus, fetchStatus, touchForm } = useFormDynamic({
    name: 'text',
    email: 'text',
    companyName: 'text',
    password: 'text',
  });

  const {name, email, companyName, password} = getFields();

  console.log("values", getValues());

  const {isValid, errors} = validateFormData(registerSchema, getValues());

  const formErrors = errors || undefined;


  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!isValid) {
      setFetchStatus("error");
      touchForm();
    }

    setFetchStatus('loading');

    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.value,
          email: email.value,
          companyName: companyName.value,
          password: password.value,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Error al registrar el usuario');
      }

      const result: AuthResponse = await response.json();
      
      // Llamar a nuestra API route que usa signIn de NextAuth en el servidor
      const signInRes = await fetch('/api/auth/signin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token: result.access_token,
          refreshToken: (result as any).refresh_token || result.access_token,
          user: JSON.stringify(result.user),
        }),
      });

      const authResult = await signInRes.json();

      if (authResult.error) {
        console.error('Auth error:', authResult.error);
        toast.error('Error al crear la sesión');
        setFetchStatus('error');
        return;
      }

      toast.success("Cuenta creada correctamente");
      
      // Redirigir según si tiene tenant o no
      const redirectUrl = result.user?.tenantId ? '/dashboard' : '/onboarding';
      window.location.href = redirectUrl;
      setFetchStatus('success');
    } catch (err: any) {
      toast.error(err.message || "Error al registrarse");
      setFetchStatus('error');
    }
  };

  return (
    <div className="flex min-h-screen w-full flex-col items-center justify-between p-4 sm:p-6 bg-surface">
      <header className="w-full flex justify-center py-6 sm:py-8">
        <a href="/" className="flex items-center gap-2.5 transition-opacity hover:opacity-80">
          <div className="h-8 w-8 text-primary">
             <svg fill="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
               <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 14.59L7.59 13.17a.996.996 0 1 1 1.41-1.41L11 13.75V7c0-.55.45-1 1-1s1 .45 1 1v6.75l2-2a.996.996 0 1 1 1.41 1.41L13.41 16.59a.996.001 0 0 1 -1.41 0z"></path>
             </svg>
          </div>
          <span className="text-2xl font-bold text-on-background">SyncShop</span>
        </a>
      </header>

      <main className="flex w-full max-w-md flex-col items-center justify-center">
        <Card className="w-full rounded-xl border border-outline-variant bg-surface-container-lowest p-6 sm:p-8 shadow-none">
          <div className="flex flex-col items-center mb-8">
            <h1 className="text-on-background tracking-tight text-2xl sm:text-3xl font-bold leading-tight text-center font-inter">
              Crea tu cuenta para empezar a sincronizar tus tiendas
            </h1>
          </div>

          <Form onSubmit={onSubmit} ref={formRef} errors={formErrors} className="mt-8 space-y-6">
            <div className="space-y-4">
              <FormField name="companyName" label="Nombre de la empresa" field={field('companyName')}>
                <Input 
                  className="h-12 bg-surface-container-low focus:ring-primary"
                  placeholder="Introduce el nombre de tu empresa" 
                />
              </FormField>

              <FormField name="name" label="Tu nombre completo" field={field('name')}>
                <Input 
                  className="h-12 bg-surface-container-low focus:ring-primary"
                  placeholder="Introduce tu nombre y apellidos" 
                />
              </FormField>

              <FormField name="email" label="Correo electrónico de trabajo" field={field('email')}>
                <Input 
                  type="email" 
                  className="h-12 bg-surface-container-low focus:ring-primary"
                  placeholder="ejemplo@empresa.com" 
                />
              </FormField>

              <FormField name="password" label="Contraseña segura" field={field('password')}>
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
              <p className="text-xs text-outline pt-2">
                Mínimo 8 caracteres, una mayúscula y un número.
              </p>

              <div className="pt-2">
                <FormSubmit 
                  className="w-full h-12 font-semibold text-base shadow-none bg-primary text-white"
                  fetchStatus={fetchStatus}
                  buttonProps={{ label: "Registrarse ahora" }}
                /> 
              </div>
            </div>
          </Form>

          <div className="mt-8 space-y-4">
            <div className="relative flex items-center">
              <div className="flex-grow border-t border-outline-variant"></div>
              <span className="mx-4 flex-shrink text-sm text-on-surface-variant">o</span>
              <div className="flex-grow border-t border-outline-variant"></div>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Button 
                mode="pill" 
                className="h-12 flex items-center justify-center gap-2 font-semibold text-base" 
                type="button"
                onClick={() => {
                  window.location.href = `${process.env.NEXT_PUBLIC_API_URL}/api/auth/google`;
                }}
              >
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                  <path d="M22.56 12.25C22.56 11.42 22.49 10.62 22.36 9.85H12.28V14.4H18.24C17.99 15.93 17.23 17.25 16.07 18.09V20.65H19.76C21.58 19.01 22.56 16.03 22.56 12.25Z" fill="#4285F4"></path>
                  <path d="M12.28 22.9C15.24 22.9 17.7 21.94 19.76 20.65L16.07 18.09C15.08 18.78 13.82 19.23 12.28 19.23H2.3V17.44C4.22 20.73 7.91 22.9 12 22.9s7.91-2.07 17.7 21.94 19.76 20.65L16.07 18.09C15.08 18.78 13.82 19.23 12.28 19.23H2.3V17.44C4.22 20.73 7.91 22.9 12 22.9z" fill="#34A853"></path>
                </svg>
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
                <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                  <path d="M24 12.073C24 5.848 18.184 2 12 2S0 5.848 0 12.073C0 18.304 5.816 22 12 22s12-3.696 12-9.927zM12 20.08c-4.35 0-7.873-2.86-8.61-6.53H3.5C4.5 15.5 7.5 17.5 12 17.5s7.5-2 8.5-4.47h-1.89c-.737 3.67-4.26 6.53-8.61 6.53zM12 15.5c-2.33 0-4.304-1.384-5.184-3.44h10.368C16.304 14.116 14.33 15.5 12 15.5zM12 13.44c2.33 0-4.304-1.384-5.184-3.44h-10.368C7.696 12.056 9.67 13.44 12 13.44zM12 11.36c-2.33 0-4.304-1.384-5.184-3.44h10.368C16.304 10.016 14.33 11.36 12 11.36z" />
                </svg>
                Facebook
              </Button>
            </div>

            <p className="text-center text-sm text-on-surface-variant mt-6">
              ¿Ya tienes cuenta?{' '}
              <button 
                type="button" 
                className="text-primary hover:underline font-semibold"
                onClick={() => router.push('/auth/login')}
              >
                Inicia sesión
              </button>
            </p>
          </div>
        </Card>
      </main>
    </div>
  );
}

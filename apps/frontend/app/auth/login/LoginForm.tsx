"use client";

import { toast } from "sonner";
import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { Eye, EyeOff } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Form, FormField, FormSubmit } from "@/components/ui/Form";
import { useFormDynamic } from "@/hooks/use-dynamic-form";
import { LoginCredentials } from "@/types/auth";
import { loginSchema } from "@/schemas/auth";
import { validateFormData } from "@/utils/web-validation";
import {
  OnboardingStatus,
  isValidStatus,
  statusToStep,
} from "@/lib/auth/onboarding-status";
import { BACKEND_URL } from "@/lib/env";
import Link from "next/link";

export function LoginForm() {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const [showPassword, setShowPassword] = useState(false);

  const { field, getValues, setFetchStatus, fetchStatus, setTouch } =
    useFormDynamic({
      email: "text",
      password: "text",
    });

  const values = getValues();
  const { isValid, errors } = validateFormData(loginSchema, values);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    console.log("Submitting form")
    const values = getValues() as LoginCredentials;

    if (!isValid) {
      setTouch({
        email: true,
        password: true,
      });
      return;
    }

    setFetchStatus("loading");

    try {
      const response = await fetch(
        `${BACKEND_URL}/api/auth/login`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(values),
        },
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || "Credenciales incorrectas");
      }

      const result = await response.json();

      // Store user data for tenant check
      const userData = result.user;

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

      // onboardingStatus es del TENANT. Owner completa onboarding;
      // miembros entran al dashboard solo desde PENDING_TEAM_CONFIG.
      const onboardingStatus: OnboardingStatus = isValidStatus(
        result.user?.onboardingStatus,
      )
        ? (result.user.onboardingStatus as OnboardingStatus)
        : OnboardingStatus.PENDING_TENANT_CONFIG;
      const isOwner =
        result.user?.isOwner === true || result.user?.role === 'OWNER';

      let target: string;
      if (onboardingStatus === OnboardingStatus.COMPLETED) {
        try {
          const tenantsRes = await fetch('/api/auth/tenant', {
            method: 'GET',
            headers: { 'Content-Type': 'application/json' },
          });

          if (tenantsRes.ok) {
            const tenantsData = await tenantsRes.json();
            const tenants = tenantsData.tenants || [];
            if (tenants.length >= 2) {
              target = '/tenant-selector';
            } else {
              target = '/dashboard';
            }
          } else {
            target = '/dashboard';
          }
        } catch {
          target = '/dashboard';
        }
      } else if (!isOwner) {
        if (onboardingStatus === OnboardingStatus.PENDING_TEAM_CONFIG) {
          target = '/dashboard';
        } else {
          target = '/unauthorized?reason=team-member-not-invited';
        }
      } else {
        const step = statusToStep(onboardingStatus);
        target = `/onboarding?step=${step}`;
      }

      window.location.href = target;
      setFetchStatus('success');
    } catch (err: any) {
      toast.error(err.message || "Error al iniciar sesión");
      setFetchStatus("error");
    }
  };

  return (
    <div className="flex min-h-screen w-full flex-col items-center justify-between p-4 sm:p-6 bg-gray-2">
      <header className="w-full flex justify-center py-6 sm:py-8">
        <a
          href="/"
          className="flex items-center gap-2.5 transition-opacity hover:opacity-80"
        >
          <div className="h-8 w-8 text-accent-9">
            <svg
              fill="currentColor"
              viewBox="0 0 24 24"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 14.59L7.59 13.17a.996.996 0 1 1 1.41-1.41L11 13.75V7c0-.55.45-1 1-1s1 .45 1 1v6.75l2-2a.996.996 0 1 1 1.41 1.41L13.41 16.59a.996.001 0 0 1 -1.41 0z"></path>
            </svg>
          </div>
          <span className="text-2xl font-bold text-gray-12">
            SyncShop
          </span>
        </a>
      </header>

      <main className="flex w-full max-w-md flex-col items-center justify-center">
        <Card className="w-full rounded-xl border border-gray-6 bg-gray-1 p-6 sm:p-8 shadow-none">
          <div className="flex flex-col items-center mb-8 gap-2">
            <h1 className="text-gray-12 tracking-tight text-3xl font-extrabold leading-tight text-center">
              Inicia sesión
            </h1>
            <p className="text-gray-11 text-sm font-medium">
              Bienvenido de nuevo a SyncShop
            </p>
          </div>

          <Form
            onSubmit={onSubmit}
            ref={formRef}
            errors={errors!}
            className="mt-8 space-y-6 [&_label]:block [&_label]:text-sm [&_label]:font-bold [&_label]:leading-normal [&_label]:pb-2 [&_label]:text-gray-12 [&_[data-slot=input]]:h-12 [&_[data-slot=input]]:bg-gray-3 [&_[data-slot=input]]:border [&_[data-slot=input]]:border-gray-6 [&_[data-slot=input]]:rounded-lg [&_[data-slot=input]]:text-gray-12 [&_[data-slot=input]]:placeholder:text-gray-11 [&_[data-slot=input]]:focus:outline-none [&_[data-slot=input]]:focus:border-accent-9 [&_[data-slot=input]]:focus:ring-2 [&_[data-slot=input]]:focus:ring-accent-9/50"
          >
            <div className="space-y-4">
              <FormField
                name="email"
                label="Correo electrónico"
                field={field("email")}
              >
                <Input
                  type="email"
                  placeholder="ejemplo@empresa.com"
                />
              </FormField>

              <div className="relative w-full">
                <FormField
                  name="password"
                  label="Contraseña"
                  field={field("password")}
                >
                  <Input
                    type={showPassword ? "text" : "password"}
                    className="pr-10"
                    placeholder="Introduce tu contraseña"
                  />
                </FormField>
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 flex items-center pr-3 text-gray-11 hover:text-gray-12 transition-colors"
                  aria-label="Mostrar/Ocultar contraseña"
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
                <div className="mt-4 text-sm flex justify-end">
                  <Link
                    href="/auth/password-recovery/request"
                    className="text-accent-9 hover:underline font-semibold"
                  >
                    <span>¿Olvidaste tu contraseña?</span>
                  </Link>
                </div>
              </div>

              <div className="pt-2">
                <FormSubmit
                  className="w-full h-12 font-semibold text-base bg-accent-9 hover:bg-accent-10 text-white rounded-lg shadow-sm hover:!transform-none active:!transform-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-9"
                  fetchStatus={fetchStatus}
                  buttonProps={{ label: "Iniciar sesión" }}
                />
              </div>
            </div>
          </Form>

          <div className="mt-8 space-y-4">
            <div className="relative flex items-center">
              <div className="flex-grow border-t border-gray-6"></div>
              <span className="mx-4 flex-shrink text-sm text-gray-11">
                o
              </span>
              <div className="flex-grow border-t border-gray-6"></div>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Button
                className="h-12 flex items-center justify-center gap-2 font-semibold text-base text-gray-12 rounded-lg shadow-sm hover:!transform-none active:!transform-none"
                type="button"
                variant="pill"
                onClick={() => {
                  window.location.href = `${BACKEND_URL}/api/auth/google`;
                }}
              >
                <svg className="h-5 w-5" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                  <path d="M22.56 12.25C22.56 11.42 22.49 10.62 22.36 9.85H12.28V14.4H18.24C17.99 15.93 17.23 17.25 16.07 18.09V20.65H19.76C21.58 19.01 22.56 16.03 22.56 12.25Z" fill="#4285F4"></path>
                  <path d="M12.28 22.9C15.24 22.9 17.7 21.94 19.76 20.65L16.07 18.09C15.08 18.78 13.82 19.23 12.28 19.23C9.44 19.23 6.99 17.34 6.1 14.8H2.3V17.44C4.22 20.73 7.91 22.9 12.28 22.9Z" fill="#34A853"></path>
                  <path d="M6.1 14.8C5.87 14.12 5.73 13.38 5.73 12.6C5.73 11.82 5.87 11.08 6.1 10.4H2.3V7.76C1.52 9.24 1 10.86 1 12.6C1 14.34 1.52 15.96 2.3 17.44L6.1 14.8Z" fill="#FBBC05"></path>
                  <path d="M12.28 5.96999C13.92 5.96999 15.35 6.53999 16.51 7.64999L19.83 4.41C17.69 2.44 15.23 1.29999 12.28 1.29999C7.91 1.29999 4.22 3.47 2.3 6.76L6.1 9.4C6.99 6.86 9.44 4.96999 12.28 4.96999V5.96999Z" fill="#EA4335"></path>
                </svg>
                Google
              </Button>
              <Button
                className="h-12 flex items-center justify-center gap-2 font-semibold text-base text-gray-12 rounded-lg shadow-sm hover:!transform-none active:!transform-none"
                variant="pill"
                type="button"
                onClick={() => {
                  window.location.href = `${BACKEND_URL}/api/auth/facebook`;
                }}
              >
                <svg className="h-5 w-5 text-[#1877F2]" fill="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                  <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"></path>
                </svg>
                Facebook
              </Button>
            </div>

            <p className="text-center text-sm text-gray-11 mt-6">
              ¿No tienes cuenta?{" "}
              <button
                type="button"
                className="text-accent-9 hover:underline font-semibold"
                onClick={() => router.push("/auth/register")}
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

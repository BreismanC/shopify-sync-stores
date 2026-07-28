"use client";

import { useState, useRef, useEffect } from "react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { KeyRound, ArrowLeft } from "lucide-react";
import { Form, FormField, FormSubmit } from "@/components/ui/Form";
import { Input } from "@/components/ui/Input";
import { useFormDynamic } from "@/hooks/use-dynamic-form";
import { forgotPasswordSchema } from "@/schemas/auth";
import { validateFormData } from "@/utils/web-validation";
import { Card } from "@/components/ui/Card";
import { BACKEND_URL } from "@/lib/env";

export default function PasswordRecoveryRequest() {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const { field, getValues, setFetchStatus, fetchStatus, setTouch } =
    useFormDynamic({
      email: "text",
    });

  const [cooldown, setCooldown] = useState(0);

  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (cooldown > 0) {
      timer = setInterval(() => {
        setCooldown((prev) => prev - 1);
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [cooldown]);

  const { isValid, errors } = validateFormData(forgotPasswordSchema, getValues());

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (cooldown > 0) return;

    if (!isValid) {
      setTouch({ email: true });
      return;
    }

    setFetchStatus("loading");

    try {
      const response = await fetch(
        `${BACKEND_URL}/api/auth/forgot-password`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(getValues()),
        },
      );

      if (!response.ok) {
        throw new Error("No se pudo enviar el correo de recuperación");
      }

      toast.success("Instrucciones enviadas a tu correo");
      setFetchStatus("success");
      setCooldown(60); // Cooldown of 60 seconds
    } catch (error: any) {
      toast.error(error.message || "Error al enviar el correo");
      setFetchStatus("error");
    }
  };

  return (
    <div className="flex min-h-screen w-full flex-col items-center justify-center p-4 sm:p-6 bg-gray-2">
      <main className="flex w-full max-w-md flex-col items-center justify-center">
        <Card className="w-full rounded-xl border border-gray-6 bg-gray-1 p-6 sm:p-8 shadow-none">
          <div className="flex flex-col items-center text-center">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-accent-9/10 text-accent-9 mb-6">
              <KeyRound className="w-8 h-8" strokeWidth={1.75} />
            </div>
            <h1 className="text-gray-12 text-2xl font-extrabold tracking-tight">
              Recuperación de Contraseña
            </h1>
            <p className="mt-3 text-gray-11 text-sm leading-relaxed">
              Introduce el correo electrónico asociado a tu cuenta y te
              enviaremos un enlace para restablecer tu contraseña.
            </p>
          </div>

          <Form
            onSubmit={handleSubmit}
            ref={formRef}
            errors={errors!}
            className="mt-8 space-y-6 [&_label]:block [&_label]:text-sm [&_label]:font-semibold [&_label]:leading-normal [&_label]:pb-2 [&_label]:text-gray-12 [&_[data-slot=input]]:h-12 [&_[data-slot=input]]:bg-gray-3 [&_[data-slot=input]]:border [&_[data-slot=input]]:border-gray-6 [&_[data-slot=input]]:rounded-lg [&_[data-slot=input]]:text-gray-12 [&_[data-slot=input]]:placeholder:text-gray-11 [&_[data-slot=input]]:focus:outline-none [&_[data-slot=input]]:focus:border-accent-9 [&_[data-slot=input]]:focus:ring-2 [&_[data-slot=input]]:focus:ring-accent-9/50"
          >
            <FormField label="Correo electrónico" name="email" field={field("email")}>
              <Input
                type="email"
                name="email"
                placeholder="ejemplo@empresa.com"
              />
            </FormField>

            <div className="pt-2">
              <FormSubmit
                fetchStatus={fetchStatus}
                className="w-full h-12 font-bold text-sm bg-accent-9 hover:bg-accent-10 text-white rounded-lg shadow-sm uppercase tracking-wide hover:!transform-none active:!transform-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-9"
                buttonProps={{
                  label: cooldown > 0 ? `Reintentar en ${cooldown}s` : "Enviar enlace de recuperación",
                  disabled: cooldown > 0
                }}
              />
            </div>
          </Form>

          <div className="mt-8 pt-6 border-t border-gray-6 text-center">
            <button
              type="button"
              onClick={() => router.push("/auth/login")}
              className="inline-flex items-center gap-2 text-sm font-semibold text-accent-9 hover:text-accent-10 transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              ¿Recordaste tu contraseña? Volver al inicio de sesión
            </button>
          </div>
        </Card>
      </main>
    </div>
  );
}

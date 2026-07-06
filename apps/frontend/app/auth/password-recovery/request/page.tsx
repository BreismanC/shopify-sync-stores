"use client";

import { useState, useRef, useEffect } from "react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
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
    <div className="flex min-h-screen flex-col items-center justify-center p-6">
      <Card className="w-full max-w-md p-8 rounded-xl border border-outline-variant bg-surface-container-lowest shadow-none">
        <h1 className="text-2xl font-bold mb-2">Recuperar contraseña</h1>
        <p className="mb-6 text-sm text-on-surface-variant">Introduce tu correo electrónico para recibir instrucciones de recuperación.</p>
        
        <Form onSubmit={handleSubmit} ref={formRef} errors={errors!} className="space-y-4">
          <FormField label="Correo electrónico" name="email" field={field("email")}>
            <Input type="email" name="email" placeholder="ejemplo@correo.com" className="h-12" />
          </FormField>
          
          <FormSubmit 
            fetchStatus={fetchStatus} 
            className="w-full h-12 bg-primary text-white"
            buttonProps={{ 
                label: cooldown > 0 ? `Reintentar en ${cooldown}s` : "Enviar instrucciones",
                disabled: cooldown > 0 
            }} 
          />
        </Form>
      </Card>
    </div>
  );
}

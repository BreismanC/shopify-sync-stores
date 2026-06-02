"use client";

import { useState, useRef } from "react";
import { toast } from "sonner";
import { useRouter, useSearchParams } from "next/navigation";
import { Form, FormField, FormSubmit } from "@/components/ui/Form";
import { Input } from "@/components/ui/Input";
import { useFormDynamic } from "@/hooks/use-dynamic-form";
import { resetPasswordSchema } from "@/schemas/auth";
import { validateFormData } from "@/utils/web-validation";
import { Card } from "@/components/ui/Card";

export default function PasswordRecoveryReset() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token");
  const formRef = useRef<HTMLFormElement>(null);

  const { field, getValues, setFetchStatus, fetchStatus, setTouch } =
    useFormDynamic({
      password: "text",
      confirmPassword: "text",
    });

  const { isValid, errors } = validateFormData(resetPasswordSchema, getValues());

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    const values = getValues();

    if (values.password !== values.confirmPassword) {
      toast.error("Las contraseñas no coinciden");
      return;
    }

    if (!isValid) {
      setTouch({ password: true, confirmPassword: true });
      return;
    }

    setFetchStatus("loading");
    
    try {
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/auth/reset-password`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ newPassword: values.password, token }),
        },
      );

      if (!response.ok) {
        throw new Error("No se pudo restablecer la contraseña");
      }

      toast.success("Contraseña restablecida con éxito");
      setFetchStatus("success");
      router.push("/auth/login");
    } catch (error: any) {
      toast.error(error.message || "Error al restablecer la contraseña");
      setFetchStatus("error");
    }
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center p-6">
      <Card className="w-full max-w-md p-8 rounded-xl border border-outline-variant bg-surface-container-lowest shadow-none">
        <h1 className="text-2xl font-bold mb-2">Nueva contraseña</h1>
        <p className="mb-6 text-sm text-on-surface-variant">Introduce tu nueva contraseña para acceder a tu cuenta.</p>
        
        <Form onSubmit={handleSubmit} ref={formRef} errors={errors!} className="space-y-4">
          <FormField label="Nueva contraseña" name="password" field={field("password")}>
            <Input type="password" name="password" className="h-12" />
          </FormField>
          
          <FormField label="Confirmar contraseña" name="confirmPassword" field={field("confirmPassword")}>
            <Input type="password" name="confirmPassword" className="h-12" />
          </FormField>
          
          <FormSubmit 
            fetchStatus={fetchStatus} 
            className="w-full h-12 bg-primary text-white"
            buttonProps={{ label: "Actualizar contraseña" }} 
          />
        </Form>
      </Card>
    </div>
  );
}

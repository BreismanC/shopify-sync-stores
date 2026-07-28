"use client";

import { Suspense, useState, useRef } from "react";
import { toast } from "sonner";
import { useRouter, useSearchParams } from "next/navigation";
import { KeyRound, ArrowLeft, Eye, EyeOff } from "lucide-react";
import { Form, FormField, FormSubmit } from "@/components/ui/Form";
import { Input } from "@/components/ui/Input";
import { useFormDynamic } from "@/hooks/use-dynamic-form";
import { resetPasswordSchema } from "@/schemas/auth";
import { validateFormData } from "@/utils/web-validation";
import { Card } from "@/components/ui/Card";
import { BACKEND_URL } from "@/lib/env";

function PasswordRecoveryResetInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token");
  const formRef = useRef<HTMLFormElement>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

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
        `${BACKEND_URL}/api/auth/reset-password`,
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
    <div className="flex min-h-screen w-full flex-col items-center justify-center p-4 sm:p-6 bg-gray-2">
      <main className="flex w-full max-w-md flex-col items-center justify-center">
        <Card className="w-full rounded-xl border border-gray-6 bg-gray-1 p-6 sm:p-8 shadow-none">
          <div className="flex flex-col items-center text-center">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-accent-9/10 text-accent-9 mb-6">
              <KeyRound className="w-8 h-8" strokeWidth={1.75} />
            </div>
            <h1 className="text-gray-12 text-2xl font-extrabold tracking-tight">
              Restablecer Contraseña
            </h1>
            <p className="mt-3 text-gray-11 text-sm leading-relaxed">
              Introduce tu nueva contraseña para acceder a tu cuenta.
            </p>
          </div>

          <Form
            onSubmit={handleSubmit}
            ref={formRef}
            errors={errors!}
            className="mt-8 space-y-6 [&_label]:block [&_label]:text-sm [&_label]:font-semibold [&_label]:leading-normal [&_label]:pb-2 [&_label]:text-gray-12 [&_[data-slot=input]]:h-12 [&_[data-slot=input]]:bg-gray-3 [&_[data-slot=input]]:border [&_[data-slot=input]]:border-gray-6 [&_[data-slot=input]]:rounded-lg [&_[data-slot=input]]:text-gray-12 [&_[data-slot=input]]:placeholder:text-gray-11 [&_[data-slot=input]]:focus:outline-none [&_[data-slot=input]]:focus:border-accent-9 [&_[data-slot=input]]:focus:ring-2 [&_[data-slot=input]]:focus:ring-accent-9/50"
          >
            <div className="space-y-4">
              <div className="relative w-full">
                <FormField
                  name="password"
                  label="Nueva contraseña"
                  field={field("password")}
                >
                  <Input
                    type={showPassword ? "text" : "password"}
                    className="pr-10"
                    placeholder="Introduce tu nueva contraseña"
                  />
                </FormField>
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-2/3 right-0 flex items-center pr-3 text-gray-11 hover:text-gray-12 transition-colors"
                  aria-label="Mostrar/Ocultar contraseña"
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>

              <div className="relative w-full">
                <FormField
                  name="confirmPassword"
                  label="Confirmar contraseña"
                  field={field("confirmPassword")}
                >
                  <Input
                    type={showConfirmPassword ? "text" : "password"}
                    className="pr-10"
                    placeholder="Confirma tu nueva contraseña"
                  />
                </FormField>
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute inset-y-2/3 right-0 flex items-center pr-3 text-gray-11 hover:text-gray-12 transition-colors"
                  aria-label="Mostrar/Ocultar contraseña"
                >
                  {showConfirmPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            <div className="pt-2">
              <FormSubmit
                fetchStatus={fetchStatus}
                className="w-full h-12 font-bold text-sm bg-accent-9 hover:bg-accent-10 text-white rounded-lg shadow-sm uppercase tracking-wide hover:!transform-none active:!transform-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-9"
                buttonProps={{ label: "Actualizar contraseña" }}
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
              Volver al inicio de sesión
            </button>
          </div>
        </Card>
      </main>
    </div>
  );
}

export default function PasswordRecoveryReset() {
  return (
    <Suspense fallback={<div className="flex min-h-screen items-center justify-center bg-gray-2 text-gray-11">Cargando...</div>}>
      <PasswordRecoveryResetInner />
    </Suspense>
  );
}

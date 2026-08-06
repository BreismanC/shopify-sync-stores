"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { KeyRound, Pencil } from "lucide-react";
import { toast } from "sonner";

import DialogModal from "@/components/DialogModal";
import { Avatar, AvatarFallback } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardTitle } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { apiFetch } from "@/lib/auth";
import { getFullName, getInitials, splitFullName } from "@/utils/data-view";

type Profile = {
  id: string;
  name: string;
  email: string;
  role: string;
  createdAt: string;
};

export default function ProfileClient() {
  const { data: session, update } = useSession();
  const accessToken = session?.accessToken;
  const [profile, setProfile] = useState<Profile | null>(null);
  const [editOpen, setEditOpen] = useState(false);
  const [passwordOpen, setPasswordOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  useEffect(() => {
    if (!accessToken) return;

    void apiFetch<Profile>("/api/auth/me", {}, accessToken)
      .then((data) => {
        setProfile(data);
        setName(data.name);
        setEmail(data.email);
      })
      .catch((error) => {
        toast.error(error instanceof Error ? error.message : "No fue posible cargar el perfil");
      });
  }, [accessToken]);

  const saveProfile = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsSaving(true);

    try {
      const data = await apiFetch<Profile>(
        "/api/auth/me/profile",
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name, email }),
        },
        accessToken,
      );

      setProfile(data);
      setEditOpen(false);
      await update({
        user: { ...session?.user, name: data.name, email: data.email },
      });
      toast.success("Perfil actualizado correctamente");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No fue posible actualizar el perfil");
    } finally {
      setIsSaving(false);
    }
  };

  const savePassword = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsSaving(true);

    try {
      await apiFetch(
        "/api/auth/me/password",
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ password, confirmPassword }),
        },
        accessToken,
      );

      setPassword("");
      setConfirmPassword("");
      setPasswordOpen(false);
      toast.success("Contraseña actualizada correctamente");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No fue posible actualizar la contraseña");
    } finally {
      setIsSaving(false);
    }
  };

  if (!profile) {
    return <div className="mx-auto w-full max-w-[1440px] px-4 py-5 text-sm text-gray-11 sm:px-6 lg:px-8">Cargando perfil...</div>;
  }

  const names = splitFullName(profile.name);
  const role = profile.role === "OWNER" ? "Propietario" : profile.role === "ADMIN" ? "Administrador" : "Miembro";

  return (
    <main className="mx-auto w-full max-w-[1440px] px-4 py-5 sm:px-6 lg:px-8">
      <header className="border-b border-gray-6 pb-5">
        <h1 className="text-[32px] font-bold leading-tight tracking-tight text-gray-12">Mi perfil</h1>
        <p className="mt-1 text-base text-gray-11">Administra tu información personal y tus credenciales de acceso.</p>
      </header>

      <div className="mt-6 grid grid-cols-1 gap-6">
        <Card className="relative rounded-lg border border-gray-6 bg-gray-1 p-6 shadow-sm">
          <CardTitle className="text-xl font-semibold tracking-tight text-gray-12">Información del perfil</CardTitle>
          <CardContent className="mt-6 p-0">
            <div className="grid gap-6 sm:grid-cols-[auto_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)] sm:items-start">
              <Avatar className="size-12 shrink-0">
                <AvatarFallback>{getInitials(names.firstName, names.lastName)}</AvatarFallback>
              </Avatar>
              <div className="grid gap-5">
                <Info label="Nombre completo" value={getFullName(names.firstName, names.lastName)} />
                <Info label="Correo electrónico" value={profile.email} />
              </div>
              <Info label="Rol" value={role} />
              <Info label="Fecha de registro" value={new Date(profile.createdAt).toLocaleDateString()} />
            </div>
          </CardContent>
          <Button mode="link" className="absolute right-5 top-5" aria-label="Editar perfil" onClick={() => setEditOpen(true)}>
            <Pencil className="size-4" />
          </Button>
        </Card>

        <Card className="rounded-lg border border-gray-6 bg-gray-1 p-6 shadow-sm">
          <CardTitle className="text-xl font-semibold tracking-tight text-gray-12">Seguridad</CardTitle>
          <CardContent className="p-0">
            <p className="mt-2 text-sm text-gray-11">Administra las credenciales de acceso a tu cuenta.</p>
            <Button className="mt-5 px-4" onClick={() => setPasswordOpen(true)}>
              <KeyRound className="mr-1 size-4" />
              Cambiar contraseña
            </Button>
          </CardContent>
        </Card>
      </div>

      <DialogModal
        container="smosh"
        open={editOpen}
        onOpenChange={setEditOpen}
        title="Editar perfil"
        description="Actualiza tu información personal."
      >
        <form onSubmit={saveProfile} className="flex flex-col gap-4">
          <ProfileField label="Nombre completo">
            <Input value={name} onChange={(event) => setName(event.target.value)} required className="h-12 bg-accent-2 focus:ring-accent-7" />
          </ProfileField>
          <ProfileField label="Correo electrónico">
            <Input type="email" inputMode="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} required className="h-12 bg-accent-2 focus:ring-accent-7" />
          </ProfileField>
          <div className="flex justify-end gap-2 pt-1">
            <Button type="button" mode="link" onClick={() => setEditOpen(false)}>Cancelar</Button>
            <Button type="submit" className="px-4" isLoading={isSaving}>Guardar cambios</Button>
          </div>
        </form>
      </DialogModal>

      <DialogModal
        container="smosh"
        open={passwordOpen}
        onOpenChange={setPasswordOpen}
        title="Cambiar contraseña"
        description="Introduce tu nueva contraseña. Debe tener al menos 6 caracteres."
      >
        <form onSubmit={savePassword} className="flex flex-col gap-4">
          <ProfileField label="Nueva contraseña">
            <Input type="password" autoComplete="new-password" minLength={6} value={password} onChange={(event) => setPassword(event.target.value)} required className="h-12 bg-accent-2 focus:ring-accent-7" />
          </ProfileField>
          <ProfileField label="Confirmar contraseña">
            <Input type="password" autoComplete="new-password" minLength={6} value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} required className="h-12 bg-accent-2 focus:ring-accent-7" />
          </ProfileField>
          <div className="flex justify-end gap-2 pt-1">
            <Button type="button" mode="link" onClick={() => setPasswordOpen(false)}>Cancelar</Button>
            <Button type="submit" className="px-4" isLoading={isSaving}>Guardar cambios</Button>
          </div>
        </form>
      </DialogModal>
    </main>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <p className="text-xs font-bold uppercase tracking-wider text-gray-11">{label}</p>
      <p className="mt-1 truncate text-sm text-gray-12">{value}</p>
    </div>
  );
}

function ProfileField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1 text-xs font-bold uppercase tracking-wider text-gray-11">
      {label}
      {children}
    </label>
  );
}

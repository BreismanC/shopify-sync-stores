import { auth } from "@/auth";

export default async function ProfilePage() {
  const session = await auth();

  return (
    <div>
      <h2 className="text-2xl font-bold text-gray-900">Perfil</h2>
      <p className="text-gray-600 mt-1">
        Sesión iniciada como {session?.user?.email ?? "invitado"}.
      </p>
    </div>
  );
}
"use client";

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';

interface Tenant {
  id: string;
  name: string;
}

export default function TenantSelectorPage() {
  const router = useRouter();
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSelecting, setIsSelecting] = useState(false);

  useEffect(() => {
    fetchMyTenants();
  }, []);

  const fetchMyTenants = async () => {
    try {
      const response = await fetch('/api/auth/tenant', {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
      });

      if (!response.ok) {
        throw new Error('Error al obtener tenants');
      }

      const data = await response.json();
      
      if (data.tenants && data.tenants.length > 0) {
        setTenants(data.tenants);
      } else {
        // No tiene múltiples tenants, redirigir a onboarding
        router.push('/onboarding');
      }
    } catch (err) {
      console.error('Error fetching tenants:', err);
      toast.error('Error al cargar tus empresas');
      router.push('/dashboard');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSelectTenant = async (tenantId: string) => {
    setIsSelecting(true);

    try {
      const response = await fetch('/api/auth/tenant/select', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tenantId }),
      });

      if (!response.ok) {
        throw new Error('Error al seleccionar tenant');
      }

      toast.success('Empresa seleccionada correctamente');
      
      // Redirect to dashboard after selecting tenant
      setTimeout(() => {
        window.location.href = '/dashboard';
      }, 500);
    } catch (err: any) {
      toast.error(err.message || 'Error al seleccionar empresa');
      setIsSelecting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-gray-50">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mb-4" />
        <p className="text-gray-600">Cargando tus empresas...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="w-full max-w-lg space-y-8">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900">Selecciona tu empresa</h1>
          <p className="text-gray-600 mt-2">
            Tienes acceso a múltiples empresas. Selecciona con cuál quieres trabajar.
          </p>
        </div>

        <div className="space-y-4">
          {tenants.map((tenant) => (
            <Card 
              key={tenant.id} 
              className="p-6 cursor-pointer hover:bg-gray-50 transition-colors border-2 hover:border-primary"
              onClick={() => handleSelectTenant(tenant.id)}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                    <span className="text-lg font-semibold text-primary">
                      {tenant.name.charAt(0).toUpperCase()}
                    </span>
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-900">{tenant.name}</h3>
                    <p className="text-sm text-gray-500">ID: {tenant.id.slice(0, 8)}...</p>
                  </div>
                </div>
                <Button 
                  variant="fill"
                  className="bg-primary text-white"
                  isLoading={isSelecting}
                >
                  Seleccionar
                </Button>
              </div>
            </Card>
          ))}
        </div>

        <div className="text-center">
          <p className="text-sm text-gray-500">
            ¿No encuentras la empresa que buscas?{' '}
            <button 
              onClick={() => router.push('/onboarding')}
              className="text-primary hover:underline font-medium"
            >
              Crea una nueva
            </button>
          </p>
        </div>
      </div>
    </div>
  );
}
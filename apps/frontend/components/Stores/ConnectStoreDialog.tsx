'use client';

import * as React from 'react';
import {
  KeyRound,
  Mail,
  ArrowLeft,
  CheckCircle2,
} from 'lucide-react';
import { toast } from 'sonner';

import { useSession } from 'next-auth/react';
import { apiFetch } from '@/lib/auth/fetch-with-auth';
import { BACKEND_URL } from '@/lib/env';

import DialogModal from '@/components/DialogModal';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Form, FormField, FormSubmit } from '@/components/ui/Form';
import { useFormDynamic } from '@/hooks/use-dynamic-form';
import {
  connectByStoreKeySchema,
  inviteByEmailSchema,
} from '@/schemas/store-connection';
import { validateFormData } from '@/utils/web-validation';
import type { CurrentStore } from '@/lib/store/current';
import type {
  InviteByEmailResponse,
  StoreConnectionCreateResponse,
} from './types';

type View = 'choice' | 'email' | 'key';

interface ConnectStoreDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentStore: CurrentStore | null;
  onConnected: () => void;
}

function counterpartyLabel(role: 'SOURCE' | 'VENDOR'): string {
  return role === 'SOURCE' ? 'Vendor' : 'Source';
}

export function ConnectStoreDialog({
  open,
  onOpenChange,
  currentStore,
  onConnected,
}: ConnectStoreDialogProps) {
  const { data: session } = useSession();
  const accessToken = session?.accessToken;
  const role = (currentStore?.role ?? 'SOURCE') as 'SOURCE' | 'VENDOR';

  const [view, setView] = React.useState<View>('choice');
  const [inviteSuccess, setInviteSuccess] = React.useState(false);

  React.useEffect(() => {
    if (!open) {
      const t = setTimeout(() => {
        setView('choice');
        setInviteSuccess(false);
      }, 200);
      return () => clearTimeout(t);
    }
    return undefined;
  }, [open]);

  const closeDialog = React.useCallback(() => {
    onOpenChange(false);
  }, [onOpenChange]);

  const titles: Record<View, string> = {
    choice: 'Conectar tienda',
    email: 'Invitar por correo',
    key: 'Conectar con clave',
  };

  const descriptions: Record<View, string> = {
    choice:
      'Elegí cómo querés vincular una tienda contraparte a tu tienda actual.',
    email: `Le enviaremos por correo tu clave de tienda al destinatario ${counterpartyLabel(
      role,
    )} para que pueda conectarte. Esta acción no agrega la tienda hasta que el destinatario confirme.`,
    key: `Pegá la clave de tienda ${counterpartyLabel(
      role,
    )} que te compartieron para completar la conexión.`,
  };

  return (
    <DialogModal
      container="smosh"
      open={open}
      onOpenChange={onOpenChange}
      title={titles[view]}
      description={!inviteSuccess ? descriptions[view] : undefined}
      footer={null}
    >
      {view === 'choice' ? (
        <ChoiceView
          role={role}
          onChooseEmail={() => {
            setInviteSuccess(false);
            setView('email');
          }}
          onChooseKey={() => {
            setView('key');
          }}
        />
      ) : null}

      {view === 'email' && !inviteSuccess ? (
        <EmailInviteView
          role={role}
          accessToken={accessToken}
          onBack={() => setView('choice')}
          onCancel={closeDialog}
          onSuccess={() => {
            setInviteSuccess(true);
          }}
        />
      ) : null}

      {view === 'email' && inviteSuccess ? (
        <InviteSuccess
          onClose={() => {
            closeDialog();
          }}
        />
      ) : null}

      {view === 'key' ? (
        <StoreKeyConnectView
          role={role}
          accessToken={accessToken}
          onBack={() => setView('choice')}
          onCancel={closeDialog}
          onConnected={() => {
            toast.success('Tienda conectada');
            onConnected();
            closeDialog();
          }}
        />
      ) : null}
    </DialogModal>
  );
}

interface ChoiceViewProps {
  role: 'SOURCE' | 'VENDOR';
  onChooseEmail: () => void;
  onChooseKey: () => void;
}

function ChoiceView({ role, onChooseEmail, onChooseKey }: ChoiceViewProps) {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      <button
        type="button"
        onClick={onChooseEmail}
        className="group flex flex-col items-start gap-3 rounded-lg border border-gray-a6 bg-gray-1 p-4 text-left shadow-sm transition-colors hover:border-accent-7 hover:bg-accent-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-7"
      >
        <span className="flex size-10 items-center justify-center rounded-md bg-accent-3 text-accent-9 transition-colors group-hover:bg-accent-4">
          <Mail className="size-5" aria-hidden="true" />
        </span>
        <div className="flex flex-col gap-1">
          <span className="text-sm font-semibold text-gray-12">
            Invitar por correo
          </span>
          <span className="text-xs text-gray-11">
            Enviá un correo al {counterpartyLabel(role)} con tu clave de
            tienda. La conexión se completa cuando la otra parte la acepte.
          </span>
        </div>
      </button>

      <button
        type="button"
        onClick={onChooseKey}
        className="group flex flex-col items-start gap-3 rounded-lg border border-gray-a6 bg-gray-1 p-4 text-left shadow-sm transition-colors hover:border-accent-7 hover:bg-accent-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-7"
      >
        <span className="flex size-10 items-center justify-center rounded-md bg-accent-3 text-accent-9 transition-colors group-hover:bg-accent-4">
          <KeyRound className="size-5" aria-hidden="true" />
        </span>
        <div className="flex flex-col gap-1">
          <span className="text-sm font-semibold text-gray-12">
            Conectar con clave
          </span>
          <span className="text-xs text-gray-11">
            Pegá la clave de tienda {counterpartyLabel(role)} que te
            compartieron para vincularla ahora mismo.
          </span>
        </div>
      </button>
    </div>
  );
}

function BackAndCancel({
  onBack,
  onCancel,
  backDisabled,
}: {
  onBack: () => void;
  onCancel: () => void;
  backDisabled?: boolean;
}) {
  return (
    <div className="flex justify-between gap-2 pt-3">
      <Button
        type="button"
        mode="pill"
        onClick={onBack}
        isDisabled={backDisabled}
        aria-label="Volver"
      >
        <ArrowLeft className="size-3" aria-hidden="true" />
        Volver
      </Button>
      <Button
        type="button"
        mode="link"
        onClick={onCancel}
        aria-label="Cancelar"
      >
        Cancelar
      </Button>
    </div>
  );
}

interface EmailInviteViewProps {
  role: 'SOURCE' | 'VENDOR';
  accessToken?: string;
  onBack: () => void;
  onCancel: () => void;
  onSuccess: () => void;
}

function EmailInviteView({
  role,
  accessToken,
  onBack,
  onCancel,
  onSuccess,
}: EmailInviteViewProps) {
  const formRef = React.useRef<HTMLFormElement>(null);
  const { field, getValues, setFetchStatus, fetchStatus, setTouch, setError } =
    useFormDynamic({
      email: 'text',
    });

  const values = getValues();
  const { isValid, errors } = validateFormData(inviteByEmailSchema, values);

  const onSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!isValid) {
      setTouch({ email: true });
      setError('Ingresá un correo válido');
      return;
    }
    setFetchStatus('loading');
    try {
      await apiFetch<InviteByEmailResponse>(
        `${BACKEND_URL}/api/stores/connections/email`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: String(values.email).trim(),
            counterpartyRole: counterpartyLabel(role),
          }),
        },
        accessToken,
      );
      setFetchStatus('success');
      toast.success('Invitación enviada');
      onSuccess();
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'No se pudo enviar la invitación';
      setFetchStatus('error');
      setError(message);
      toast.error(message);
    }
  };

  return (
    <Form
      onSubmit={onSubmit}
      ref={formRef}
      errors={errors ?? undefined}
      id="connect-store-email-form"
      className="flex flex-col gap-4"
    >
      <FormField
        name="email"
        label={`Correo del destinatario (${counterpartyLabel(role)})`}
        field={field('email')}
      >
        <Input
          type="email"
          inputMode="email"
          autoComplete="email"
          className="h-12 bg-accent-2 focus:ring-accent-7"
          placeholder={`contacto@${counterpartyLabel(role).toLowerCase()}.com`}
        />
      </FormField>
      <p className="text-xs text-gray-11">
        Sólo compartiremos tu clave de tienda con el destinatario. La tienda
        no se agregará hasta que la otra parte confirme.
      </p>
      <div className="flex items-center justify-between gap-2 pt-1">
        <Button
          type="button"
          mode="pill"
          onClick={onBack}
          aria-label="Volver"
        >
          <ArrowLeft className="size-3" aria-hidden="true" />
          Volver
        </Button>
        <FormSubmit
          form="connect-store-email-form"
          fetchStatus={fetchStatus}
          buttonProps={{ label: 'Enviar invitación' }}
          disabled={fetchStatus === 'loading'}
          className="px-4"
        />
      </div>
      <div className="sr-only">
        <Button type="button" mode="link" onClick={onCancel}>
          Cancelar
        </Button>
      </div>
    </Form>
  );
}

interface StoreKeyConnectViewProps {
  role: 'SOURCE' | 'VENDOR';
  accessToken?: string;
  onBack: () => void;
  onCancel: () => void;
  onConnected: () => void;
}

function StoreKeyConnectView({
  role,
  accessToken,
  onBack,
  onCancel,
  onConnected,
}: StoreKeyConnectViewProps) {
  const formRef = React.useRef<HTMLFormElement>(null);
  const { field, getValues, setFetchStatus, fetchStatus, setTouch, setError } =
    useFormDynamic({
      storeKey: 'text',
    });

  const values = getValues();
  const { isValid, errors } = validateFormData(
    connectByStoreKeySchema,
    values,
  );

  const onSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!isValid) {
      setTouch({ storeKey: true });
      setError('Ingresá la clave de tienda');
      return;
    }
    setFetchStatus('loading');
    try {
      await apiFetch<StoreConnectionCreateResponse>(
        `${BACKEND_URL}/api/stores/connections`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            storeKey: String(values.storeKey).trim(),
          }),
        },
        accessToken,
      );
      setFetchStatus('success');
      onConnected();
    } catch (err) {
      const message =
        err instanceof Error
          ? err.message
          : 'No se pudo completar la conexión';
      setFetchStatus('error');
      setError(message);
      toast.error(message);
    }
  };

  return (
    <Form
      onSubmit={onSubmit}
      ref={formRef}
      errors={errors ?? undefined}
      id="connect-store-key-form"
      className="flex flex-col gap-4"
    >
      <FormField
        name="storeKey"
        label={`Clave de tienda del ${counterpartyLabel(role)}`}
        field={field('storeKey')}
      >
        <Input
          type="text"
          autoComplete="off"
          className="h-12 bg-accent-2 font-mono focus:ring-accent-7"
          placeholder="ej. abc12345xyz"
        />
      </FormField>
      <p className="text-xs text-gray-11">
        Pedile al {counterpartyLabel(role)} que comparta la clave desde su
        panel principal (tienda). Es un código alfanumérico de 8 a 64
        caracteres.
      </p>
      <BackAndCancel onBack={onBack} onCancel={onCancel} />
      <div className="flex justify-end">
        <FormSubmit
          form="connect-store-key-form"
          fetchStatus={fetchStatus}
          buttonProps={{ label: 'Conectar' }}
          disabled={fetchStatus === 'loading'}
          className="px-4"
        />
      </div>
    </Form>
  );
}

function InviteSuccess({ onClose }: { onClose: () => void }) {
  return (
    <div className="flex flex-col items-center gap-3 py-2">
      <span className="flex size-12 items-center justify-center rounded-full bg-accent-2 text-accent-9">
        <CheckCircle2 className="size-6" aria-hidden="true" />
      </span>
      <div className="flex flex-col items-center gap-1 text-center">
        <span className="text-sm font-medium text-gray-12">
          Invitación enviada correctamente
        </span>
        <span className="text-xs text-gray-11">
          La tienda no se agregará hasta que el destinatario confirme la
          conexión.
        </span>
      </div>
      <Button onClick={onClose} className="px-4">
        Cerrar
      </Button>
    </div>
  );
}

export default ConnectStoreDialog;

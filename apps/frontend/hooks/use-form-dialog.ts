'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';

interface UseFormDialogProps {
  formId: string;
}

interface FormDataConfig {
  isValid: boolean;
  touchForm: () => void;
  setError: (error: string) => void;
}

export interface UseFormDialogOptions {
  event: React.FormEvent<HTMLFormElement>;
  url: string;
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  body?: unknown;
  headers?: HeadersInit;
  customValidation?: () => Promise<boolean> | boolean;
  formData?: FormDataConfig;
  successMessage?: string;
  errorMessage?: string;
  onSuccess?: (data: any) => void | Promise<void>;
}

export function useFormDialog<T = any>({ formId }: UseFormDialogProps) {
  const router = useRouter();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [fetchStatus, setFetchStatus] = useState<
    'idle' | 'loading' | 'success' | 'error'
  >('idle');
  const [data, setData] = useState<T | null>(null);

  const handleCancel = useCallback(() => {
    setIsModalOpen(false);
    setIsSuccess(false);
    setData(null);
    setFetchStatus('idle');
  }, []);

  const handleSuccess = useCallback(() => {
    setIsModalOpen(false);
    setIsSuccess(false);
    setData(null);
    setFetchStatus('idle');
  }, []);

  useEffect(() => {
    if (!isModalOpen) {
      setIsSuccess(false);
      setData(null);
      setFetchStatus('idle');
    }
  }, [isModalOpen]);

  const submitForm = useCallback(
    async (options: UseFormDialogOptions): Promise<void> => {
      const {
        event,
        url,
        method = 'POST',
        body,
        headers,
        customValidation,
        formData,
        successMessage,
        errorMessage = 'Ocurrió un error. Por favor, intentalo de nuevo.',
        onSuccess,
      } = options;

      event.preventDefault();
      setFetchStatus('loading');

      if (customValidation) {
        try {
          const isValidCustom = await customValidation();
          if (!isValidCustom) {
            setFetchStatus('error');
            return;
          }
        } catch (error) {
          console.error('Custom validation error:', error);
          setFetchStatus('error');
          return;
        }
      }

      if (formData) {
        if (!formData.isValid) {
          setFetchStatus('error');
          formData.touchForm();
          formData.setError('Por favor completá todos los campos requeridos');
          return;
        }
      }

      try {
        const fetchOptions: RequestInit = {
          method,
          headers: {
            'Content-Type': 'application/json',
            ...headers,
          },
        };

        if (body && ['POST', 'PUT', 'PATCH'].includes(method)) {
          fetchOptions.body = JSON.stringify(body);
        }

        const response = await fetch(url, fetchOptions);

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(
            errorData.error ||
              errorData.message ||
              `HTTP Error: ${response.status}`,
          );
        }

        const responseData = await response.json();

        setFetchStatus('success');
        setData(responseData);

        if (successMessage) {
          toast.success(successMessage);
        }

        if (onSuccess) {
          await onSuccess(responseData);
        }

        router.refresh();

        setTimeout(() => {
          setIsSuccess(true);
        }, 300);
      } catch (error) {
        console.error('Form submission error:', error);
        setFetchStatus('error');

        if (formData) {
          formData.setError(
            error instanceof Error ? error.message : 'Error desconocido',
          );
        }

        toast.error(errorMessage);
      }
    },
    [router],
  );

  return {
    router,
    isModalOpen,
    setIsModalOpen,
    isSuccess,
    setIsSuccess,
    fetchStatus,
    setFetchStatus,
    data,
    setData,
    handleCancel,
    handleSuccess,
    formId,
    submitForm,
  };
}

export type UseFormDialogReturn<T = any> = ReturnType<
  typeof useFormDialog<T>
>;

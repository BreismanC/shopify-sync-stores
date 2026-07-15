'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';

import DialogModal from '@/components/DialogModal';
import { Button } from '@/components/ui/Button';
import { FormSubmit } from '@/components/ui/Form';
import type { UseFormDialogReturn } from '@/hooks/use-form-dialog';
import type { AuraContainer } from '@/components/ui/Section';

interface FormDialogProps<T = any> extends UseFormDialogReturn<T> {
  container?: AuraContainer;

  trigger?: React.ReactNode;

  titleCustom?: React.ReactNode;
  titleText?: string;
  titleSuccess?: string;

  descriptionCustom?: React.ReactNode;
  descriptionText?: string;
  descriptionSuccess?: string;

  footerCustom?: React.ReactNode;
  submitLabel?: string;
  successLabel?: string;

  children: React.ReactNode;
  className?: string;
  formSubmitDisabled?: boolean;
  customSubmitForm?: (event: React.MouseEvent<HTMLButtonElement>) => void;
  showCancelButton?: boolean;
  cancelLabel?: string;
}

export function FormDialog<T = any>({
  isModalOpen,
  setIsModalOpen,
  isSuccess,
  fetchStatus,
  handleCancel,
  handleSuccess,
  formId,
  formSubmitDisabled = false,

  container = 'smash',
  trigger,
  titleCustom,
  titleText,
  titleSuccess,
  descriptionCustom,
  descriptionText,
  descriptionSuccess,
  footerCustom,
  submitLabel = 'Enviar',
  successLabel = 'Aceptar',
  customSubmitForm,
  showCancelButton = true,
  cancelLabel = 'Cancelar',
  children,
  className,
}: FormDialogProps<T>) {
  const router = useRouter();

  const handleOpenChange = React.useCallback(
    (open: boolean) => {
      setIsModalOpen(open);
      if (!open) {
        handleCancel();
        router.refresh();
      }
    },
    [setIsModalOpen, handleCancel, router],
  );

  const getTitle = () => {
    if (titleCustom) return titleCustom;
    if (isSuccess) return titleSuccess || titleText || '';
    return titleText || '';
  };

  const getDescription = () => {
    if (descriptionCustom) return descriptionCustom;
    if (isSuccess) return descriptionSuccess || '';
    return descriptionText || '';
  };

  const getFooter = () => {
    if (footerCustom) return footerCustom;

    if (isSuccess) {
      return (
        <div className="flex gap-2 justify-end">
          <Button onClick={handleSuccess} className="px-4">
            {successLabel}
          </Button>
        </div>
      );
    }

    return (
      <div className="flex gap-2 justify-end">
        {showCancelButton ? (
          <Button
            type="button"
            mode="pill"
            onClick={handleCancel}
            className="px-4"
          >
            {cancelLabel}
          </Button>
        ) : null}
        {customSubmitForm ? (
          <FormSubmit
            type="button"
            fetchStatus={fetchStatus}
            buttonProps={{ label: submitLabel, onClick: customSubmitForm }}
            form={formId}
            disabled={formSubmitDisabled}
            className="px-4"
          />
        ) : (
          <FormSubmit
            disabled={formSubmitDisabled}
            fetchStatus={fetchStatus}
            buttonProps={{ label: submitLabel }}
            form={formId}
            className="px-4"
          />
        )}
      </div>
    );
  };

  return (
    <DialogModal
      container={container}
      className={className}
      trigger={trigger}
      open={isModalOpen}
      onOpenChange={handleOpenChange}
      title={getTitle()}
      description={getDescription()}
      footer={getFooter()}
    >
      <div className="py-1">{children}</div>
    </DialogModal>
  );
}

export default FormDialog;

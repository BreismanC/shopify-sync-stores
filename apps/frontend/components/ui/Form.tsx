import * as React from "react";
import { ErrorObject } from "ajv";
import { Form as FormRadix } from "radix-ui";
import { ChevronDownIcon, SymbolIcon } from "@radix-ui/react-icons";

import { FieldProps } from "@/hooks/use-dynamic-form";
import AlertStatus from "@/components/AlertStatus";
import Button, { ButtonProps } from "@/components/ui/Button";
import {
  Checkbox,
  CheckboxGroup,
  CheckboxGroupItem,
} from "@/components/ui/Checkbox";
import { Switch } from "@/components/ui/Switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./Select";
import { cn } from "@/utils/class-names";
import { RadioGroup, RadioGroupItem } from "@/components/ui/RadioGroup";

interface FormProps extends FormRadix.FormProps {
  errors?: ErrorObject<string, Record<string, any>, unknown>[];
}
export const Form = React.forwardRef<HTMLFormElement, FormProps>(
  ({ children, errors, ...props }, forwardedRef) => {
    const childrenArray = React.Children.toArray(children);

    const processChildren = (
      children: React.ReactNode[]
    ): React.ReactNode[] => {
      return children.map((child) => {
        if (!React.isValidElement(child)) {
          return child;
        }

        if ((child.props as any)?.field) {
          const fieldErrors = errors?.filter(
            (error) => error.instancePath.slice(1) === (child.props as any)?.field?.name
          );

          const childProps = child.props as any;
          return React.cloneElement(child as React.ReactElement, {
            ...childProps,
            errors: fieldErrors,
          });
        }

        if ((child.props as any)?.children) {
          const processedChildren = processChildren(
            React.Children.toArray((child.props as any).children)
          );
          return React.cloneElement(child as React.ReactElement, {
            ...(child.props as any),
            children: processedChildren,
          });
        }

        return child;
      });
    };

    return (
      <FormRadix.Root {...props} ref={forwardedRef}>
        {processChildren(childrenArray)}
      </FormRadix.Root>
    );
  }
);

interface FormSubmitProps extends FormRadix.FormSubmitProps {
  buttonProps?: ButtonProps;
  fetchStatus?: "idle" | "loading" | "success" | "error";
}

export const FormSubmit = React.forwardRef<HTMLButtonElement, FormSubmitProps>(
  ({ buttonProps, fetchStatus, ...props }, forwardedRef) => {
    return (
      <FormRadix.Submit {...props} ref={forwardedRef} asChild>
        <Button
          {...buttonProps}
          isLoading={fetchStatus === "loading"}
          isLoadingText={
            <>
              <SymbolIcon className="icon animate-spin" />
            </>
          }
          className="min-w-10"
        />
      </FormRadix.Submit>
    );
  }
);

interface FormFieldProps extends Partial<FormRadix.FormFieldProps> {
  label: React.ReactNode;
  labelProps?: FormRadix.FormLabelProps;
  controlProps?: FormRadix.FormControlProps;
  field?: FieldProps;
  errors?: ErrorObject<string, Record<string, any>, unknown>[];
}

export const FormField = React.forwardRef<HTMLDivElement, FormFieldProps>(
  (
    { labelProps, label, controlProps, children, field, errors, ...props },
    forwardedRef
  ) => {
    const classNameConnect: string[] = ["flex flex-col gap-0.5"];
    const hasError = field?.touch && errors && errors.length > 0;
    const hasSelect = React.Children.toArray(children).some(
      (child: any) => child?.type === "select"
    );

    if (props.className) {
      classNameConnect.push(props.className);
    }

    const name = props.name || field?.name;

    return (
      <FormRadix.Field
        className={classNameConnect.join(" ")}
        name={name || ''}
        {...props}
        serverInvalid={hasError}
        ref={forwardedRef}
      >
        {label && <FormRadix.Label {...labelProps}>{label}</FormRadix.Label>}
        <div className="relative ">
          <FormRadix.Control
            {...controlProps}
            onChange={field?.onChange}
            asChild={Boolean(children)}
          >
            {children}
          </FormRadix.Control>
          {hasSelect && (
            <div className="absolute top-1/2 -translate-y-1/2 right-2 pointer-events-none">
              <ChevronDownIcon className="icon" />
            </div>
          )}
        </div>

        {hasError &&
          errors?.map((error, index) => (
            <FormRadix.Message className="text-warning-contrast" key={index}>
              {error.message}
            </FormRadix.Message>
          ))}
      </FormRadix.Field>
    );
  }
);

interface FormSwitchProps extends Partial<FormRadix.FormFieldProps> {
  id?: string;
  label: React.ReactNode;
  labelProps?: FormRadix.FormLabelProps;
  controlProps?: FormRadix.FormControlProps;
  field?: FieldProps;
  errors?: ErrorObject<string, Record<string, any>, unknown>[];
}

export const FormSwitch = React.forwardRef<HTMLDivElement, FormSwitchProps>(
  (
    { labelProps, label, controlProps, field, children, id, errors, ...props },
    forwardedRef
  ) => {
    const hasError = field?.touch && errors && errors.length > 0;
    const idConnect = id ? id : React.useId();
    const name = props.name || field?.name;

    return (
      <FormRadix.Field
        {...props}
        ref={forwardedRef}
        name={name || ''}
        serverInvalid={hasError}
      >
        <div className="flex items-center gap-1">
          {label && (
            <FormRadix.Label htmlFor={idConnect}>{label}</FormRadix.Label>
          )}
          <Switch
            id={idConnect}
            checked={Boolean(field?.value)}
            onCheckedChange={field?.onCheckedChange}
          />
        </div>
        <FormRadix.Control
          value="on"
          type="checkbox"
          checked={Boolean(field?.value)}
          onChange={field?.onCheckedChange}
          className="border-0 absolute w-px h-px p-0 -m-px overflow-hidden whitespace-nowrap break-normal clip-rect hidden"
        />
        {hasError &&
          errors?.map((error, index) => (
            <FormRadix.Message className="text-warning-contrast" key={index}>
              {error.message}
            </FormRadix.Message>
          ))}
      </FormRadix.Field>
    );
  }
);

interface FormCheckboxProps extends Partial<FormRadix.FormFieldProps> {
  id?: string;
  label: React.ReactNode;
  labelProps?: FormRadix.FormLabelProps;
  controlProps?: FormRadix.FormControlProps;
  field?: FieldProps;
  errors?: ErrorObject<string, Record<string, any>, unknown>[];
  disabled?: boolean;
}

export const FormCheckbox = React.forwardRef<HTMLDivElement, FormCheckboxProps>(
  (
    { labelProps, label, controlProps, field, children, id, errors, disabled, ...props },
    forwardedRef
  ) => {
    const hasError = field?.touch && errors && errors.length > 0;
    const idConnect = id ? id : React.useId();
    const name = props.name || field?.name;
    return (
      <FormRadix.Field
        {...props}
        ref={forwardedRef}
        name={name || ''}
        serverInvalid={hasError}
      >
        <div className="flex items-center gap-1">
          <div>
            <Checkbox
              id={idConnect}
              className="border border-gray-a6 flex size-1.5 items-center justify-center rounded outline-none hover:bg-accent-2"
              checked={Boolean(field?.value)}
              onCheckedChange={field?.onCheckedChange}
              disabled={disabled}
            />
          </div>
          {label && (
            <FormRadix.Label htmlFor={idConnect}>{label}</FormRadix.Label>
          )}
        </div>
        <FormRadix.Control
          value="on"
          type="checkbox"
          checked={Boolean(field?.value)}
          onChange={field?.onCheckedChange}
          className="border-0 absolute w-px h-px p-0 -m-px overflow-hidden whitespace-nowrap break-normal clip-rect hidden"
        />
        {hasError &&
          errors?.map((error, index) => (
            <FormRadix.Message className="text-warning-contrast" key={index}>
              {error.message}
            </FormRadix.Message>
          ))}
      </FormRadix.Field>
    );
  }
);

interface FormSelectProps extends Partial<FormRadix.FormFieldProps> {
  label?: React.ReactNode;
  labelProps?: FormRadix.FormLabelProps;
  triggerProps?: React.ComponentProps<typeof SelectTrigger>;
  controlProps?: FormRadix.FormControlProps;
  field?: FieldProps;
  errors?: ErrorObject<string, Record<string, any>, unknown>[];
  options: { value: string; label: string }[];
  placeholder?: string;
  triggerClassName?: string;
  disabled?: boolean;
}

export const FormSelect = React.forwardRef<HTMLDivElement, FormSelectProps>(
  (
    { labelProps, label, controlProps, field, errors, id, options, placeholder = "Selecciona un valor", triggerProps, disabled, ...props },
    forwardedRef
  ) => {
    const hasError = field?.touch && errors && errors.length > 0;
    const idConnect = id ? id : React.useId();
    const name = props.name || field?.name || "";
    const currentValue = (field?.value as string) || "";

    const handleValueChange = (value: string) => {
      if (field?.onChange && !disabled) {
        // Crear un evento sintético compatible con onChange
        const syntheticEvent = {
          target: { value, name: field.name },
        } as React.ChangeEvent<HTMLSelectElement>;
        field.onChange(syntheticEvent);
      }
    };

    return (
      <FormRadix.Field
        {...props}
        ref={forwardedRef}
        name={name || ''}
        serverInvalid={hasError}
        className={cn("flex flex-col gap-0.5", props.className)}
      >
        {label && <FormRadix.Label id={idConnect} {...labelProps}>{label}</FormRadix.Label>}
        <div className="relative flex-1">
          <Select
            name={name || ''}
            key={field?.value ? `status-${field?.value}` : `status-initial`}
            value={currentValue}
            onValueChange={handleValueChange}
            disabled={disabled}
          >
            <SelectTrigger {...triggerProps} disabled={disabled}>
              <div>
                <SelectValue placeholder={placeholder} />
              </div>
            </SelectTrigger>
            <SelectContent>
              {options.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <FormRadix.Control
            id={idConnect}
            value={currentValue}
            name={name || ''}
            {...controlProps}
            className="hidden"
          />
          {hasError &&
            errors?.map((error, index) => (
              <FormRadix.Message className="text-warning-contrast" key={index}>
                {error.message}
              </FormRadix.Message>
            ))}
        </div>
      </FormRadix.Field>
    );
  }
);


export interface CheckboxGroupOption {
  value: string;
  label: React.ReactNode;
  description?: React.ReactNode;
  disabled?: boolean;
}

interface FormCheckboxGroupProps extends Partial<FormRadix.FormFieldProps> {
  label?: React.ReactNode;
  labelProps?: FormRadix.FormLabelProps;
  controlProps?: FormRadix.FormControlProps;
  field?: FieldProps;
  errors?: ErrorObject<string, Record<string, any>, unknown>[];
  options: CheckboxGroupOption[];
  className?: string;
}

export const FormCheckboxGroup = React.forwardRef<
  HTMLDivElement,
  FormCheckboxGroupProps
>(
  (
    {
      label,
      labelProps,
      controlProps,
      field,
      errors,
      options,
      className,
      ...props
    },
    forwardedRef
  ) => {
    const hasError = field?.touch && errors && errors.length > 0;
    const name = props.name || field?.name || "";
    const fieldValue = Array.isArray(field?.value)
      ? (field?.value as string[])
      : [];

    const handleValueChange = React.useCallback(
      (value: string[]) => {
        if (field?.setValue) {
          // Checkbox groups use arrays, but field.setValue expects string | boolean
          // We'll cast it since checkbox groups specifically need array values
          field.setValue(value as any);
        }
      },
      [field]
    );

    return (
      <FormRadix.Field
        {...props}
        ref={forwardedRef}
        name={name || ''}
        serverInvalid={hasError}
        className={className}
      >
        {label && <FormRadix.Label {...labelProps}>{label}</FormRadix.Label>}
        <FormRadix.Control {...controlProps} asChild>
          <CheckboxGroup
            value={fieldValue}
            onValueChange={handleValueChange}
            className="flex flex-col gap-1 mt-1"
          >
            {options.map((option) => (
              <CheckboxGroupItem
                key={option.value}
                value={option.value}
                label={option.label}
                description={option.description}
                disabled={option.disabled}
              />
            ))}
          </CheckboxGroup>
        </FormRadix.Control>
        {hasError &&
          errors?.map((error, index) => (
            <FormRadix.Message className="text-warning-contrast" key={index}>
              {error.message}
            </FormRadix.Message>
          ))}
      </FormRadix.Field>
    );
  }
);

export interface RadioGroupOption {
  value: string;
  label: React.ReactNode;
  description?: React.ReactNode;
  disabled?: boolean;
}

interface FormRadioGroupProps extends Partial<FormRadix.FormFieldProps> {
  label?: React.ReactNode;
  labelProps?: FormRadix.FormLabelProps;
  controlProps?: FormRadix.FormControlProps;
  field?: FieldProps;
  errors?: ErrorObject<string, Record<string, any>, unknown>[];
  options: RadioGroupOption[];
  className?: string;
}

export const FormRadioGroup = React.forwardRef<
  HTMLDivElement,
  FormRadioGroupProps
>(
  (
    {
      label,
      labelProps,
      controlProps,
      field,
      errors,
      options,
      className,
      id,
      ...props
    },
    forwardedRef
  ) => {
    const hasError = field?.touch && errors && errors.length > 0;
    const idConnect = id ? id : React.useId();
    const name = props.name || field?.name || "";
    const fieldValue = field?.value ? String(field.value) : "";

    const handleValueChange = (value: string) => {
      if (field?.onChange) {
        // Create a synthetic event compatible with onChange
        const syntheticEvent = {
          target: { value, name: field.name },
        } as React.ChangeEvent<HTMLInputElement>;
        field.onChange(syntheticEvent);
      }
    };

    return (
      <FormRadix.Field
        {...props}
        ref={forwardedRef}
        name={name || ''}
        serverInvalid={hasError}
        className={className}
      >
        {label && <FormRadix.Label id={idConnect} {...labelProps}>{label}</FormRadix.Label>}
        <div className="flex flex-col gap-0.5 mt-1">
          <RadioGroup
            value={fieldValue}
            onValueChange={handleValueChange}
            className="flex flex-col gap-0.5"
          >
            {options.map((option) => {
              const optionId = `${name}-${option.value}`;
              return (
                <div
                  key={option.value}
                  className={cn(
                    "flex items-start gap-1",
                    option.disabled && "opacity-50 cursor-not-allowed"
                  )}
                >
                  <div>
                    <RadioGroupItem
                      value={option.value}
                      id={optionId}
                      disabled={option.disabled}
                    />
                  </div>
                  <div className="flex flex-col gap-0.5">
                    <label
                      htmlFor={optionId}
                      className="text-sm font-medium leading-none cursor-pointer"
                    >
                      {option.label}
                    </label>
                    {option.description && (
                      <p className="text-sm text-gray-11 m-0">
                        {option.description}
                      </p>
                    )}
                  </div>
                </div>
              );
            })}
          </RadioGroup>
          <FormRadix.Control
            id={idConnect}
            value={fieldValue}
            name={name || ''}
            {...controlProps}
            className="hidden"
          />
        </div>
        {hasError &&
          errors?.map((error, index) => (
            <FormRadix.Message className="text-warning-contrast" key={index}>
              {error.message}
            </FormRadix.Message>
          ))}
      </FormRadix.Field>
    );
  }
);


interface FormAlertProps {
  formData: any;
  className?: string;
}

export const FormAlert = ({ formData, className, ...props }: FormAlertProps) => {
  if (formData.fetchStatus !== "error") {
    return null;
  }

  if (!formData.error) {
    return null;
  }

  return (
    <AlertStatus status="danger" description={formData.error} />
  );
};
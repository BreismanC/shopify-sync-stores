"use client";
import { useRef, useEffect } from "react";
import { UserRoles, KnowledgeArea } from "@prisma/client";
import { createUserSchema } from "@/schemas";
import { SubmitFormOptions } from "@/hooks/use-form-dialog";
import { useFormDynamic } from "@/hooks/use-dynamic-form";
import { validateFormData } from "@/utils/web-validation";
import { formatKnowledgeArea } from "@/utils/data-view";
import { Form, FormAlert, FormField, FormSelect } from "@/components/ui/Form";
import { getAvailableRoleOptions } from "@/utils/user-helpers";

interface FormUserProps {
  formId: string;
  submitForm: (options: SubmitFormOptions) => Promise<void>;
  onSuccess?: () => void;
  currentUserRole?: UserRoles;
}

export const FormUser = ({
  formId,
  submitForm,
  onSuccess,
  currentUserRole,
}: FormUserProps) => {
  const formRef = useRef<HTMLFormElement>(null);

  const formData = useFormDynamic({
    firstName: "text",
    lastName: "text",
    userName: "text",
    email: "text",
    phone: "text",
    password: "text",
    role: "select",
    knowledgeArea: "select",
  });

  const { firstName, lastName, userName, email, phone, password, role, knowledgeArea } =
    formData.getFields();

  const { isValid, errors } = validateFormData(
    createUserSchema,
    formData.getValues()
  );

  const values = formData.getValues();
  const formErrors = errors || undefined;

  const handleOnSubmit = (event: React.FormEvent<HTMLFormElement>) =>
    submitForm({
      event,
      url: `/api/users`,
      method: "POST",
      body: {
        firstName: values.firstName,
        lastName: values.lastName,
        userName: values.userName,
        email: values.email,
        phone: values.phone || null,
        password: values.password,
        role: values.role,
        knowledgeArea: values.knowledgeArea || null,
        userType: "USER",
      },
      formData: {
        isValid,
        touchForm: formData.touchForm,
        setError: formData.setError,
      },
      successMessage: "Usuario creado correctamente",
      errorMessage: "Ocurrió un error al crear el usuario",
      onSuccess: onSuccess,
    });

  const roleOptions = getAvailableRoleOptions(currentUserRole);

  const knowledgeAreaOptions: { value: string; label: string }[] = Object.values(
    KnowledgeArea
  ).map((area) => ({
    value: area,
    label: formatKnowledgeArea(area),
  }));

  const shouldShowKnowledgeAreaField = role.value === "EXPERT";

  useEffect(() => {
    if (role.value !== "EXPERT") {
      knowledgeArea.setValue("");
    }
  }, [role.value]);

  console.log({formErrors})

  return (
    <Form
      className="space-y-2"
      onSubmit={handleOnSubmit}
      ref={formRef}
      errors={formErrors}
      id={formId}
    >
      <FormField
        label="Nombre"
        field={firstName}
        name="firstName"
      >
        <input
          type="text"
          placeholder="Ingrese el nombre"
          className="w-full px-1.5 py-1 border border-gray-6 rounded-md outline-none focus:border-accent-8"
        />
      </FormField>

      <FormField
        label="Apellidos"
        field={lastName}
        name="lastName"
      >
        <input
          type="text"
          placeholder="Ingrese los apellidos"
          className="w-full px-1.5 py-1 border border-gray-6 rounded-md outline-none focus:border-accent-8"
        />
      </FormField>

      <FormField
        label="Nombre de usuario"
        field={userName}
        name="userName"
      >
        <input
          type="text"
          placeholder="Ingrese el nombre de usuario"
          className="w-full px-1.5 py-1 border border-gray-6 rounded-md outline-none focus:border-accent-8"
        />
      </FormField>

      <FormField
        label="Email"
        field={email}
        name="email"
      >
        <input
          type="email"
          placeholder="Ingrese el correo electrónico"
          className="w-full px-1.5 py-1 border border-gray-6 rounded-md outline-none focus:border-accent-8"
        />
      </FormField>

      <FormField
        label="Teléfono"
        field={phone}
        name="phone"
      >
        <input
          type="tel"
          placeholder="Ingrese el teléfono (opcional)"
          className="w-full px-1.5 py-1 border border-gray-6 rounded-md outline-none focus:border-accent-8"
        />
      </FormField>

      <FormField
        label="Contraseña"
        field={password}
        name="password"
      >
        <input
          type="password"
          placeholder="Ingrese la contraseña"
          className="w-full px-1.5 py-1 border border-gray-6 rounded-md outline-none focus:border-accent-8"
        />
      </FormField>

      <FormSelect
        label="Rol"
        field={role}
        options={roleOptions}
        name="role"
        placeholder="Selecciona un rol"
        triggerProps={{ className: "w-full" }}
      />

      {shouldShowKnowledgeAreaField && (
        <FormSelect
          label="Área de conocimiento"
          field={knowledgeArea}
          options={knowledgeAreaOptions}
          name="knowledgeArea"
          placeholder="Selecciona un área de conocimiento"
          triggerProps={{ className: "w-full" }}
        />
      )}

      <FormAlert formData={formData} />
    </Form>
  );
};

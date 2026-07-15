export const inviteByEmailSchema = {
  type: 'object',
  properties: {
    email: { type: 'string', format: 'email' },
  },
  required: ['email'],
  additionalProperties: false,
  errorMessage: {
    properties: {
      email: 'Ingresá un correo válido',
    },
    required: {
      email: 'El correo es obligatorio',
    },
  },
};

export const connectByStoreKeySchema = {
  type: 'object',
  properties: {
    storeKey: {
      type: 'string',
      minLength: 8,
      maxLength: 64,
    },
  },
  required: ['storeKey'],
  additionalProperties: false,
  errorMessage: {
    properties: {
      storeKey: 'La clave de tienda debe tener entre 8 y 64 caracteres',
    },
    required: {
      storeKey: 'La clave de tienda es obligatoria',
    },
  },
};

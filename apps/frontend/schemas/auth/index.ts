export const registerSchema = {
  type: 'object',
  properties: {
    name: { type: 'string', minLength: 2 },
    email: { type: 'string', format: 'email' },
    companyName: { type: 'string', minLength: 3 },
    password: { type: 'string', minLength: 6 },
  },
  required: ['name', 'email', 'companyName', 'password'],
  additionalProperties: false,
};

export const loginSchema = {
  type: 'object',
  properties: {
    email: { type: 'string', format: 'email' },
    password: { type: 'string', minLength: 6 },
  },
  required: ['email', 'password'],
  additionalProperties: false,
  errorMessage: {
    properties: {
      email: "El formato del correo no es válido",
      password: "La contraseña debe tener al menos 6 caracteres"
    },
    required: "Por favor, completa todos los campos"
  }
};

export const forgotPasswordSchema = {
  type: 'object',
  properties: {
    email: { type: 'string', format: 'email' },
  },
  required: ['email'],
  additionalProperties: false,
  errorMessage: {
    properties: {
      email: "El formato del correo no es válido",
    },
    required: "El correo es obligatorio"
  }
};

export const resetPasswordSchema = {
  type: 'object',
  properties: {
    password: { type: 'string', minLength: 6 },
    confirmPassword: { type: 'string', minLength: 6 },
  },
  required: ['password', 'confirmPassword'],
  additionalProperties: false,
  errorMessage: {
    properties: {
      password: "La contraseña debe tener al menos 6 caracteres",
      confirmPassword: "La contraseña debe tener al menos 6 caracteres"
    },
    required: "Por favor, completa todos los campos"
  }
};

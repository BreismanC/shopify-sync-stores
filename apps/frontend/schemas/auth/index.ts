export const registerSchema = {
  type: 'object',
  properties: {
    name: { type: 'string', minLength: 2 },
    email: { type: 'string', format: 'email' },
    companyName: { type: 'string' },
    password: { type: 'string', minLength: 6 },
  },
  required: ['name', 'email', 'password'],
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

export const getInitials = (
  firstName: string | null | undefined,
  lastName: string | null | undefined
) => {
  const firstInitial = firstName?.charAt(0)?.toUpperCase() || "";
  const lastInitial = lastName?.charAt(0)?.toUpperCase() || "";
  return firstInitial && lastInitial ? `${firstInitial}${lastInitial}` : "U";
};

export const getFullName = (
  firstName: string | null | undefined,
  lastName: string | null | undefined
) => {
  if (firstName && lastName) {
    return `${firstName} ${lastName}`;
  }
  if (firstName) {
    return firstName;
  }
  if (lastName) {
    return lastName;
  }
  return "Usuario";
};

export const splitFullName = (
  fullName: string | null | undefined
): { firstName: string | null; lastName: string | null } => {
  if (!fullName) {
    return { firstName: null, lastName: null };
  }
  const parts = fullName.trim().split(/\s+/);
  if (parts.length === 1) {
    return { firstName: parts[0], lastName: null };
  }
  return {
    firstName: parts[0],
    lastName: parts.slice(1).join(" "),
  };
};
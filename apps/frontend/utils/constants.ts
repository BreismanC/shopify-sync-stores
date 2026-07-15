import {
  Home,
  Store,
  Package,
  Sliders,
  ShoppingBag,
  Users,
  CreditCard,
  Bell,
} from "lucide-react";

import type { MenuItem, UserRole } from "@/types";

export const DASHBOARD_ROUTES: MenuItem[] = [
  {
    title: "Inicio",
    url: "/dashboard",
    icon: Home,
    roles: ["OWNER", "ADMIN", "MEMBER"],
  },
  {
    title: "Tiendas",
    url: "/stores",
    icon: Store,
    roles: ["OWNER", "ADMIN", "MEMBER"],
  },
  {
    title: "Productos",
    url: "/dashboard/products",
    icon: Package,
    roles: ["OWNER", "ADMIN", "MEMBER"],
  },
  {
    title: "Configuración de productos",
    url: "/dashboard/product-settings",
    icon: Sliders,
    roles: ["OWNER", "ADMIN"],
  },
  {
    title: "Pedidos",
    url: "/dashboard/orders",
    icon: ShoppingBag,
    roles: ["OWNER", "ADMIN", "MEMBER"],
  },
  {
    title: "Marketplace",
    url: "/dashboard/marketplace",
    icon: Users,
    roles: ["OWNER", "ADMIN", "MEMBER"],
  },
  {
    title: "Plan y facturación",
    url: "/dashboard/billing",
    icon: CreditCard,
    roles: ["OWNER", "ADMIN"],
  },
  {
    title: "Notificaciones",
    url: "/dashboard/notifications",
    icon: Bell,
    isSheetTrigger: true,
    roles: ["OWNER", "ADMIN", "MEMBER"],
  },
];

export const roleLabels: Record<UserRole, string> = {
  OWNER: "Propietario",
  ADMIN: "Administrador",
  MEMBER: "Miembro",
};
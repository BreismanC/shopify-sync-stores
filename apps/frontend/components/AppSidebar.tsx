"use client";

import { useEffect, useRef, useState } from "react";
import { useParams, usePathname } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { signOut } from "next-auth/react";

import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarFooter,
  SidebarTrigger,
  useSidebar,
} from "@/components/ui/Sidebar";
import Button from "@/components/ui/Button";
import DropdownMenuList, {
  DropdownMenuItemType,
} from "@/components/DropdownMenuList";
import { Avatar, AvatarFallback } from "@/components/ui/Avatar";
import { cn } from "@/utils/class-names";
import { getFullName, getInitials, splitFullName } from "@/utils/data-view";
import { useMenuItems } from "@/hooks/use-menu-items";
import type { ProfileWithRole } from "@/types";
import { tenantPath } from "@/lib/tenant/routes";
import { useNotifications } from "@/components/notifications/NotificationProvider";

type AppSidebarProps = {
  profile: ProfileWithRole | null;
};

export function AppSidebar({ profile }: AppSidebarProps) {
  const pathname = usePathname();
  const params = useParams<{ tenantId?: string }>();
  const tenantId = params?.tenantId ?? profile?.tenantId;
  const resolveUrl = (url: string) =>
    tenantId ? tenantPath(tenantId, url) : url;

  const isActive = (url: string) => {
    if (!pathname) return false;
    const resolved = resolveUrl(url);

    if (pathname === url || pathname === resolved) return true;

    if (
      url === "/stores" &&
      (pathname === "/dashboard/stores" || pathname.endsWith("/stores"))
    ) {
      return true;
    }

    const cleanPath = pathname.replace(/^\/tenant\/[^/]+/, "");
    const cleanUrl = url.replace(/^\/dashboard/, "") || "/dashboard";
    const normalizedPath =
      cleanPath.replace(/^\/dashboard/, "") || "/dashboard";

    if (cleanUrl === "/dashboard") {
      return normalizedPath === "/dashboard";
    }

    return (
      normalizedPath === cleanUrl || normalizedPath.startsWith(`${cleanUrl}/`)
    );
  };

  const items = useMenuItems(profile);
  const { state, isMobile, setOpenMobile } = useSidebar();
  // On mobile, always show labels (never icon-only)
  const isCollapsed = isMobile ? false : state === "collapsed";
  const { unread, openNotifications } = useNotifications();

  // Separate notifications item from regular menu items
  const notificationsItem = items.find((item) => item.isSheetTrigger);
  const menuItems = items.filter((item) => !item.isSheetTrigger);

  const containerRef = useRef<HTMLDivElement>(null);
  const activeItemRef = useRef<HTMLLIElement>(null);
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);

  useEffect(() => {
    setIsNotificationsOpen(false);
    setOpenMobile(false);
  }, [pathname, setOpenMobile]);

  useEffect(() => {
    const container = containerRef.current;
    const activeElement = activeItemRef.current;

    if (container && activeElement) {
      const { offsetTop, offsetHeight } = activeElement;
      const containerHeight = container.offsetHeight;

      const clipTop = offsetTop;
      const clipBottom = containerHeight - (offsetTop + offsetHeight);

      container.style.clipPath = `inset(${clipTop}px 0 ${clipBottom}px 0 round 5px)`;
    } else if (container) {
      container.style.clipPath = `inset(0 0 100% 0)`;
    }
  }, [pathname, menuItems]);

  const handleSignOut = async () => {
    await signOut({ redirect: false });
    window.location.href = "/auth/login";
  };

  const { firstName, lastName } = splitFullName(profile?.name ?? null);
  const fullName = getFullName(firstName, lastName);
  const initials = getInitials(firstName, lastName);
  const email = profile?.email ?? "";

  const dropdownItems: DropdownMenuItemType[] = [
    {
      type: "link",
      label: "Perfil",
      url: tenantId
        ? tenantPath(tenantId, "/dashboard/profile")
        : "/dashboard/profile",
    },
    { type: "separator" },
    {
      type: "item",
      label: "Cerrar sesión",
      onSelect: handleSignOut,
    },
  ];

  if (!profile) {
    return null;
  }

  return (
    <div
      style={
        {
          "--spacing": "var(--aura)",
        } as React.CSSProperties
      }
    >
      <Sidebar collapsible="icon">
        <SidebarContent>
          <SidebarHeader className="flex flex-row justify-start items-center px-1.5">
            <SidebarTrigger />
            <Image
              src="/logo-syncio.svg"
              alt="Shopify Sync Stores"
              className="object-contain md:hidden"
              width={113}
              height={29}
              priority
            />
          </SidebarHeader>
          <SidebarGroup>
            <SidebarGroupContent className="relative">
              <SidebarMenu>
                {menuItems.map((item) => {
                  const active = isActive(item.url);
                  return (
                    <SidebarMenuItem key={item.title}>
                      <SidebarMenuButton
                        asChild
                        isActive={active}
                        tooltip={isCollapsed ? item.title : undefined}
                      >
                        <Link href={resolveUrl(item.url)}>
                          <Button
                            mode="menu"
                            className={cn(
                              "gap-1 w-full h-3 font-medium transition-all",
                              "!justify-start text-left",
                              active
                                ? "bg-[var(--accent-9)] text-white"
                                : "text-foreground",
                            )}
                            isDisabled={item.isDisabled}
                          >
                            <item.icon className="icon size-2 shrink-0" />
                            {!isCollapsed && <span>{item.title}</span>}
                          </Button>
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  );
                })}
              </SidebarMenu>
              <div
                ref={containerRef}
                aria-hidden="true"
                className="absolute inset-0 transition-[clip-path] duration-300 ease-in-out z-20"
                style={{ clipPath: "inset(0 0 100% 0)" }}
              >
                <SidebarMenu>
                  {menuItems.map((item) => {
                    const active = isActive(item.url);

                    return (
                      <SidebarMenuItem
                        key={item.title}
                        ref={active ? activeItemRef : null}
                        className="relative"
                      >
                        <SidebarMenuButton
                          asChild
                          isActive={true}
                          className="bg-transparent hover:bg-transparent data-[active=true]:bg-transparent relative"
                        >
                          <Link href={resolveUrl(item.url)}>
                            <Button
                              mode="menu"
                              className={cn(
                                "gap-1 w-full h-3 font-medium transition-all",
                                "!justify-start text-left",
                                "text-white bg-[var(--accent-9)]",
                              )}
                              isDisabled={item.isDisabled}
                              tabIndex={-1}
                            >
                              <item.icon className="icon size-2 shrink-0" />
                              {!isCollapsed && <span>{item.title}</span>}
                            </Button>
                          </Link>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    );
                  })}
                </SidebarMenu>
              </div>
            </SidebarGroupContent>
          </SidebarGroup>
        </SidebarContent>
        <SidebarFooter>
          {notificationsItem && !isMobile && (
            <div className="w-full flex items-center justify-center">
              <Button
                mode="menu"
                className={cn(
                  "gap-1 w-full h-2 font-medium transition-all !justify-start text-left",
                  "text-foreground",
                  isCollapsed && "!justify-center",
                )}
                isDisabled={notificationsItem.isDisabled}
                onClick={() => {
                  setIsNotificationsOpen(true);
                  openNotifications();
                }}
              >
                <div className="relative flex items-start">
                  <notificationsItem.icon className="icon shrink-0" />
                  {unread > 0 && (
                    <span className="absolute -right-1 -top-1 min-w-4 rounded-full bg-accent-9 px-1 text-[10px] leading-4 text-white">
                      {unread > 99 ? "99+" : unread}
                    </span>
                  )}
                </div>
                {!isCollapsed && <span>{notificationsItem.title}</span>}
              </Button>
            </div>
          )}
          <DropdownMenuList
            trigger={
              <button
                type="button"
                aria-label="Cuenta de usuario"
                className={cn(
                  "flex items-center justify-center cursor-pointer w-full transition-all",
                  "gap-1 px-1 bg-transparent border-none",
                )}
              >
                <Avatar className="shrink-0">
                  <AvatarFallback>{initials}</AvatarFallback>
                </Avatar>

                {!isCollapsed && (
                  <>
                    <div className="flex flex-col items-start text-left min-w-0 flex-1">
                      <span className="text-sm font-medium truncate w-full">
                        {fullName}
                      </span>
                      <span className="text-xs text-gray-11 truncate w-full">
                        {email}
                      </span>
                    </div>
                    <span className="icon shrink-0">▾</span>
                  </>
                )}
              </button>
            }
            items={dropdownItems}
          />
        </SidebarFooter>
      </Sidebar>
    </div>
  );
}

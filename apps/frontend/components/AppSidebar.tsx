"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
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
import Glow from "@/components/Glow";
import { cn } from "@/utils/class-names";
import { getFullName, getInitials, splitFullName } from "@/utils/data-view";
import { useMenuItems } from "@/hooks/use-menu-items";
import type { ProfileWithRole } from "@/types";

type AppSidebarProps = {
  profile: ProfileWithRole | null;
};

export function AppSidebar({ profile }: AppSidebarProps) {
  const pathname = usePathname();
  const isActive = (url: string) => {
    if (pathname === url) return true;
    if (url === "/dashboard") return false;
    return pathname?.startsWith(`${url}/`) ?? false;
  };

  const items = useMenuItems(profile);
  const { state, isMobile, setOpenMobile } = useSidebar();
  // On mobile, always show labels (never icon-only)
  const isCollapsed = isMobile ? false : state === "collapsed";

  // Separate notifications item from regular menu items
  const notificationsItem = items.find((item) => item.isSheetTrigger);
  const menuItems = items.filter((item) => !item.isSheetTrigger);

  const containerRef = useRef<HTMLDivElement>(null);
  const activeItemRef = useRef<HTMLLIElement>(null);
  const glowRef = useRef<HTMLDivElement>(null);
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);

  useEffect(() => {
    setIsNotificationsOpen(false);
    setOpenMobile(false);
  }, [pathname, setOpenMobile]);

  useEffect(() => {
    const container = containerRef.current;
    const activeElement = activeItemRef.current;
    const glow = glowRef.current;

    if (container && activeElement) {
      const { offsetTop, offsetHeight } = activeElement;
      const containerHeight = container.offsetHeight;

      const clipTop = offsetTop;
      const clipBottom = containerHeight - (offsetTop + offsetHeight);

      container.style.clipPath = `inset(${clipTop}px 0 ${clipBottom}px 0 round 5px)`;

      if (glow) {
        glow.style.top = `${offsetTop + offsetHeight / 2}px`;
        glow.style.opacity = "1";
      }
    } else if (container) {
      container.style.clipPath = `inset(0 0 100% 0)`;
      if (glow) {
        glow.style.opacity = "0";
      }
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
      url: "/dashboard/profile",
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
            <div
              ref={glowRef}
              className="absolute left-1/2 -translate-x-1/2 -translate-y-1/2 size-6 rounded-full pointer-events-none transition-all duration-300 ease-in-out opacity-0"
            >
              <Glow />
            </div>
            <SidebarMenu>
              {menuItems.map((item) => {
                return (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton
                      asChild
                      isActive={false}
                      tooltip={isCollapsed ? item.title : undefined}
                    >
                      <Link href={item.url}>
                        <Button
                          mode="menu"
                          className={cn(
                            "gap-1 w-full h-3 font-medium transition-all",
                            "justify-start",
                            "text-foreground"
                          )}
                          isDisabled={item.isDisabled}
                        >
                          <item.icon className="icon size-2" />
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
                        <Link href={item.url}>
                          <Button
                            mode="menu"
                            className={cn(
                              "gap-1 w-full h-3 font-medium transition-all",
                              "justify-start",
                              "text-background",
                              "bg-secundary"
                            )}
                            isDisabled={item.isDisabled}
                            tabIndex={-1}
                          >
                            <item.icon className="icon size-2" />
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
                "gap-1 w-full h-2 font-medium transition-all justify-start",
                "text-foreground",
                isCollapsed && "justify-center"
              )}
              isDisabled={notificationsItem.isDisabled}
              onClick={() => setIsNotificationsOpen((open) => !open)}
            >
              <div className="relative flex items-start">
                <notificationsItem.icon className="icon" />
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
                "gap-1 px-1 bg-transparent border-none"
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
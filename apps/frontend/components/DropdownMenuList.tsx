import Link from "next/link";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuPortal,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/DropdownMenu";

type DropdownMenuItemProps = React.ComponentProps<typeof DropdownMenuItem> & {
  type: "item";
  label: string;
  onSelect?: () => void;
};

type DropdownMenuLinkProps = {
  type: "link";
  label: string;
  url: string;
};

type DropdownMenuLabelProps = React.ComponentProps<
  typeof DropdownMenuLabel
> & {
  type: "label";
  label: string;
};

type DropdownMenuSeparatorProps = React.ComponentProps<
  typeof DropdownMenuSeparator
> & {
  type: "separator";
};

export type DropdownMenuItemType =
  | DropdownMenuItemProps
  | DropdownMenuLinkProps
  | DropdownMenuLabelProps
  | DropdownMenuSeparatorProps;

type DropdownMenuListProps = {
  trigger: React.ReactNode;
  items: DropdownMenuItemType[];
} & React.ComponentProps<typeof DropdownMenu>;

const renderMenuItem = (item: DropdownMenuItemType) => {
  switch (item.type) {
    case "item":
      return (
        <DropdownMenuItem
          key={item.label}
          onSelect={item.onSelect}
          className="cursor-pointer"
        >
          {item.label}
        </DropdownMenuItem>
      );
    case "link":
      return (
        <DropdownMenuItem key={item.label} asChild className="cursor-pointer">
          <Link href={item.url}>{item.label}</Link>
        </DropdownMenuItem>
      );
    case "label":
      return (
        <DropdownMenuItem
          key={item.label}
          disabled
          className="opacity-100 font-medium"
        >
          {item.label}
        </DropdownMenuItem>
      );
    case "separator":
      return (
        <DropdownMenuSeparator
          key={`separator-${Math.random()}`}
        />
      );
    default:
      return null;
  }
};

const DropdownMenuList = ({
  trigger,
  items,
  ...props
}: DropdownMenuListProps) => {
  return (
    <DropdownMenu {...props}>
      <DropdownMenuTrigger asChild>{trigger}</DropdownMenuTrigger>
      <DropdownMenuPortal>
        <DropdownMenuContent className="z-60 min-w-12">
          {items.map(renderMenuItem)}
        </DropdownMenuContent>
      </DropdownMenuPortal>
    </DropdownMenu>
  );
};

export default DropdownMenuList;
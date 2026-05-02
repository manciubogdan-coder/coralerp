import React from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";

interface UserAvatarProps {
  name?: string | null;
  email?: string | null;
  url?: string | null;
  size?: "xs" | "sm" | "md" | "lg";
  className?: string;
}

const sizeMap = {
  xs: "h-6 w-6 text-[10px]",
  sm: "h-8 w-8 text-xs",
  md: "h-10 w-10 text-sm",
  lg: "h-20 w-20 text-2xl",
};

const initials = (name?: string | null, email?: string | null) => {
  const base = (name && name.trim()) || (email && email.split("@")[0]) || "?";
  const parts = base.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return base.slice(0, 2).toUpperCase();
};

export const UserAvatar: React.FC<UserAvatarProps> = ({
  name, email, url, size = "sm", className,
}) => {
  return (
    <Avatar className={cn(sizeMap[size], className)}>
      {url && <AvatarImage src={url} alt={name || email || "user"} />}
      <AvatarFallback className="bg-primary/15 text-primary font-medium">
        {initials(name, email)}
      </AvatarFallback>
    </Avatar>
  );
};

export default UserAvatar;

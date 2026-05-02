import React from "react";
import { Link } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { LogOut, User as UserIcon, Palette } from "lucide-react";
import UserAvatar from "@/components/UserAvatar";

const UserMenu: React.FC = () => {
  const { profile, signOut } = useAuth();
  if (!profile) return null;
  const display = profile.display_name || profile.name || profile.email;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" className="flex items-center gap-2 h-9 px-1 sm:px-2">
          <UserAvatar
            name={display}
            email={profile.email}
            url={profile.avatar_url}
            size="sm"
          />
          <span className="hidden sm:inline text-sm font-medium max-w-[140px] truncate">
            {display}
          </span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel className="flex items-center gap-2">
          <UserAvatar name={display} email={profile.email} url={profile.avatar_url} size="sm" />
          <div className="min-w-0">
            <div className="text-sm font-medium truncate">{display}</div>
            <div className="text-xs text-muted-foreground truncate">{profile.email}</div>
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link to="/profil" className="cursor-pointer">
            <UserIcon size={14} className="mr-2" /> Profilul meu
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link to="/profil#aspect" className="cursor-pointer">
            <Palette size={14} className="mr-2" /> Aspect & temă
          </Link>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={signOut} className="text-destructive cursor-pointer">
          <LogOut size={14} className="mr-2" /> Deconectare
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

export default UserMenu;

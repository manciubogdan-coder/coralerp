
import React from "react";
import { useNavigate } from "react-router-dom";
import { LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";

export interface DashboardMenuItem {
  id: string;
  name: string;
  icon: LucideIcon;
  route: string;
  description: string;
}

interface DashboardMenuItemProps {
  item: DashboardMenuItem;
}

const DashboardMenuItem = ({ item }: DashboardMenuItemProps) => {
  const navigate = useNavigate();
  const { name, icon: Icon, route, description } = item;

  return (
    <div className="bg-white rounded-lg shadow-sm hover:shadow-md transition-shadow p-6 flex flex-col">
      <div className="flex items-start mb-4">
        <div className="p-2 bg-primary/10 rounded-md mr-4">
          <Icon className="h-6 w-6 text-primary" />
        </div>
        <div>
          <h2 className="font-medium text-lg">{name}</h2>
          <p className="text-sm text-gray-500 mt-1">{description}</p>
        </div>
      </div>
      <div className="mt-auto pt-4">
        <Button
          className="w-full"
          onClick={() => navigate(route)}
        >
          Accesați
        </Button>
      </div>
    </div>
  );
};

export default DashboardMenuItem;

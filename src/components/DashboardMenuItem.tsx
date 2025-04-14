
import React from 'react';
import { useNavigate } from 'react-router-dom';
import { LucideIcon } from 'lucide-react';
import { Button } from "@/components/ui/button";

interface DashboardMenuItemProps {
  item: {
    id: string;
    name: string;
    icon: LucideIcon;
    route: string;
    description: string;
  };
}

const DashboardMenuItem = ({ item }: DashboardMenuItemProps) => {
  const navigate = useNavigate();
  const Icon = item.icon;
  
  return (
    <div 
      className="bg-white p-6 rounded-lg shadow-md hover:shadow-lg transition-shadow border border-gray-100 cursor-pointer"
      onClick={() => navigate(item.route)}
    >
      <div className="flex items-center mb-3">
        <div className="bg-blue-50 p-2 rounded-md mr-3">
          <Icon className="h-6 w-6 text-blue-600" />
        </div>
        <h3 className="text-lg font-medium">{item.name}</h3>
      </div>
      <p className="text-gray-500 text-sm mb-4">{item.description}</p>
      <Button 
        variant="outline" 
        size="sm"
        onClick={(e) => {
          e.stopPropagation();
          navigate(item.route);
        }}
        className="w-full"
      >
        Accesează
      </Button>
    </div>
  );
};

export default DashboardMenuItem;

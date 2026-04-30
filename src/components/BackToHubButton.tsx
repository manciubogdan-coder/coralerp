import React from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Home } from "lucide-react";

interface Props {
  className?: string;
  label?: string;
}

const BackToHubButton: React.FC<Props> = ({ className, label = "Hub Departamente" }) => {
  const navigate = useNavigate();
  return (
    <Button
      variant="outline"
      size="sm"
      className={className}
      onClick={() => navigate("/")}
    >
      <Home className="h-4 w-4 mr-2" />
      {label}
    </Button>
  );
};

export default BackToHubButton;

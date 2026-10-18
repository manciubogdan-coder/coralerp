import React from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Home } from "lucide-react";

interface Props {
  className?: string;
  label?: string;
}

// Department hubs reachable from the main hub; sub-pages get a "back to module" button.
const MODULES: Record<string, string> = {
  administrativ: "Administrativ",
  vanzari: "Vânzări",
  achizitii: "Achiziții",
  calitate: "Calitate",
};

const BackToHubButton: React.FC<Props> = ({ className, label = "Hub Departamente" }) => {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const parts = pathname.split("/").filter(Boolean);
  const module = parts.length > 1 && MODULES[parts[0]] ? parts[0] : null;
  return (
    <div className={`flex flex-wrap gap-2 ${className ?? ""}`}>
      {module && (
        <Button variant="outline" size="sm" onClick={() => navigate(`/${module}`)}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Înapoi la {MODULES[module]}
        </Button>
      )}
      <Button variant="outline" size="sm" onClick={() => navigate("/")}>
        <Home className="h-4 w-4 mr-2" />
        {label}
      </Button>
    </div>
  );
};

export default BackToHubButton;

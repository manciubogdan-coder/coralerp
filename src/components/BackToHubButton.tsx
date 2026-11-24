import React from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Home } from "lucide-react";

interface Props {
  className?: string;
  label?: string;
  /** `xs` for dense overlays such as the Viziune 3D HUD. */
  size?: "sm" | "xs";
}

// Department hubs reachable from the main hub; sub-pages get a "back to module" button.
const MODULES: Record<string, string> = {
  administrativ: "Administrativ",
  vanzari: "Vânzări",
  achizitii: "Achiziții",
  calitate: "Calitate",
};

const BackToHubButton: React.FC<Props> = ({ className, label = "Hub Departamente", size = "sm" }) => {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const parts = pathname.split("/").filter(Boolean);
  const module = parts.length > 1 && MODULES[parts[0]] ? parts[0] : null;
  const icon = size === "xs" ? "h-3.5 w-3.5 mr-1" : "h-4 w-4 mr-2";
  return (
    <div className={`flex flex-wrap gap-1.5 ${className ?? ""}`}>
      {module && (
        <Button variant="outline" size={size} onClick={() => navigate(`/${module}`)}>
          <ArrowLeft className={icon} />
          Înapoi la {MODULES[module]}
        </Button>
      )}
      <Button variant="outline" size={size} onClick={() => navigate("/")}>
        <Home className={icon} />
        {label}
      </Button>
    </div>
  );
};

export default BackToHubButton;

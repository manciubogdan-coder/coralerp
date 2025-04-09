
import React from "react";
import { useToast } from "@/hooks/use-toast";

const Header = () => {
  const { toast } = useToast();
  
  const handleInfoClick = () => {
    toast({
      title: "Asistent AI Gestiune Marfă",
      description: "Folosește comenzi vocale sau text pentru gestiunea stocurilor. Spune 'Ajutor' pentru lista de comenzi disponibile.",
    });
  };

  return (
    <header className="bg-white shadow-md">
      <div className="container mx-auto p-4 flex justify-between items-center">
        <div className="flex items-center">
          <img 
            src="/lovable-uploads/14a34d6c-2fa6-4719-8bb8-8f61820ae5ee.png" 
            alt="Coral Bio Greens Logo" 
            className="h-12 w-12 mr-3"
          />
          <div>
            <h1 className="text-xl md:text-2xl font-bold text-coral-DEFAULT">
              CORAL <span className="text-green-DEFAULT">BIO GREENS</span>
            </h1>
            <p className="text-sm text-gray-600">Asistent AI Gestiune Marfă</p>
          </div>
        </div>
        
        <button 
          onClick={handleInfoClick}
          className="text-sm font-medium text-green-dark hover:text-coral-DEFAULT transition-colors"
        >
          Ajutor
        </button>
      </div>
    </header>
  );
};

export default Header;

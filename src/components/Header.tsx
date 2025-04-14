
import React from "react";

const Header = () => {
  return (
    <header className="bg-white shadow-md">
      <div className="container mx-auto p-4 flex justify-between items-center">
        <div className="flex items-center">
          <img 
            src="/lovable-uploads/14a34d6c-2fa6-4719-8bb8-8f61820ae5ee.png" 
            alt="Coral Biogreens Logo" 
            className="h-12 w-12 mr-3"
          />
          <div>
            <h1 className="text-xl md:text-2xl font-bold text-coral-DEFAULT">
              CORAL <span className="text-green-DEFAULT">BIOGREENS</span>
            </h1>
            <p className="text-sm text-gray-600">Gestiune Depozit</p>
          </div>
        </div>
      </div>
    </header>
  );
};

export default Header;


import React from "react";

const Footer = () => {
  return (
    <footer className="bg-white shadow-inner">
      <div className="container mx-auto p-4 text-center text-sm text-gray-500">
        <p>© {new Date().getFullYear()} Coral Bio Greens. Toate drepturile rezervate.</p>
        <p className="text-xs mt-1">
          Powered by OpenAI & Firebase
        </p>
      </div>
    </footer>
  );
};

export default Footer;

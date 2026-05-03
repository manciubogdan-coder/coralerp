import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import OperatorInterface from "@/components/productie/OperatorInterface";

const OperatorHub: React.FC = () => {
  const navigate = useNavigate();
  const [selectedLine, setSelectedLine] = useState("");

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto p-2 md:p-4 pb-24">
        <div className="mb-4 flex items-center gap-3">
          <Button variant="outline" size="sm" onClick={() => navigate("/")}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Înapoi la panou
          </Button>
          <h1 className="text-xl md:text-2xl font-bold">Operator</h1>
        </div>

        <OperatorInterface
          selectedLine={selectedLine}
          onLineSelect={setSelectedLine}
        />
      </div>
    </div>
  );
};

export default OperatorHub;

import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import OperatorInterface from "@/components/productie/OperatorInterface";

const OperatorHub: React.FC = () => {
  const navigate = useNavigate();
  const [selectedLine, setSelectedLine] = useState("");

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <main className="flex-1 container mx-auto p-2 md:p-4">
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
      </main>
    </div>
  );
};

export default OperatorHub;

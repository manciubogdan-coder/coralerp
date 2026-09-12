import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import OperatorInterface from "@/components/productie/OperatorInterface";
import {
  OperatorI18nProvider,
  OperatorLanguageSelector,
  useOperatorT,
} from "@/lib/operatorI18n";

const OperatorHubContent: React.FC = () => {
  const navigate = useNavigate();
  const [selectedLine, setSelectedLine] = useState("");
  const { t } = useOperatorT();

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto p-2 md:p-4 pb-24">
        <div className="mb-4 flex items-center gap-3">
          <Button variant="outline" size="sm" onClick={() => navigate("/")}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            {t("backToPanel")}
          </Button>
          <h1 className="text-xl md:text-2xl font-bold">{t("operator")}</h1>
          <div className="ml-auto">
            <OperatorLanguageSelector />
          </div>
        </div>

        <OperatorInterface
          selectedLine={selectedLine}
          onLineSelect={setSelectedLine}
        />
      </div>
    </div>
  );
};

const OperatorHub: React.FC = () => (
  <OperatorI18nProvider>
    <OperatorHubContent />
  </OperatorI18nProvider>
);

export default OperatorHub;

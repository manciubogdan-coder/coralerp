
import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import SuppliersTable from "@/components/dashboard/SuppliersTable";
import { toast } from "@/hooks/use-custom-toast";
import { supabase } from "@/integrations/supabase/client";
import { Supplier } from "@/types";

const SuppliersPage = () => {
  const navigate = useNavigate();
  const [isAdding, setIsAdding] = useState(false);
  
  const addInitialSuppliers = async () => {
    try {
      const initialSuppliers: Omit<Supplier, "id">[] = [
        { name: "FreshFarm SRL", contact: "Andrei Popa", phone: "0722456789", email: "contact@freshfarm.ro" },
        { name: "Agro Invest", contact: "Maria Ionescu", phone: "0733123456", email: "office@agroinvest.ro" },
        { name: "Bio Natura", contact: "Ion Popescu", phone: "0744987654", email: "comenzi@bionatura.ro" },
        { name: "EcoVerde", contact: "Cristina Dumitrescu", phone: "0755234567", email: "info@ecoverde.ro" },
        { name: "Farm Produce", contact: "Alexandru Georgescu", phone: "0766345678", email: "alex@farmproduce.ro" }
      ];

      // Check if suppliers already exist
      const { data: existingSuppliers, error: checkError } = await supabase
        .from("suppliers")
        .select("name");

      if (checkError) throw checkError;

      const existingNames = new Set(existingSuppliers.map(s => s.name.toLowerCase()));
      const suppliersToAdd = initialSuppliers.filter(s => !existingNames.has(s.name.toLowerCase()));

      if (suppliersToAdd.length === 0) {
        toast({
          title: "Informație",
          description: "Toți furnizorii sunt deja adăugați în sistem."
        });
        return;
      }

      const { error: insertError } = await supabase
        .from("suppliers")
        .insert(suppliersToAdd);

      if (insertError) throw insertError;

      toast({
        title: "Furnizori adăugați",
        description: `${suppliersToAdd.length} furnizori noi au fost adăugați cu succes.`
      });
      
      setIsAdding(false);
      window.location.reload(); // Reload to show new suppliers
    } catch (error: any) {
      console.error("Error adding suppliers:", error);
      toast({
        variant: "destructive",
        title: "Eroare",
        description: `Nu s-au putut adăuga furnizorii: ${error.message}`
      });
    }
  };
  
  useEffect(() => {
    if (isAdding) {
      addInitialSuppliers();
    }
  }, [isAdding]);
  
  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      <Header />
      
      <main className="flex-1 container mx-auto p-4 md:p-6">
        <div className="mb-6 flex items-center justify-between">
          <div className="flex items-center">
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => navigate("/dashboard")}
              className="mr-4"
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Înapoi la panou
            </Button>
            <h1 className="text-2xl font-bold">Gestionare Furnizori</h1>
          </div>
          
          <Button
            size="sm"
            onClick={() => setIsAdding(true)}
            disabled={isAdding}
          >
            <Plus className="h-4 w-4 mr-2" />
            Adaugă furnizori inițiali
          </Button>
        </div>
        
        <div className="bg-white rounded-lg shadow-md">
          <SuppliersTable />
        </div>
      </main>
      
      <Footer />
    </div>
  );
};

export default SuppliersPage;

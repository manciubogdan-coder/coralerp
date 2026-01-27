import React, { createContext, useContext, useEffect, useMemo, useState } from "react";

export type InventoryType = "materii-prime" | "ambalaje" | "etichete";

type InventoryTypeContextValue = {
  inventoryType: InventoryType;
  setInventoryType: (type: InventoryType) => void;
};

const InventoryTypeContext = createContext<InventoryTypeContextValue | undefined>(undefined);

export const useInventoryType = () => {
  const ctx = useContext(InventoryTypeContext);
  if (!ctx) {
    throw new Error("useInventoryType must be used within InventoryTypeProvider");
  }
  return ctx;
};

export const InventoryTypeProvider = ({
  children,
  storageKey = "inventoryType",
  defaultType = "materii-prime",
}: {
  children: React.ReactNode;
  storageKey?: string;
  defaultType?: InventoryType;
}) => {
  const [inventoryType, setInventoryTypeState] = useState<InventoryType>(() => {
    try {
      const raw = localStorage.getItem(storageKey);
      if (raw === "ambalaje" || raw === "materii-prime" || raw === "etichete") return raw;
    } catch {
      // ignore
    }
    return defaultType;
  });

  const setInventoryType = (type: InventoryType) => {
    setInventoryTypeState(type);
    try {
      localStorage.setItem(storageKey, type);
    } catch {
      // ignore
    }
  };

  const value = useMemo(() => ({ inventoryType, setInventoryType }), [inventoryType]);

  // Sync changes from other tabs (optional)
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key !== storageKey) return;
      if (e.newValue === "ambalaje" || e.newValue === "materii-prime" || e.newValue === "etichete") {
        setInventoryTypeState(e.newValue);
      }
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, [storageKey]);

  return <InventoryTypeContext.Provider value={value}>{children}</InventoryTypeContext.Provider>;
};

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

/**
 * Forțează un tip de inventar cât timp componenta e montată.
 * Folosit de rutele /depozit-mp, /depozit-ambalaje, /etichete ca URL-ul să fie sursa de adevăr,
 * nu localStorage. Restaurează valoarea anterioară la unmount.
 */
export const ForceInventoryType: React.FC<{ type: InventoryType; children: React.ReactNode }> = ({
  type,
  children,
}) => {
  const { inventoryType, setInventoryType } = useInventoryType();
  const [ready, setReady] = useState(inventoryType === type);

  useEffect(() => {
    if (inventoryType !== type) {
      setInventoryType(type);
    }
    setReady(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [type]);

  // Așteaptă ca contextul să reflecte tipul corect înainte de a randa copiii
  // (altfel hook-urile copiilor vor face fetch cu tipul vechi pe primul render).
  if (!ready || inventoryType !== type) return null;
  return <>{children}</>;
};

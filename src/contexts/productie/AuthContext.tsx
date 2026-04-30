/**
 * Shim AuthContext pentru componentele migrate din productiecoral-18.
 *
 * Componentele importate din vechea aplicație folosesc `useAuth().userRole`
 * și se așteaptă la role-uri de tip 'supervizor' / 'operator' / 'picking'.
 * AuthContext-ul nostru folosește departamente. Mapăm aici:
 *   - admin sau departament 'productie' → supervizor (acces full)
 *   - departament 'picking_vanzari'    → picking
 *   - altfel                           → operator
 */
import { useAuth as useAppAuth } from "@/contexts/AuthContext";

export function useAuth() {
  const auth = useAppAuth();
  const { isAdmin, departments } = auth;

  let userRole: "supervizor" | "operator" | "picking" | null = null;
  if (isAdmin || departments.includes("productie" as any)) {
    userRole = "supervizor";
  } else if (departments.includes("picking_vanzari" as any)) {
    userRole = "picking";
  } else if (auth.user) {
    userRole = "operator";
  }

  return {
    ...auth,
    userRole,
    // Vechile componente folosesc `loading` (nu `isLoading`)
    loading: auth.isLoading,
    // Câteva componente apelează `checkUserStatus` — devine no-op
    checkUserStatus: async () => {
      await auth.refreshProfile();
    },
  };
}

import { useEffect, useState } from "react";
import { supabaseCloud } from "@/integrations/supabase/cloudClient";
import { useAuth } from "@/contexts/AuthContext";

export const useTractionTrackerAccess = () => {
  const { user, isAdmin } = useAuth();
  const [allowed, setAllowed] = useState<boolean>(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!user) { setAllowed(false); setLoading(false); return; }
      if (isAdmin) { setAllowed(true); setLoading(false); return; }
      const { data } = await supabaseCloud
        .from("traction_tracker_access")
        .select("user_id")
        .eq("user_id", user.id)
        .maybeSingle();
      if (!cancelled) {
        setAllowed(!!data);
        setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [user?.id, isAdmin]);

  return { allowed, loading };
};

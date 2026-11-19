import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

export function useIsAdmin(userId?: string) {
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!userId) {
        setIsAdmin(false);
        setLoading(false);
        return;
      }
      setLoading(true);

      try {
        const { data, error } = await supabase
          .from("admins")
          .select("user_id")
          .eq("user_id", userId)
          .maybeSingle();

        if (cancelled) return;
        setIsAdmin(!error && !!data);
      } catch {
        if (!cancelled) setIsAdmin(false);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [userId]);

  return { isAdmin, loading };
}

export function useStaffRecord(userId?: string) {
  const [staff, setStaff] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!userId) { setStaff(null); setLoading(false); return; }
      setLoading(true);
      const { data } = await supabase
        .from("staff")
        .select("*")
        .eq("user_id", userId)
        .eq("active", true)
        .maybeSingle();
      if (cancelled) return;
      setStaff(data ?? null);
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [userId]);

  return { staff, loading };
}


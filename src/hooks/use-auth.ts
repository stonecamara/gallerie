import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export type AppRole = "admin" | "client";

export interface AuthInfo {
  loading: boolean;
  userId: string | null;
  email: string | null;
  fullName: string | null;
  clientCode: string | null;
  role: AppRole | null;
}

export function useAuth(): AuthInfo {
  const [state, setState] = useState<AuthInfo>({
    loading: true,
    userId: null,
    email: null,
    fullName: null,
    clientCode: null,
    role: null,
  });

  useEffect(() => {
    let active = true;

    async function load(userId: string | null, email: string | null) {
      if (!userId) {
        if (active)
          setState({
            loading: false,
            userId: null,
            email: null,
            fullName: null,
            clientCode: null,
            role: null,
          });
        return;
      }
      const [{ data: profile }, { data: roles }] = await Promise.all([
        supabase.from("profiles").select("full_name, client_code").eq("id", userId).maybeSingle(),
        supabase.from("user_roles").select("role").eq("user_id", userId),
      ]);
      const role =
        roles?.find((r) => r.role === "admin")?.role ??
        roles?.find((r) => r.role === "client")?.role ??
        null;
      if (!active) return;
      setState({
        loading: false,
        userId,
        email,
        fullName: profile?.full_name ?? null,
        clientCode: profile?.client_code ?? null,
        role: (role as AppRole) ?? null,
      });
    }

    supabase.auth.getUser().then(({ data }) => {
      load(data.user?.id ?? null, data.user?.email ?? null);
    });

    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      load(session?.user?.id ?? null, session?.user?.email ?? null);
    });

    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  return state;
}

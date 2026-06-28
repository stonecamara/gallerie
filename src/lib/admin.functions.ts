import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const clientEmail = (code: string) => `c${code}@portal.local`;

async function ensureAdmin(supabase: any, userId: string) {
  const { data, error } = await supabase.rpc("has_role", {
    _user_id: userId,
    _role: "admin",
  });
  if (error || !data) throw new Error("Forbidden");
}

/** First-time admin creation. Refuses once an admin exists. */
export const bootstrapAdmin = createServerFn({ method: "POST" })
  .inputValidator((d: { email: string; password: string; fullName: string }) =>
    z.object({
      email: z.string().email(),
      password: z.string().min(8),
      fullName: z.string().min(1),
    }).parse(d),
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { count, error: cErr } = await supabaseAdmin
      .from("user_roles")
      .select("id", { count: "exact", head: true })
      .eq("role", "admin");
    if (cErr) throw new Error(cErr.message);
    if ((count ?? 0) > 0) throw new Error("Un administrateur existe déjà.");

    const { data: created, error: uErr } = await supabaseAdmin.auth.admin.createUser({
      email: data.email,
      password: data.password,
      email_confirm: true,
      user_metadata: { full_name: data.fullName },
    });
    if (uErr || !created.user) throw new Error(uErr?.message ?? "Création impossible");

    const userId = created.user.id;
    const { error: pErr } = await supabaseAdmin.from("profiles").insert({
      id: userId,
      full_name: data.fullName,
      email: data.email,
    });
    if (pErr) throw new Error(pErr.message);

    const { error: rErr } = await supabaseAdmin
      .from("user_roles")
      .insert({ user_id: userId, role: "admin" });
    if (rErr) throw new Error(rErr.message);

    return { ok: true };
  });

export const checkAdminExists = createServerFn({ method: "GET" }).handler(async () => {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { count } = await supabaseAdmin
    .from("user_roles")
    .select("id", { count: "exact", head: true })
    .eq("role", "admin");
  return { exists: (count ?? 0) > 0 };
});

/** Admin creates a new client account with a unique 8-digit code. */
export const createClientAccount = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { fullName: string; password: string }) =>
    z.object({
      fullName: z.string().min(1),
      password: z.string().min(6),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    await ensureAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: codeData, error: codeErr } = await supabaseAdmin.rpc("generate_client_code");
    if (codeErr || !codeData) throw new Error(codeErr?.message ?? "Code generation failed");
    const code = codeData as string;
    const email = clientEmail(code);

    const { data: created, error: uErr } = await supabaseAdmin.auth.admin.createUser({
      email,
      password: data.password,
      email_confirm: true,
      user_metadata: { full_name: data.fullName, client_code: code },
    });
    if (uErr || !created.user) throw new Error(uErr?.message ?? "Création impossible");

    const userId = created.user.id;
    const { error: pErr } = await supabaseAdmin.from("profiles").insert({
      id: userId,
      full_name: data.fullName,
      client_code: code,
      email,
    });
    if (pErr) throw new Error(pErr.message);

    const { error: rErr } = await supabaseAdmin
      .from("user_roles")
      .insert({ user_id: userId, role: "client" });
    if (rErr) throw new Error(rErr.message);

    return { clientCode: code, userId, fullName: data.fullName };
  });

export const deleteClientAccount = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { userId: string }) => z.object({ userId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await ensureAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.auth.admin.deleteUser(data.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const resetClientPassword = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { userId: string; newPassword: string }) =>
    z.object({ userId: z.string().uuid(), newPassword: z.string().min(6) }).parse(d),
  )
  .handler(async ({ data, context }) => {
    await ensureAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.auth.admin.updateUserById(data.userId, {
      password: data.newPassword,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const getClientStorageStats = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await ensureAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Get all clients
    const { data: roles } = await supabaseAdmin
      .from("user_roles")
      .select("user_id")
      .eq("role", "client");
    const clientIds = (roles ?? []).map((r) => r.user_id);

    if (clientIds.length === 0) return { stats: [] };

    // Get profiles
    const { data: profiles } = await supabaseAdmin
      .from("profiles")
      .select("id, full_name, client_code")
      .in("id", clientIds);

    const stats = await Promise.all(
      (profiles ?? []).map(async (profile) => {
        // Get projects for this client
        const { data: projects } = await supabaseAdmin
          .from("projects")
          .select("id")
          .eq("client_user_id", profile.id);

        const projectIds = (projects ?? []).map((p) => p.id);

        // Get images count and total size from images table
        let totalBytes = 0;
        let imageCount = 0;

        if (projectIds.length > 0) {
          const { data: images } = await supabaseAdmin
            .from("images")
            .select("size_bytes")
            .in("project_id", projectIds);

          imageCount = images?.length ?? 0;
          totalBytes = (images ?? [])
            .filter((img: any) => img.size_bytes)
            .reduce((sum: number, img: any) => sum + (img.size_bytes || 0), 0);
        }

        return {
          userId: profile.id,
          name: profile.full_name || "Sans nom",
          clientCode: profile.client_code || "—",
          totalBytes,
          projectCount: projectIds.length,
          imageCount,
        };
      }),
    );

    return { stats };
  });

/** Returns a short-lived signed URL for an image in the private bucket. */
export const getSignedImageUrl = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { path: string }) => z.object({ path: z.string().min(1) }).parse(d))
  .handler(async ({ data, context }) => {
    // RLS-checked: confirm the user can see an image at this path.
    const { data: img, error } = await context.supabase
      .from("images")
      .select("id, storage_path")
      .eq("storage_path", data.path)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!img) throw new Error("Introuvable");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: signed, error: sErr } = await supabaseAdmin.storage
      .from("project-files")
      .createSignedUrl(data.path, 60 * 60);
    if (sErr || !signed) throw new Error(sErr?.message ?? "URL signée impossible");
    return { url: signed.signedUrl };
  });

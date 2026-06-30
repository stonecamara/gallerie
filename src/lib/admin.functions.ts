import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const clientEmail = (code: string) => `c${code}@portal.local`;

async function requireAdmin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: { user }, error: authErr } = await supabaseAdmin.auth.getUser();
  if (authErr || !user) throw new Error("Non authentifié");

  const { data: role, error: rErr } = await supabaseAdmin
    .from("user_roles")
    .select("role")
    .eq("user_id", user.id)
    .eq("role", "admin")
    .maybeSingle();
  if (rErr || !role) throw new Error("Accès réservé aux administrateurs");
  return user;
}

/** Admin creates a new client account with a unique 8-digit code. */
export const createClientAccount = createServerFn({ method: "POST" })
  .inputValidator((d: { fullName: string; password: string }) =>
    z.object({
      fullName: z.string().min(1),
      password: z.string().min(6),
    }).parse(d),
  )
  .handler(async ({ data }) => {
    await requireAdmin();
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
  .inputValidator((d: { userId: string }) => z.object({ userId: z.string().uuid() }).parse(d))
  .handler(async ({ data }) => {
    await requireAdmin();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.auth.admin.deleteUser(data.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const resetClientPassword = createServerFn({ method: "POST" })
  .inputValidator((d: { userId: string; newPassword: string }) =>
    z.object({ userId: z.string().uuid(), newPassword: z.string().min(6) }).parse(d),
  )
  .handler(async ({ data }) => {
    await requireAdmin();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.auth.admin.updateUserById(data.userId, {
      password: data.newPassword,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const getClientStorageStats = createServerFn({ method: "GET" })
  .handler(async () => {
    await requireAdmin();
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

/** Validates an upload request server-side before the client uploads. */
export const validateUpload = createServerFn({ method: "POST" })
  .inputValidator((d: { projectId: string; fileName: string; fileSize: number; mimeType: string }) =>
    z.object({
      projectId: z.string().uuid(),
      fileName: z.string().min(1).max(200),
      fileSize: z.number().positive().max(100 * 1024 * 1024),
      mimeType: z.string().min(1),
    }).parse(d),
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: { user }, error: authErr } = await supabaseAdmin.auth.getUser();
    if (authErr || !user) throw new Error("Non authentifié");

    const ALLOWED_MIME = [
      "image/jpeg", "image/png", "image/gif", "image/webp", "image/svg+xml",
      "video/mp4", "video/quicktime", "video/x-msvideo", "video/webm",
    ];
    if (!ALLOWED_MIME.includes(data.mimeType)) {
      throw new Error("Type de fichier non autorisé");
    }

    const ext = data.fileName.split(".").pop()?.toLowerCase() ?? "";
    const ALLOWED_EXT = ["jpg", "jpeg", "png", "gif", "webp", "svg", "mp4", "mov", "avi", "webm"];
    if (!ALLOWED_EXT.includes(ext)) {
      throw new Error("Extension non autorisée");
    }

    return { ok: true };
  });

/** Returns a short-lived signed URL for an image in the private bucket. */
export const getSignedImageUrl = createServerFn({ method: "POST" })
  .inputValidator((d: { path: string }) => z.object({ path: z.string().min(1) }).parse(d))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: { user }, error: authErr } = await supabaseAdmin.auth.getUser();
    if (authErr || !user) throw new Error("Non authentifié");

    const pathUserId = data.path.split("/")[0];
    if (pathUserId !== user.id) {
      const { data: role } = await supabaseAdmin
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id)
        .eq("role", "admin")
        .maybeSingle();
      if (!role) throw new Error("Accès refusé");
    }

    const { data: signed, error: sErr } = await supabaseAdmin.storage
      .from("project-files")
      .createSignedUrl(data.path, 60 * 60);
    if (sErr || !signed) throw new Error(sErr?.message ?? "URL signée impossible");
    return { url: signed.signedUrl };
  });

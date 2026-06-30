import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { getSignedImageUrl, validateUpload } from "@/lib/admin.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import JSZip from "jszip";
import {
  ArrowLeft, Folder, FolderPlus, Upload, Camera, LogOut, Image as ImageIcon,
  Trash2, Download, X, CheckSquare, Square, Video,
} from "lucide-react";

export const Route = createFileRoute("/_authenticated/projects/$projectId")({
  head: () => ({ meta: [{ title: "Projet — Studio Client" }] }),
  component: ProjectView,
});

type Project = { id: string; name: string; client_user_id: string };
type Folder = { id: string; name: string; parent_folder_id: string | null; project_id: string };
type MediaRow = {
  id: string; name: string; storage_path: string; folder_id: string | null;
  project_id: string; mime_type: string | null; size_bytes: number | null;
};

function ProjectView() {
  const { projectId } = Route.useParams();
  const auth = useAuth();
  const navigate = useNavigate();
  const isAdmin = auth.role === "admin";

  const [project, setProject] = useState<Project | null>(null);
  const [folders, setFolders] = useState<Folder[]>([]);
  const [medias, setMedias] = useState<MediaRow[]>([]);
  const [currentFolderId, setCurrentFolderId] = useState<string | null>(null);
  const [breadcrumb, setBreadcrumb] = useState<Folder[]>([]);
  const [openFolder, setOpenFolder] = useState(false);
  const [viewer, setViewer] = useState<{ url: string; name: string; isVideo: boolean } | null>(null);
  const [selectMode, setSelectMode] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [downloading, setDownloading] = useState(false);
  const [downloadMode, setDownloadMode] = useState<"single" | "zip">("single");
  const fileInput = useRef<HTMLInputElement>(null);
  const getUrl = useServerFn(getSignedImageUrl);
  const validate = useServerFn(validateUpload);

  async function load() {
    const { data: p } = await supabase.from("projects").select("*").eq("id", projectId).maybeSingle();
    setProject(p as Project);
    const { data: f } = await supabase.from("folders").select("*").eq("project_id", projectId).order("name");
    setFolders((f ?? []) as Folder[]);
    const { data: i } = await supabase.from("images").select("*").eq("project_id", projectId).order("created_at", { ascending: false });
    setMedias((i ?? []) as MediaRow[]);
  }
  useEffect(() => { load(); }, [projectId]);

  useEffect(() => {
    const path: Folder[] = [];
    let id: string | null = currentFolderId;
    while (id) {
      const f = folders.find((x) => x.id === id);
      if (!f) break;
      path.unshift(f);
      id = f.parent_folder_id;
    }
    setBreadcrumb(path);
  }, [currentFolderId, folders]);

  const visibleFolders = folders.filter((f) => f.parent_folder_id === currentFolderId);
  const visibleMedias = medias.filter((i) => (i.folder_id ?? null) === currentFolderId);

  async function createFolder(name: string) {
    const safeName = sanitizeFileName(name).trim() || "Nouveau dossier";
    const { error } = await supabase.from("folders").insert({
      project_id: projectId, parent_folder_id: currentFolderId, name: safeName,
    });
    if (error) { toast.error(error.message); return; }
    toast.success("Dossier créé");
    setOpenFolder(false);
    load();
  }

  async function deleteFolder(id: string) {
    if (!confirm("Supprimer ce dossier et tout son contenu ?")) return;
    const { error } = await supabase.from("folders").delete().eq("id", id);
    if (error) { toast.error(error.message); return; }
    load();
  }

  const MAX_FILE_SIZE = 100 * 1024 * 1024;
  const ALLOWED_EXTS = ["jpg", "jpeg", "png", "gif", "webp", "svg", "mp4", "mov", "avi", "webm"];

  function isValidFile(file: File): string | null {
    if (file.size > MAX_FILE_SIZE) return `${file.name}: Taille max 100MB`;
    const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
    if (!ALLOWED_EXTS.includes(ext)) return `${file.name}: Type non autorisé`;
    return null;
  }

  function sanitizeFileName(name: string): string {
    return name.replace(/[^a-zA-Z0-9._-]/g, "_").substring(0, 200);
  }

  async function uploadFiles(files: FileList) {
    if (!project) return;
    const clientId = project.client_user_id;

    const validFiles: File[] = [];
    for (const file of Array.from(files)) {
      const error = isValidFile(file);
      if (error) { toast.error(error); continue; }

      try {
        await validate({
          data: {
            projectId,
            fileName: file.name,
            fileSize: file.size,
            mimeType: file.type,
          },
        });
      } catch (e: any) {
        toast.error(`${file.name}: ${e?.message ?? "Refusé"}`);
        continue;
      }
      validFiles.push(file);
    }
    if (validFiles.length === 0) return;

    toast.info(`Téléversement de ${validFiles.length} fichier(s)…`);
    let success = 0;
    for (const file of validFiles) {
      const safeName = sanitizeFileName(file.name);
      const ext = safeName.split(".").pop() ?? "bin";
      const path = `${clientId}/${projectId}/${crypto.randomUUID()}.${ext}`;
      const { error: upErr } = await supabase.storage
        .from("project-files")
        .upload(path, file, { contentType: file.type });
      if (upErr) { toast.error(`${file.name}: ${upErr.message}`); continue; }
      const { error: dbErr } = await supabase.from("images").insert({
        project_id: projectId, folder_id: currentFolderId,
        name: safeName, storage_path: path, mime_type: file.type, size_bytes: file.size,
      });
      if (dbErr) { toast.error(`${file.name}: ${dbErr.message}`); continue; }
      success++;
    }
    toast.success(`Téléversement terminé (${success}/${validFiles.length})`);
    load();
  }

  async function deleteImage(media: MediaRow) {
    if (!confirm("Supprimer ce fichier ?")) return;
    await supabase.storage.from("project-files").remove([media.storage_path]);
    const { error } = await supabase.from("images").delete().eq("id", media.id);
    if (error) { toast.error(error.message); return; }
    load();
  }

  async function openMedia(media: MediaRow) {
    try {
      const { url } = await getUrl({ data: { path: media.storage_path } });
      const isVideo = media.mime_type?.startsWith("video/") ?? false;
      setViewer({ url, name: media.name, isVideo });
    } catch (e: any) { toast.error(e?.message ?? "Erreur"); }
  }

  async function downloadMedia(media: MediaRow) {
    try {
      const { url } = await getUrl({ data: { path: media.storage_path } });
      const response = await fetch(url);
      const blob = await response.blob();
      const blobUrl = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = blobUrl;
      a.download = media.name;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(blobUrl);
    } catch (e: any) { toast.error(e?.message ?? "Erreur"); }
  }

  async function downloadSelected() {
    if (selected.size === 0) return;
    setDownloading(true);
    const selectedMedias = medias.filter((m) => selected.has(m.id));
    try {
      if (downloadMode === "zip") {
        const zip = new JSZip();
        for (const media of selectedMedias) {
          const { url } = await getUrl({ data: { path: media.storage_path } });
          const response = await fetch(url);
          const blob = await response.blob();
          zip.file(media.name, blob);
        }
        const content = await zip.generateAsync({ type: "blob" });
        const blobUrl = URL.createObjectURL(content);
        const a = document.createElement("a");
        a.href = blobUrl;
        a.download = `${project?.name || "media"}-${Date.now()}.zip`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(blobUrl);
        toast.success(`${selectedMedias.length} fichier(s) téléchargé(s) en ZIP`);
      } else {
        for (const media of selectedMedias) {
          const { url } = await getUrl({ data: { path: media.storage_path } });
          const response = await fetch(url);
          const blob = await response.blob();
          const blobUrl = URL.createObjectURL(blob);
          const a = document.createElement("a");
          a.href = blobUrl;
          a.download = media.name;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          URL.revokeObjectURL(blobUrl);
          await new Promise((r) => setTimeout(r, 300));
        }
        toast.success(`${selectedMedias.length} fichier(s) téléchargé(s)`);
      }
    } catch (e: any) { toast.error(e?.message ?? "Erreur"); }
    setDownloading(false);
    setSelectMode(false);
    setSelected(new Set());
  }

  function toggleSelect(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function selectAll() {
    setSelected(new Set(visibleMedias.map((m) => m.id)));
  }

  function clearSelection() {
    setSelectMode(false);
    setSelected(new Set());
  }

  async function signOut() { await supabase.auth.signOut(); navigate({ to: "/auth" }); }

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-50 border-b border-border/50 bg-card/80 backdrop-blur-sm">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-3.5">
          <Link to="/dashboard" className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-sm">
              <Camera className="h-4 w-4" />
            </div>
            <span className="text-base font-semibold tracking-tight">Studio Client</span>
          </Link>
          <Button variant="ghost" size="sm" onClick={signOut} className="text-muted-foreground hover:text-foreground">
            <LogOut className="mr-1.5 h-4 w-4" /> Déconnexion
          </Button>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-6 py-8">
        <Link
          to={isAdmin && project ? "/clients/$clientId" : "/dashboard"}
          params={isAdmin && project ? { clientId: project.client_user_id } : {}}
          className="inline-flex items-center gap-1 text-sm text-muted-foreground transition-colors-fast hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" /> Retour
        </Link>

        <div className="mt-5 flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">{project?.name ?? "…"}</h1>
            <nav className="mt-2 flex flex-wrap items-center gap-1.5 text-sm text-muted-foreground">
              <button onClick={() => setCurrentFolderId(null)} className="transition-colors-fast hover:text-primary">
                Racine
              </button>
              {breadcrumb.map((f) => (
                <span key={f.id} className="flex items-center gap-1.5">
                  <span className="text-border">/</span>
                  <button onClick={() => setCurrentFolderId(f.id)} className="transition-colors-fast hover:text-primary">{f.name}</button>
                </span>
              ))}
            </nav>
          </div>
          {isAdmin && (
            <div className="flex gap-2">
              <Dialog open={openFolder} onOpenChange={setOpenFolder}>
                <DialogTrigger asChild>
                  <Button variant="outline" className="shadow-sm">
                    <FolderPlus className="mr-1.5 h-4 w-4" /> Dossier
                  </Button>
                </DialogTrigger>
                <CreateFolderDialog onSubmit={createFolder} />
              </Dialog>
              <Button onClick={() => fileInput.current?.click()} className="shadow-sm">
                <Upload className="mr-1.5 h-4 w-4" /> Téléverser
              </Button>
              <input
                ref={fileInput} type="file" multiple accept="image/*,video/*" className="hidden"
                onChange={(e) => { if (e.target.files?.length) uploadFiles(e.target.files); e.target.value = ""; }}
              />
            </div>
          )}
          {visibleMedias.length > 0 && (
            <Button
              variant={selectMode ? "default" : "outline"}
              onClick={() => { if (selectMode) clearSelection(); else setSelectMode(true); }}
              className="shadow-sm"
            >
              <CheckSquare className="mr-1.5 h-4 w-4" />
              {selectMode ? "Annuler" : "Sélectionner"}
            </Button>
          )}
        </div>

        {visibleFolders.length > 0 && (
          <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {visibleFolders.map((f) => (
              <Card key={f.id} className="group relative cursor-pointer p-4 shadow-sm transition-all-fast hover:border-primary/50 hover:shadow-card-hover"
                onClick={() => setCurrentFolderId(f.id)}>
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary transition-all-fast group-hover:bg-primary group-hover:text-primary-foreground">
                    <Folder className="h-5 w-5" />
                  </div>
                  <span className="truncate font-medium">{f.name}</span>
                </div>
                {isAdmin && (
                  <Button variant="ghost" size="icon" className="absolute right-2 top-2 h-7 w-7 opacity-0 transition-all-fast group-hover:opacity-100"
                    onClick={(e) => { e.stopPropagation(); deleteFolder(f.id); }}>
                    <Trash2 className="h-3.5 w-3.5 text-destructive" />
                  </Button>
                )}
              </Card>
            ))}
          </div>
        )}

        {visibleMedias.length > 0 ? (
          <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
            {visibleMedias.map((media) => (
              <MediaTile
                key={media.id} media={media} isAdmin={isAdmin} selectMode={selectMode}
                isSelected={selected.has(media.id)}
                onToggle={() => toggleSelect(media.id)}
                onOpen={() => { if (!selectMode) openMedia(media); }}
                onDownload={() => downloadMedia(media)} onDelete={() => deleteImage(media)} />
            ))}
          </div>
        ) : visibleFolders.length === 0 ? (
          <Card className="mt-6 flex flex-col items-center justify-center py-16 shadow-sm">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-muted">
              <ImageIcon className="h-7 w-7 text-muted-foreground" />
            </div>
            <p className="mt-4 text-sm font-medium text-foreground">
              {isAdmin ? "Aucun contenu" : "Aucune photo"}
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              {isAdmin ? "Créez un dossier ou téléversez des photos." : "Aucune photo dans ce dossier."}
            </p>
          </Card>
        ) : null}

        {selectMode && selected.size > 0 && (
          <div className="fixed bottom-6 left-1/2 z-50 flex -translate-x-1/2 items-center gap-3 rounded-2xl bg-foreground px-6 py-3.5 text-background shadow-lg">
            <span className="text-sm font-medium">{selected.size} sélectionnée(s)</span>
            <Button variant="secondary" size="sm" onClick={selectAll} className="h-8">Tout</Button>
            <div className="flex rounded-lg bg-black/10 p-0.5">
              <button
                onClick={() => setDownloadMode("single")}
                className={`rounded-md px-3 py-1.5 text-xs font-medium transition-all-fast ${downloadMode === "single" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
              >
                Fichiers
              </button>
              <button
                onClick={() => setDownloadMode("zip")}
                className={`rounded-md px-3 py-1.5 text-xs font-medium transition-all-fast ${downloadMode === "zip" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
              >
                ZIP
              </button>
            </div>
            <Button size="sm" onClick={downloadSelected} disabled={downloading} className="h-8">
              <Download className="mr-1.5 h-3.5 w-3.5" />
              {downloading ? "…" : "Télécharger"}
            </Button>
          </div>
        )}
      </main>

      {viewer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/95 p-6" onClick={() => setViewer(null)}>
          <Button variant="ghost" size="icon" className="absolute right-4 top-4 h-10 w-10 text-white hover:bg-white/10"
            onClick={(e) => { e.stopPropagation(); setViewer(null); }}>
            <X className="h-5 w-5" />
          </Button>
          <div className="max-h-[90vh] max-w-[90vw]">
            {viewer.isVideo ? (
              <video src={viewer.url} controls className="max-h-full max-w-full rounded-lg" autoPlay />
            ) : (
              <img src={viewer.url} alt={viewer.name} className="max-h-full max-w-full rounded-lg object-contain" />
            )}
          </div>
          <div className="absolute bottom-6 left-1/2 -translate-x-1/2 rounded-full bg-black/60 px-4 py-2 text-sm text-white/80 backdrop-blur-sm">
            {viewer.name}
          </div>
        </div>
      )}
    </div>
  );
}

function MediaTile({ media, isAdmin, selectMode, isSelected, onToggle, onOpen, onDownload, onDelete }: {
  media: MediaRow; isAdmin: boolean; selectMode: boolean; isSelected: boolean;
  onToggle: () => void; onOpen: () => void; onDownload: () => void; onDelete: () => void;
}) {
  const getUrl = useServerFn(getSignedImageUrl);
  const [thumb, setThumb] = useState<string | null>(null);
  const isVideo = media.mime_type?.startsWith("video/") ?? false;

  useEffect(() => {
    let active = true;
    if (!isVideo) {
      getUrl({ data: { path: media.storage_path } }).then((r) => { if (active) setThumb(r.url); }).catch(() => {});
    }
    return () => { active = false; };
  }, [media.storage_path, isVideo]);

  return (
    <Card className="group relative aspect-square overflow-hidden p-0 shadow-sm transition-all-fast hover:shadow-card-hover">
      <button
        onClick={(e) => { if (selectMode) { e.stopPropagation(); onToggle(); } else onOpen(); }}
        className="block h-full w-full"
      >
        {isVideo ? (
          <div className="grid h-full w-full place-items-center bg-muted">
            <Video className="h-10 w-10 text-primary/60" />
          </div>
        ) : thumb ? (
          <img src={thumb} alt={media.name} className={`h-full w-full object-cover transition-transform duration-300 ${!selectMode ? "group-hover:scale-105" : ""}`} />
        ) : (
          <div className="grid h-full w-full place-items-center bg-muted">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          </div>
        )}
      </button>
      {selectMode && (
        <button
          onClick={onToggle}
          className={`absolute left-2.5 top-2.5 flex h-7 w-7 items-center justify-center rounded-lg transition-all-fast ${isSelected ? "bg-primary text-primary-foreground shadow-sm" : "bg-black/40 text-white backdrop-blur-sm"}`}
        >
          {isSelected ? <CheckSquare className="h-4 w-4" /> : <Square className="h-4 w-4" />}
        </button>
      )}
      {!selectMode && (
        <div className="absolute inset-x-0 bottom-0 flex items-center justify-between bg-gradient-to-t from-black/80 via-black/40 to-transparent p-3 opacity-0 transition-opacity duration-200 group-hover:opacity-100">
          <span className="truncate text-xs font-medium text-white">{media.name}</span>
          <div className="flex gap-1">
            <Button variant="ghost" size="icon" className="h-7 w-7 rounded-lg text-white hover:bg-white/20" onClick={onDownload}>
              <Download className="h-3.5 w-3.5" />
            </Button>
            {isAdmin && (
              <Button variant="ghost" size="icon" className="h-7 w-7 rounded-lg text-white hover:bg-white/20" onClick={onDelete}>
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            )}
          </div>
        </div>
      )}
    </Card>
  );
}

function CreateFolderDialog({ onSubmit }: { onSubmit: (n: string) => void }) {
  const [name, setName] = useState("");
  return (
    <DialogContent>
      <DialogHeader>
        <DialogTitle>Nouveau dossier</DialogTitle>
      </DialogHeader>
      <form onSubmit={(e) => { e.preventDefault(); onSubmit(name); setName(""); }} className="space-y-4">
        <div>
          <Label htmlFor="fname" className="text-sm font-medium">Nom du dossier</Label>
          <Input id="fname" value={name} onChange={(e) => setName(e.target.value)} required className="mt-1.5" />
        </div>
        <DialogFooter><Button type="submit">Créer</Button></DialogFooter>
      </form>
    </DialogContent>
  );
}

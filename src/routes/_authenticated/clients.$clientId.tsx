import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { ArrowLeft, Folder, Plus, Trash2, Camera, LogOut, Pencil } from "lucide-react";

export const Route = createFileRoute("/_authenticated/clients/$clientId")({
  head: () => ({ meta: [{ title: "Client — Projets" }] }),
  component: ClientDetail,
});

function ClientDetail() {
  const { clientId } = Route.useParams();
  const auth = useAuth();
  const navigate = useNavigate();
  const [client, setClient] = useState<{ full_name: string; client_code: string | null } | null>(null);
  const [projects, setProjects] = useState<Array<{ id: string; name: string; description: string | null; created_at: string }>>([]);
  const [open, setOpen] = useState(false);
  const [renameProject, setRenameProject] = useState<{ id: string; name: string } | null>(null);
  const [newName, setNewName] = useState("");

  async function refresh() {
    const { data: p } = await supabase.from("profiles").select("full_name, client_code").eq("id", clientId).maybeSingle();
    setClient(p);
    const { data: pr } = await supabase
      .from("projects").select("*").eq("client_user_id", clientId).order("created_at", { ascending: false });
    setProjects(pr ?? []);
  }
  useEffect(() => { refresh(); }, [clientId]);

  useEffect(() => {
    if (!auth.loading && auth.role !== "admin") navigate({ to: "/dashboard" });
  }, [auth, navigate]);

  async function createProject(name: string, description: string) {
    const { error } = await supabase.from("projects").insert({ client_user_id: clientId, name, description });
    if (error) { toast.error(error.message); return; }
    toast.success("Projet créé");
    setOpen(false);
    refresh();
  }

  async function deleteProject(id: string) {
    if (!confirm("Supprimer ce projet et toutes ses photos ?")) return;
    const { error } = await supabase.from("projects").delete().eq("id", id);
    if (error) { toast.error(error.message); return; }
    refresh();
  }

  function openRename(project: { id: string; name: string }) {
    setRenameProject(project);
    setNewName(project.name);
  }

  async function handleRename() {
    if (!renameProject || !newName.trim()) return;
    const { error } = await supabase.from("projects").update({ name: newName.trim() }).eq("id", renameProject.id);
    if (error) { toast.error(error.message); return; }
    toast.success("Projet renommé");
    setRenameProject(null);
    refresh();
  }

  async function signOut() { await supabase.auth.signOut(); navigate({ to: "/auth" }); }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <Link to="/dashboard" className="flex items-center gap-2">
            <div className="grid h-8 w-8 place-items-center rounded-md bg-primary text-primary-foreground">
              <Camera className="h-4 w-4" />
            </div>
            <span className="font-semibold">Studio Client</span>
          </Link>
          <Button variant="ghost" size="sm" onClick={signOut}>
            <LogOut className="mr-2 h-4 w-4" /> Déconnexion
          </Button>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-6 py-8">
        <Link to="/dashboard" className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="mr-1 h-4 w-4" /> Retour aux clients
        </Link>

        <div className="mt-4 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">{client?.full_name ?? "Client"}</h1>
            <p className="text-sm text-muted-foreground">
              Code <span className="font-mono text-primary">{client?.client_code}</span>
            </p>
          </div>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button><Plus className="mr-2 h-4 w-4" /> Nouveau projet</Button>
            </DialogTrigger>
            <CreateProjectDialog onSubmit={createProject} />
          </Dialog>
          <Dialog open={!!renameProject} onOpenChange={(o) => !o && setRenameProject(null)}>
            <DialogContent>
              <DialogHeader><DialogTitle>Renommer le projet</DialogTitle></DialogHeader>
              <form onSubmit={(e) => { e.preventDefault(); handleRename(); }} className="space-y-4">
                <div>
                  <Label htmlFor="rename">Nouveau nom</Label>
                  <Input id="rename" value={newName} onChange={(e) => setNewName(e.target.value)} required />
                </div>
                <DialogFooter>
                  <Button type="button" variant="outline" onClick={() => setRenameProject(null)}>Annuler</Button>
                  <Button type="submit">Renommer</Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {projects.length === 0 ? (
            <Card className="col-span-full py-12 text-center">
              <Folder className="mx-auto h-10 w-10 text-muted-foreground" />
              <p className="mt-3 text-sm text-muted-foreground">Aucun projet. Créez le premier.</p>
            </Card>
          ) : projects.map((p) => (
            <Card key={p.id} className="group relative p-5 transition hover:border-primary">
              <Link to="/projects/$projectId" params={{ projectId: p.id }} className="block">
                <Folder className="h-8 w-8 text-primary" />
                <div className="mt-3 font-semibold">{p.name}</div>
                {p.description && <p className="mt-1 text-sm text-muted-foreground line-clamp-2">{p.description}</p>}
                <div className="mt-2 text-xs text-muted-foreground">
                  {new Date(p.created_at).toLocaleDateString("fr-FR")}
                </div>
              </Link>
              <div className="absolute right-2 top-2 flex gap-1 opacity-0 transition group-hover:opacity-100">
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openRename(p)}>
                  <Pencil className="h-4 w-4" />
                </Button>
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => deleteProject(p.id)}>
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </div>
            </Card>
          ))}
        </div>
      </main>
    </div>
  );
}

function sanitize(str: string): string {
  return str.replace(/[<>'"&]/g, "").trim().substring(0, 200);
}

function CreateProjectDialog({ onSubmit }: { onSubmit: (n: string, d: string) => void }) {
  const [name, setName] = useState("");
  const [desc, setDesc] = useState("");
  return (
    <DialogContent>
      <DialogHeader><DialogTitle>Nouveau projet</DialogTitle></DialogHeader>
      <form onSubmit={(e) => { e.preventDefault(); onSubmit(sanitize(name), sanitize(desc)); }} className="space-y-4">
        <div>
          <Label htmlFor="pname">Nom du projet</Label>
          <Input id="pname" value={name} onChange={(e) => setName(e.target.value)} required maxLength={200} />
        </div>
        <div>
          <Label htmlFor="pdesc">Description (optionnel)</Label>
          <Textarea id="pdesc" value={desc} onChange={(e) => setDesc(e.target.value)} rows={3} maxLength={500} />
        </div>
        <DialogFooter><Button type="submit">Créer</Button></DialogFooter>
      </form>
    </DialogContent>
  );
}

import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { createClientAccount, deleteClientAccount, resetClientPassword, getClientStorageStats } from "@/lib/admin.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Progress } from "@/components/ui/progress";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter,
  DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { Camera, LogOut, Plus, Users, Folder, Trash2, Copy, Key, Eye, LayoutDashboard, HardDrive, Image as ImageIcon, FolderOpen } from "lucide-react";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({ meta: [{ title: "Tableau de bord" }] }),
  component: Dashboard,
});

function Dashboard() {
  const auth = useAuth();
  const navigate = useNavigate();

  async function signOut() {
    await supabase.auth.signOut();
    navigate({ to: "/auth" });
  }

  if (auth.loading) {
    return <div className="grid min-h-screen place-items-center text-muted-foreground">Chargement…</div>;
  }

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
          <div className="flex items-center gap-3">
            <div className="hidden text-right sm:block">
              <div className="text-sm font-medium">{auth.fullName ?? auth.email}</div>
              <div className="text-xs text-muted-foreground">
                {auth.role === "admin" ? "Administrateur" : `Client · ${auth.clientCode}`}
              </div>
            </div>
            <Button variant="ghost" size="sm" onClick={signOut}>
              <LogOut className="mr-2 h-4 w-4" /> Déconnexion
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-6 py-8">
        {auth.role === "admin" ? <AdminView /> : <ClientView />}
      </main>
    </div>
  );
}

function AdminView() {
  const createClient = useServerFn(createClientAccount);
  const deleteClient = useServerFn(deleteClientAccount);
  const resetPassword = useServerFn(resetClientPassword);
  const fetchStats = useServerFn(getClientStorageStats);
  const [clients, setClients] = useState<
    Array<{ id: string; full_name: string; client_code: string | null; created_at: string; email: string | null }>
  >([]);
  const [stats, setStats] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingStats, setLoadingStats] = useState(false);
  const [open, setOpen] = useState(false);
  const [openReset, setOpenReset] = useState(false);
  const [resetClient, setResetClient] = useState<{ id: string; name: string } | null>(null);
  const [newPassword, setNewPassword] = useState("");
  const [created, setCreated] = useState<{ code: string; password: string; name: string } | null>(null);

  async function refresh() {
    setLoading(true);
    const { data: roles } = await supabase.from("user_roles").select("user_id").eq("role", "client");
    const ids = (roles ?? []).map((r) => r.user_id);
    if (ids.length === 0) { setClients([]); setLoading(false); return; }
    const { data } = await supabase
      .from("profiles")
      .select("id, full_name, client_code, created_at, email")
      .in("id", ids)
      .order("created_at", { ascending: false });
    setClients(data ?? []);
    setLoading(false);
  }

  async function loadStats() {
    setLoadingStats(true);
    try {
      const res = await fetchStats();
      setStats(res.stats);
    } catch (e: any) { toast.error("Erreur chargement statistiques"); }
    setLoadingStats(false);
  }

  useEffect(() => { refresh(); }, []);

  async function handleCreate(fullName: string, password: string) {
    try {
      const res = await createClient({ data: { fullName, password } });
      setCreated({ code: res.clientCode, password, name: res.fullName });
      setOpen(false);
      refresh();
    } catch (e: any) { toast.error(e?.message ?? "Erreur"); }
  }

  async function handleResetPassword() {
    if (!resetClient || newPassword.length < 6) { toast.error("6 caractères min."); return; }
    try {
      await resetPassword({ data: { userId: resetClient.id, newPassword } });
      toast.success("Mot de passe réinitialisé");
      setOpenReset(false);
      setResetClient(null);
      setNewPassword("");
    } catch (e: any) { toast.error(e?.message ?? "Erreur"); }
  }

  async function handleDelete(userId: string, name: string) {
    if (!confirm(`Supprimer définitivement le client « ${name} » et tous ses fichiers ?`)) return;
    try { await deleteClient({ data: { userId } }); toast.success("Client supprimé"); refresh(); }
    catch (e: any) { toast.error(e?.message ?? "Erreur"); }
  }

  const totalStorage = stats.reduce((sum, s) => sum + s.totalBytes, 0);
  const totalImages = stats.reduce((sum, s) => sum + s.imageCount, 0);
  const totalProjects = stats.reduce((sum, s) => sum + s.projectCount, 0);

  function formatBytes(bytes: number) {
    if (bytes === 0) return "0 o";
    const k = 1024;
    const sizes = ["o", "Ko", "Mo", "Go"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
  }

  return (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold">
            <LayoutDashboard className="h-6 w-6 text-primary" /> Tableau de bord Admin
          </h1>
          <p className="text-sm text-muted-foreground">Vue d'ensemble de tous les clients.</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button><Plus className="mr-2 h-4 w-4" /> Nouveau client</Button>
          </DialogTrigger>
          <CreateClientDialog onSubmit={handleCreate} />
        </Dialog>
      </div>

      {created && (
        <Card className="mt-6 border-primary/40 bg-accent p-5">
          <div className="font-semibold">Client créé : {created.name}</div>
          <p className="mt-1 text-sm text-muted-foreground">
            Communiquez ces identifiants au client. Le mot de passe ne sera plus affiché.
          </p>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <CredField label="Code client" value={created.code} />
            <CredField label="Mot de passe" value={created.password} />
          </div>
          <Button variant="outline" size="sm" className="mt-3" onClick={() => setCreated(null)}>
            Fermer
          </Button>
        </Card>
      )}

      <div className="mt-6 grid gap-4 sm:grid-cols-3">
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="rounded-full bg-primary/10 p-2">
              <Users className="h-5 w-5 text-primary" />
            </div>
            <div>
              <div className="text-2xl font-bold">{clients.length}</div>
              <div className="text-sm text-muted-foreground">Clients</div>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="rounded-full bg-primary/10 p-2">
              <HardDrive className="h-5 w-5 text-primary" />
            </div>
            <div>
              <div className="text-2xl font-bold">{formatBytes(totalStorage)}</div>
              <div className="text-sm text-muted-foreground">Stockage total</div>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="rounded-full bg-primary/10 p-2">
              <ImageIcon className="h-5 w-5 text-primary" />
            </div>
            <div>
              <div className="text-2xl font-bold">{totalImages}</div>
              <div className="text-sm text-muted-foreground">Images total</div>
            </div>
          </div>
        </Card>
      </div>

      <Tabs defaultValue="clients" className="mt-6" onValueChange={(v) => v === "storage" && !stats.length && loadStats()}>
        <TabsList>
          <TabsTrigger value="clients"><Users className="mr-2 h-4 w-4" />Clients</TabsTrigger>
          <TabsTrigger value="storage"><HardDrive className="mr-2 h-4 w-4" />Stockage</TabsTrigger>
        </TabsList>

        <TabsContent value="clients" className="mt-4">
          <Card className="overflow-hidden">
            <div className="border-b bg-muted/50 px-4 py-3">
              <h2 className="font-semibold">Liste des clients ({clients.length})</h2>
            </div>
            {loading ? (
              <div className="py-12 text-center text-muted-foreground">Chargement…</div>
            ) : clients.length === 0 ? (
              <div className="py-12 text-center text-muted-foreground">
                <Users className="mx-auto h-10 w-10" />
                <p className="mt-3">Aucun client pour le moment.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nom</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Code client</TableHead>
                      <TableHead>Date création</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {clients.map((c) => (
                      <TableRow key={c.id}>
                        <TableCell className="font-medium">
                          <Link to="/clients/$clientId" params={{ clientId: c.id }} className="hover:text-primary">
                            {c.full_name || "Sans nom"}
                          </Link>
                        </TableCell>
                        <TableCell className="text-muted-foreground">{c.email || "—"}</TableCell>
                        <TableCell>
                          <span className="rounded bg-primary/10 px-2 py-0.5 font-mono text-sm text-primary">
                            {c.client_code || "—"}
                          </span>
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {new Date(c.created_at).toLocaleDateString("fr-FR")}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-1">
                            <Button
                              variant="ghost" size="icon"
                              onClick={() => { setResetClient({ id: c.id, name: c.full_name || "Client" }); setOpenReset(true); }}
                              title="Réinitialiser mot de passe"
                            >
                              <Key className="h-4 w-4" />
                            </Button>
                            <Button variant="ghost" size="icon" onClick={() => handleDelete(c.id, c.full_name)}>
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </Card>
        </TabsContent>

        <TabsContent value="storage" className="mt-4">
          <Card className="overflow-hidden">
            <div className="border-b bg-muted/50 px-4 py-3">
              <h2 className="font-semibold">Stockage par client</h2>
            </div>
            {loadingStats ? (
              <div className="py-12 text-center text-muted-foreground">Chargement…</div>
            ) : stats.length === 0 ? (
              <div className="py-12 text-center text-muted-foreground">
                <HardDrive className="mx-auto h-10 w-10" />
                <p className="mt-3">Aucune donnée de stockage.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Client</TableHead>
                      <TableHead>Code</TableHead>
                      <TableHead>Projets</TableHead>
                      <TableHead>Images</TableHead>
                      <TableHead className="text-right">Stockage</TableHead>
                      <TableHead>Utilisation</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {stats.map((s) => (
                      <TableRow key={s.userId}>
                        <TableCell className="font-medium">
                          <Link to="/clients/$clientId" params={{ clientId: s.userId }} className="hover:text-primary">
                            {s.name}
                          </Link>
                        </TableCell>
                        <TableCell>
                          <span className="rounded bg-primary/10 px-2 py-0.5 font-mono text-sm text-primary">
                            {s.clientCode}
                          </span>
                        </TableCell>
                        <TableCell className="text-muted-foreground">{s.projectCount}</TableCell>
                        <TableCell className="text-muted-foreground">{s.imageCount}</TableCell>
                        <TableCell className="text-right font-mono">{formatBytes(s.totalBytes)}</TableCell>
                        <TableCell>
                          <Progress value={totalStorage ? (s.totalBytes / totalStorage) * 100 : 0} className="w-20" />
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </Card>
        </TabsContent>
      </Tabs>

      <Dialog open={openReset} onOpenChange={setOpenReset}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Réinitialiser le mot de passe</DialogTitle>
            <DialogDescription>
              Nouveau mot de passe pour <strong>{resetClient?.name}</strong>
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="newPw">Nouveau mot de passe</Label>
              <Input
                id="newPw" type="text" value={newPassword} maxLength={100}
                onChange={(e) => setNewPassword(e.target.value)} placeholder="Min. 6 caractères"
              />
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setOpenReset(false)}>Annuler</Button>
              <Button onClick={handleResetPassword} disabled={newPassword.length < 6}>
                Réinitialiser
              </Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function sanitize(str: string): string {
  return str.replace(/[<>'"&]/g, "").trim().substring(0, 100);
}

function CreateClientDialog({ onSubmit }: { onSubmit: (n: string, p: string) => void }) {
  const [name, setName] = useState("");
  const [pw, setPw] = useState("");
  return (
    <DialogContent>
      <DialogHeader>
        <DialogTitle>Nouveau client</DialogTitle>
        <DialogDescription>
          Un code à 8 chiffres unique sera généré automatiquement.
        </DialogDescription>
      </DialogHeader>
      <form
        onSubmit={(e) => { e.preventDefault(); if (pw.length < 6) { toast.error("6 caractères min."); return; } onSubmit(sanitize(name), sanitize(pw)); }}
        className="space-y-4"
      >
        <div>
          <Label htmlFor="cname">Nom du client</Label>
          <Input id="cname" value={name} onChange={(e) => setName(e.target.value)} required maxLength={100} />
        </div>
        <div>
          <Label htmlFor="cpw">Mot de passe initial</Label>
          <Input id="cpw" type="text" value={pw} onChange={(e) => setPw(e.target.value)} required maxLength={100} />
          <p className="mt-1 text-xs text-muted-foreground">À communiquer au client.</p>
        </div>
        <DialogFooter><Button type="submit">Créer</Button></DialogFooter>
      </form>
    </DialogContent>
  );
}

function CredField({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border bg-background p-3">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="mt-1 flex items-center justify-between gap-2">
        <span className="font-mono text-lg font-semibold">{value}</span>
        <Button variant="ghost" size="icon"
          onClick={() => { navigator.clipboard.writeText(value); toast.success("Copié"); }}>
          <Copy className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

function ClientView() {
  const [projects, setProjects] = useState<Array<{ id: string; name: string; description: string | null; created_at: string }>>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    supabase.from("projects").select("*").order("created_at", { ascending: false })
      .then(({ data }) => { setProjects(data ?? []); setLoading(false); });
  }, []);
  return (
    <div>
      <h1 className="text-2xl font-bold">Mes projets</h1>
      <p className="text-sm text-muted-foreground">Cliquez sur un projet pour accéder à vos photos.</p>
      <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {loading ? (
          <div className="col-span-full py-12 text-center text-muted-foreground">Chargement…</div>
        ) : projects.length === 0 ? (
          <Card className="col-span-full py-12 text-center">
            <Folder className="mx-auto h-10 w-10 text-muted-foreground" />
            <p className="mt-3 text-sm text-muted-foreground">
              Aucun projet disponible pour le moment.
            </p>
          </Card>
        ) : (
          projects.map((p) => (
            <Link key={p.id} to="/projects/$projectId" params={{ projectId: p.id }}>
              <Card className="p-5 transition hover:border-primary">
                <Folder className="h-8 w-8 text-primary" />
                <div className="mt-3 font-semibold">{p.name}</div>
                {p.description && <p className="mt-1 text-sm text-muted-foreground">{p.description}</p>}
                <div className="mt-2 text-xs text-muted-foreground">
                  {new Date(p.created_at).toLocaleDateString("fr-FR")}
                </div>
              </Card>
            </Link>
          ))
        )}
      </div>
    </div>
  );
}

import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { bootstrapAdmin, checkAdminExists } from "@/lib/admin.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { Camera } from "lucide-react";

export const Route = createFileRoute("/auth")({
  head: () => ({ meta: [{ title: "Connexion — Studio Client" }] }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const bootstrap = useServerFn(bootstrapAdmin);
  const check = useServerFn(checkAdminExists);

  const [hasAdmin, setHasAdmin] = useState<boolean | null>(null);
  const [mode, setMode] = useState<"client" | "admin">("client");

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) navigate({ to: "/dashboard" });
    });
    check().then((r) => setHasAdmin(r.exists)).catch(() => setHasAdmin(true));
  }, [check, navigate]);

  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      <div className="hidden bg-primary text-primary-foreground lg:flex lg:flex-col lg:justify-between lg:p-12">
        <Link to="/" className="flex items-center gap-2">
          <Camera className="h-6 w-6" />
          <span className="font-semibold">Studio Client</span>
        </Link>
        <div>
          <h2 className="text-3xl font-bold leading-tight">
            Vos projets photo,<br />à portée de clic.
          </h2>
          <p className="mt-4 max-w-md text-primary-foreground/80">
            Connectez-vous avec votre code à 8 chiffres remis par l'agence pour retrouver
            vos livraisons.
          </p>
        </div>
        <p className="text-sm text-primary-foreground/70">© {new Date().getFullYear()} Studio Client</p>
      </div>

      <div className="flex items-center justify-center p-6 lg:p-12">
        <div className="w-full max-w-md">
          <Link to="/" className="mb-8 inline-flex items-center gap-2 lg:hidden">
            <Camera className="h-5 w-5 text-primary" />
            <span className="font-semibold">Studio Client</span>
          </Link>

          {hasAdmin === false ? (
            <BootstrapForm
              onDone={async (email, password) => {
                await bootstrap({ data: { email, password, fullName: "Administrateur" } });
                const { error } = await supabase.auth.signInWithPassword({ email, password });
                if (error) throw error;
                navigate({ to: "/dashboard" });
              }}
            />
          ) : (
            <>
              <h1 className="text-2xl font-bold">Bienvenue</h1>
              <p className="mt-1 text-sm text-muted-foreground">Connectez-vous à votre espace.</p>

              <Tabs value={mode} onValueChange={(v) => setMode(v as "client" | "admin")} className="mt-6">
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="client">Client</TabsTrigger>
                  <TabsTrigger value="admin">Administrateur</TabsTrigger>
                </TabsList>
                <TabsContent value="client" className="mt-6">
                  <ClientLogin onSuccess={() => navigate({ to: "/dashboard" })} />
                </TabsContent>
                <TabsContent value="admin" className="mt-6">
                  <AdminLogin onSuccess={() => navigate({ to: "/dashboard" })} />
                </TabsContent>
              </Tabs>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function ClientLogin({ onSuccess }: { onSuccess: () => void }) {
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const clean = code.replace(/\D/g, "");
    if (clean.length !== 8) {
      toast.error("Le code doit contenir 8 chiffres.");
      return;
    }
    setLoading(true);
    const email = `c${clean}@portal.local`;
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) { toast.error("Code ou mot de passe incorrect."); return; }
    onSuccess();
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <div>
        <Label htmlFor="code">Code client (8 chiffres)</Label>
        <Input
          id="code"
          inputMode="numeric"
          maxLength={8}
          placeholder="12345678"
          value={code}
          onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
          className="mt-1 tracking-widest"
          required
        />
      </div>
      <div>
        <Label htmlFor="pw">Mot de passe</Label>
        <Input id="pw" type="password" value={password} onChange={(e) => setPassword(e.target.value)} className="mt-1" required />
      </div>
      <Button type="submit" className="w-full" disabled={loading}>
        {loading ? "Connexion…" : "Se connecter"}
      </Button>
    </form>
  );
}

function AdminLogin({ onSuccess }: { onSuccess: () => void }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) { toast.error("Identifiants incorrects."); return; }
    onSuccess();
  }
  return (
    <form onSubmit={submit} className="space-y-4">
      <div>
        <Label htmlFor="aemail">Email</Label>
        <Input id="aemail" type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="mt-1" required />
      </div>
      <div>
        <Label htmlFor="apw">Mot de passe</Label>
        <Input id="apw" type="password" value={password} onChange={(e) => setPassword(e.target.value)} className="mt-1" required />
      </div>
      <Button type="submit" className="w-full" disabled={loading}>
        {loading ? "Connexion…" : "Se connecter"}
      </Button>
    </form>
  );
}

function BootstrapForm({ onDone }: { onDone: (email: string, password: string) => Promise<void> }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (password.length < 8) { toast.error("Mot de passe : 8 caractères minimum."); return; }
    setLoading(true);
    try { await onDone(email, password); toast.success("Compte administrateur créé."); }
    catch (err: any) { toast.error(err?.message ?? "Erreur"); }
    finally { setLoading(false); }
  }
  return (
    <div>
      <h1 className="text-2xl font-bold">Première utilisation</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Créez le compte administrateur principal de l'agence.
      </p>
      <form onSubmit={submit} className="mt-6 space-y-4">
        <div>
          <Label htmlFor="bemail">Email administrateur</Label>
          <Input id="bemail" type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="mt-1" required />
        </div>
        <div>
          <Label htmlFor="bpw">Mot de passe (8+ caractères)</Label>
          <Input id="bpw" type="password" value={password} onChange={(e) => setPassword(e.target.value)} className="mt-1" required />
        </div>
        <Button type="submit" className="w-full" disabled={loading}>
          {loading ? "Création…" : "Créer le compte"}
        </Button>
      </form>
    </div>
  );
}

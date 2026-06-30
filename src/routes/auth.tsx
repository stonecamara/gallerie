import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { Camera, ArrowRight, Lock, User } from "lucide-react";
import { checkRateLimit } from "@/lib/utils";

export const Route = createFileRoute("/auth")({
  head: () => ({ meta: [{ title: "Connexion — StoneShot" }] }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<"client" | "admin">("client");

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) navigate({ to: "/dashboard" });
    });
  }, [navigate]);

  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      <div className="hidden bg-gradient-to-br from-primary via-primary to-primary/80 text-primary-foreground lg:flex lg:flex-col lg:justify-between lg:p-12">
          <Link to="/" className="flex items-center gap-2.5">
            <img src="/logo.svg" alt="StoneShot" className="h-10 w-10 rounded-xl" />
            <span className="text-lg font-semibold">StoneShot</span>
          </Link>
        <div>
          <h2 className="text-3xl font-bold leading-tight tracking-tight">
            Vos projets photo,<br />à portée de clic.
          </h2>
          <p className="mt-4 max-w-md text-lg leading-relaxed text-primary-foreground/80">
            Connectez-vous avec votre code à 8 chiffres remis par l'agence pour retrouver
            vos livraisons.
          </p>
          <div className="mt-8 flex items-center gap-6 text-sm text-primary-foreground/70">
            <div className="flex items-center gap-2">
              <Lock className="h-4 w-4" />
              Accès sécurisé
            </div>
            <div className="flex items-center gap-2">
              <User className="h-4 w-4" />
              Espace personnalisé
            </div>
          </div>
        </div>
        <p className="text-sm text-primary-foreground/60">© {new Date().getFullYear()} StoneShot — Tous droits réservés</p>
      </div>

      <div className="flex items-center justify-center p-6 lg:p-12">
        <div className="w-full max-w-md">
          <Link to="/" className="mb-8 inline-flex items-center gap-2 lg:hidden">
            <img src="/logo.svg" alt="StoneShot" className="h-9 w-9 rounded-lg" />
            <span className="font-semibold">StoneShot</span>
          </Link>

          <h1 className="text-2xl font-bold tracking-tight">Bienvenue</h1>
          <p className="mt-1.5 text-sm text-muted-foreground">Connectez-vous à votre espace client.</p>

          <Tabs value={mode} onValueChange={(v) => setMode(v as "client" | "admin")} className="mt-8">
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
    if (!checkRateLimit("client-login", 5, 60_000)) {
      toast.error("Trop de tentatives. Réessayez dans 1 minute.");
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
    <form onSubmit={submit} className="space-y-5">
      <div>
        <Label htmlFor="code" className="text-sm font-medium">Code client</Label>
        <Input
          id="code"
          inputMode="numeric"
          maxLength={8}
          placeholder="12345678"
          value={code}
          onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
          className="mt-1.5 h-12 tracking-[0.3em] text-center text-lg font-mono"
          required
        />
        <p className="mt-1.5 text-xs text-muted-foreground">8 chiffres remis par l'agence</p>
      </div>
      <div>
        <Label htmlFor="pw" className="text-sm font-medium">Mot de passe</Label>
        <Input id="pw" type="password" value={password} onChange={(e) => setPassword(e.target.value)} className="mt-1.5 h-12" required />
      </div>
      <Button type="submit" className="h-12 w-full text-sm font-medium" disabled={loading}>
        {loading ? (
          <span className="flex items-center gap-2">
            <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>
            Connexion…
          </span>
        ) : (
          <span className="flex items-center gap-2">
            Se connecter
            <ArrowRight className="h-4 w-4" />
          </span>
        )}
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
    if (!checkRateLimit("admin-login", 5, 60_000)) {
      toast.error("Trop de tentatives. Réessayez dans 1 minute.");
      return;
    }
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) { toast.error("Identifiants incorrects."); return; }
    onSuccess();
  }
  return (
    <form onSubmit={submit} className="space-y-5">
      <div>
        <Label htmlFor="aemail" className="text-sm font-medium">Email</Label>
        <Input id="aemail" type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="mt-1.5 h-12" required />
      </div>
      <div>
        <Label htmlFor="apw" className="text-sm font-medium">Mot de passe</Label>
        <Input id="apw" type="password" value={password} onChange={(e) => setPassword(e.target.value)} className="mt-1.5 h-12" required />
      </div>
      <Button type="submit" className="h-12 w-full text-sm font-medium" disabled={loading}>
        {loading ? (
          <span className="flex items-center gap-2">
            <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>
            Connexion…
          </span>
        ) : (
          <span className="flex items-center gap-2">
            Se connecter
            <ArrowRight className="h-4 w-4" />
          </span>
        )}
      </Button>
    </form>
  );
}

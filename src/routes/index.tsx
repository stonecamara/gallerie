import { createFileRoute, Link } from "@tanstack/react-router";
import { Camera, FolderLock, Image as ImageIcon, Shield, Zap, CheckCircle } from "lucide-react";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Studio Client — Livraison Photo Professionnelle" },
      { name: "description", content: "Plateforme privée de livraison de photos pour les clients de l'agence." },
    ],
  }),
  component: Index,
});

function Index() {
  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border/50 bg-card/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <Link to="/" className="flex items-center gap-2.5">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-sm">
              <Camera className="h-5 w-5" />
            </div>
            <span className="text-lg font-semibold tracking-tight">Studio Client</span>
          </Link>
          <Link
            to="/auth"
            className="inline-flex items-center gap-2 rounded-lg bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground shadow-sm transition-all-fast hover:bg-primary/90 hover:shadow-md"
          >
            Se connecter
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-6">
        <section className="py-20 lg:py-28">
          <div className="grid gap-12 lg:grid-cols-2 lg:items-center">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full bg-primary/10 px-4 py-1.5 text-sm font-medium text-primary">
                <Zap className="h-3.5 w-3.5" />
                Livraison instantanée
              </div>
              <h1 className="mt-6 text-4xl font-bold leading-tight tracking-tight md:text-5xl lg:text-[3.25rem]">
                Vos photos, livrées
                <span className="text-primary"> en ligne.</span>
              </h1>
              <p className="mt-5 max-w-lg text-lg leading-relaxed text-muted-foreground">
                Un espace privé sécurisé pour chaque client. Connectez-vous avec votre code
                et accédez à tous vos projets, organisés par dossiers.
              </p>
              <div className="mt-8 flex flex-wrap gap-3">
                <Link
                  to="/auth"
                  className="inline-flex items-center gap-2 rounded-lg bg-primary px-6 py-3 text-sm font-medium text-primary-foreground shadow-sm transition-all-fast hover:bg-primary/90 hover:shadow-md"
                >
                  Accéder à mon espace
                </Link>
              </div>
              <div className="mt-8 flex items-center gap-6 text-sm text-muted-foreground">
                <div className="flex items-center gap-2">
                  <CheckCircle className="h-4 w-4 text-emerald-500" />
                  100% sécurisé
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle className="h-4 w-4 text-emerald-500" />
                  Accès immédiat
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle className="h-4 w-4 text-emerald-500" />
                  Support réactif
                </div>
              </div>
            </div>

            <div className="relative">
              <div className="absolute inset-0 rounded-3xl bg-gradient-to-br from-primary/20 to-primary/5 blur-3xl" />
              <div className="relative grid gap-4 sm:grid-cols-2">
                {[
                  { icon: FolderLock, title: "Espace privé", desc: "Un dossier sécurisé par client, accessible uniquement à vous." },
                  { icon: ImageIcon, title: "Photos HD", desc: "Visualisez et téléchargez vos images en haute qualité." },
                  { icon: Camera, title: "Plusieurs projets", desc: "Mariage, événement, shooting… tout est organisé." },
                  { icon: Shield, title: "Code à 8 chiffres", desc: "Identifiant unique remis par l'agence. Simple et rapide." },
                ].map((f) => (
                  <div key={f.title} className="group rounded-2xl border border-border/50 bg-card p-6 shadow-card transition-all-fast hover:border-primary/30 hover:shadow-card-hover">
                    <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary transition-all-fast group-hover:bg-primary group-hover:text-primary-foreground">
                      <f.icon className="h-5 w-5" />
                    </div>
                    <h3 className="mt-4 font-semibold tracking-tight">{f.title}</h3>
                    <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{f.desc}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section className="border-t border-border/50 py-16">
          <div className="grid gap-8 md:grid-cols-3">
            {[
              { number: "500+", label: "Clients satisfaits" },
              { number: "10K+", label: "Photos livrées" },
              { number: "99.9%", label: "Disponibilité" },
            ].map((stat) => (
              <div key={stat.label} className="text-center">
                <div className="text-3xl font-bold tracking-tight text-primary">{stat.number}</div>
                <div className="mt-1 text-sm text-muted-foreground">{stat.label}</div>
              </div>
            ))}
          </div>
        </section>
      </main>

      <footer className="border-t border-border/50 bg-card/50">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-6">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Camera className="h-4 w-4" />
            © {new Date().getFullYear()} Studio Client
          </div>
          <div className="text-xs text-muted-foreground">
            Tous droits réservés
          </div>
        </div>
      </footer>
    </div>
  );
}

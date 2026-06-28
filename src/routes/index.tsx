import { createFileRoute, Link } from "@tanstack/react-router";
import { Camera, FolderLock, Image as ImageIcon } from "lucide-react";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Studio — Espace client privé" },
      { name: "description", content: "Plus de clés USB : recevez vos photos en ligne, simplement." },
    ],
  }),
  component: Index,
});

function Index() {
  return (
    <div className="min-h-screen bg-background">
      <header className="border-b">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-5">
          <div className="flex items-center gap-2">
            <div className="grid h-9 w-9 place-items-center rounded-md bg-primary text-primary-foreground">
              <Camera className="h-5 w-5" />
            </div>
            <span className="text-lg font-semibold">Studio Client</span>
          </div>
          <Link
            to="/auth"
            className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90"
          >
            Se connecter
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-6 py-20">
        <section className="grid gap-12 lg:grid-cols-2 lg:items-center">
          <div>
            <span className="inline-flex rounded-full bg-accent px-3 py-1 text-xs font-medium text-accent-foreground">
              Agence digitale · Photographie
            </span>
            <h1 className="mt-5 text-4xl font-bold leading-tight md:text-5xl">
              Vos photos, livrées en ligne.
              <span className="text-primary"> Fini les clés USB.</span>
            </h1>
            <p className="mt-5 text-lg text-muted-foreground">
              Un espace privé pour chaque client. Connectez-vous avec votre code à 8 chiffres
              et accédez à tous vos projets, organisés par dossiers.
            </p>
            <div className="mt-8 flex gap-3">
              <Link
                to="/auth"
                className="rounded-md bg-primary px-5 py-3 text-sm font-medium text-primary-foreground hover:opacity-90"
              >
                Accéder à mon espace
              </Link>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            {[
              { icon: FolderLock, title: "Espace privé", desc: "Un dossier sécurisé par client, accessible uniquement à vous." },
              { icon: ImageIcon, title: "Photos HD", desc: "Visualisez et téléchargez vos images en haute qualité." },
              { icon: Camera, title: "Plusieurs projets", desc: "Mariage, événement, shooting… tout est organisé par projet." },
              { icon: FolderLock, title: "Code à 8 chiffres", desc: "Identifiant unique remis par l'agence. Simple et rapide." },
            ].map((f) => (
              <div key={f.title} className="rounded-xl border bg-card p-5">
                <f.icon className="h-6 w-6 text-primary" />
                <h3 className="mt-3 font-semibold">{f.title}</h3>
                <p className="mt-1 text-sm text-muted-foreground">{f.desc}</p>
              </div>
            ))}
          </div>
        </section>
      </main>

      <footer className="border-t">
        <div className="mx-auto max-w-6xl px-6 py-6 text-sm text-muted-foreground">
          © {new Date().getFullYear()} Studio Client — Tous droits réservés.
        </div>
      </footer>
    </div>
  );
}

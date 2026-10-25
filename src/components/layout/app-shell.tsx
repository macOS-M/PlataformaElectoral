import Link from "next/link";
import { Compass, LogOut, ShieldCheck, MapPin } from "lucide-react";
import { Navigation, Breadcrumb } from "./navigation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { signOut } from "@/modules/auth/actions";
import type { AccessContext } from "@/server/authorization/context";
export function AppShell({
  scope,
  children,
}: {
  scope: AccessContext | null;
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen lg:grid lg:grid-cols-[252px_1fr]">
      <a
        href="#contenido"
        className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 focus:rounded focus:bg-white focus:p-3"
      >
        Saltar al contenido
      </a>
      <aside className="sidebar flex flex-col text-white lg:sticky lg:top-0 lg:h-screen">
        <Link
          href="/resumen"
          className="flex items-center gap-3 px-7 pt-7 pb-5"
        >
          <span className="flex size-10 items-center justify-center rounded-xl border border-white/20 bg-white/10">
            <Compass size={25} aria-hidden="true" />
          </span>
          <span className="text-lg font-semibold tracking-tight">
            Cantonal
            <span className="mt-0.5 block text-[10px] font-medium tracking-[0.18em] text-emerald-100/60">
              PLATAFORMA ELECTORAL
            </span>
          </span>
        </Link>
        <div className="mx-6 mt-4 hidden rounded-lg border border-white/10 bg-white/5 p-3 lg:block">
          <p className="text-[10px] tracking-widest text-emerald-100/50">
            ÁMBITO TERRITORIAL
          </p>
          <p className="mt-2 flex items-center gap-2 text-sm">
            <MapPin size={14} />
            {scope?.cantonName ?? "Cantón por configurar"}
          </p>
        </div>
        <p className="mt-8 px-8 text-[10px] font-semibold tracking-[0.18em] text-emerald-100/40 max-lg:hidden">
          GESTIÓN CANTONAL
        </p>
        <Navigation />
        <div className="mt-auto hidden p-6 lg:block">
          <div className="rounded-xl border border-white/10 p-4">
            <ShieldCheck className="mb-3 text-emerald-300" size={20} />
            <p className="text-sm font-medium">Información responsable</p>
            <p className="mt-2 text-xs leading-relaxed text-emerald-100/55">
              Herramienta de coordinación interna. No sustituye registros ni
              acreditaciones del TSE.
            </p>
          </div>
          <p className="mt-5 text-[11px] text-emerald-100/40">
            Sprint 1 · Base organizacional
          </p>
        </div>
      </aside>
      <div className="min-w-0">
        <header className="flex min-h-20 items-center justify-between gap-3 border-b bg-card px-5 lg:px-9">
          <Breadcrumb />
          <div className="flex items-center gap-3">
            <Badge className="hidden sm:inline-flex">
              {scope ? "Acceso privado" : "Vista inicial"}
            </Badge>
            {scope ? (
              <form action={signOut}>
                <Button variant="ghost" size="sm">
                  <LogOut size={15} />
                  Salir
                </Button>
              </form>
            ) : (
              <Button variant="outline" size="sm" asChild>
                <Link href="/iniciar-sesion">Iniciar sesión</Link>
              </Button>
            )}
          </div>
        </header>
        <main
          id="contenido"
          className="mx-auto max-w-[1440px] space-y-7 p-5 lg:p-9"
        >
          {!scope ? (
            <div className="flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950">
              <ShieldCheck className="mt-0.5 shrink-0" size={18} />
              <div>
                <strong>Tu espacio está listo para configurar.</strong>
                <p className="mt-1 text-amber-900/80">
                  Aún no hay una conexión habilitada. Estas pantallas no
                  muestran datos electorales ni registros oficiales.
                </p>
              </div>
            </div>
          ) : scope.isDemo ? (
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-950">
              <strong>Entorno de demostración.</strong> Los centros y
              territorios de este evento son sintéticos, sin validez oficial.
            </div>
          ) : null}
          {children}
          <footer className="flex flex-wrap justify-between gap-2 border-t pt-5 text-xs text-muted-foreground">
            <span>Plataforma Electoral Cantonal</span>
            <span>Organización y territorio · Costa Rica</span>
          </footer>
        </main>
      </div>
    </div>
  );
}

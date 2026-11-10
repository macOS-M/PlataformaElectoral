import { BrandLogo } from "@/components/brand-logo";
import Link from "next/link";
import { LogOut, ShieldCheck, MapPin } from "lucide-react";
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
          <BrandLogo inverse className="w-[196px]" />
        </Link>
        <div className="mx-6 mt-4 hidden rounded-lg border border-white/10 bg-white/5 p-3 lg:block">
          <p className="text-[10px] tracking-widest text-violet-100/50">
            ÁMBITO TERRITORIAL
          </p>
          <p className="mt-2 flex items-center gap-2 text-sm">
            <MapPin size={14} />
            {scope?.cantonName ?? "Cantón por configurar"}
          </p>
        </div>
        <p className="mt-8 px-8 text-[10px] font-semibold tracking-[0.18em] text-violet-100/40 max-lg:hidden">
          GESTIÓN CANTONAL
        </p>
        <Navigation admin={scope?.role === "admin"} />
        <div className="mt-auto hidden p-6 lg:block">
        </div>
      </aside>
      <div className="min-w-0">
        <header className="flex min-h-20 items-center justify-between gap-3 border-b bg-card px-5 lg:px-9">
          <Breadcrumb />
          <div className="flex items-center gap-3">
            <Badge className="hidden sm:inline-flex">
              {scope
                ? scope.role === "admin"
                  ? "Admin global"
                  : scope.editableModules.includes("district")
                    ? "Coordinación distrital"
                    : scope.editableModules.length
                      ? "Coordinador de área"
                      : "Solo lectura"
                : "Vista inicial"}
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
              <strong>Entorno de demostración.</strong> La información
              registrada es de coordinación interna y no tiene verificación
              oficial.
            </div>
          ) : null}
          {children}
          <footer className="flex flex-wrap justify-between gap-2 border-t pt-5 text-xs text-muted-foreground">
            <span>SIPEC · Sistema Integral Político-Electoral Cantonal</span>
            <span>Organización y territorio · Costa Rica</span>
          </footer>
        </main>
      </div>
    </div>
  );
}

import { BrandLogo } from "@/components/brand-logo";
import Link from "next/link";
import { ArrowRight, Bus, MapPin, MessageSquare } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getPublicPortal } from "@/modules/public-portal/service";
import { TerritorySelector } from "@/modules/public-portal/territory-selector";
import type { TerritoryQuery } from "@/modules/public-portal/types";

export const metadata = {
  title: "Información ciudadana",
  description: "Información y servicios ciudadanos de SIPEC.",
};

export default async function Home({ searchParams }: { searchParams: Promise<TerritoryQuery> }) {
  const portal = await getPublicPortal(await searchParams);
  const selectionKey = portal.selection ? `${portal.selection.canton.id}/${portal.selection.district.id}` : "none";
  return (
    <div className="flex min-h-svh flex-col">
      <a href="#contenido" className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 focus:rounded focus:bg-white focus:p-3">
        Saltar al contenido
      </a>
      <header className="border-b bg-card">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3 sm:px-8">
          <Link href="/" className="flex items-center gap-3 font-semibold text-primary" aria-label="SIPEC · Inicio">
            <BrandLogo className="w-[150px] sm:w-[180px]" />
          </Link>
          <Button asChild variant="outline" className="min-h-11">
            <Link href="/iniciar-sesion" prefetch={false}>Acceso interno <ArrowRight size={16} aria-hidden="true" /></Link>
          </Button>
        </div>
      </header>

      <main id="contenido" className="mx-auto w-full max-w-6xl flex-1 space-y-6 px-4 py-6 sm:px-8 sm:py-10">
        <section className="sidebar hero-grid rounded-2xl p-5 text-white sm:p-8" aria-labelledby="titulo-publico">
          <p className="text-xs font-semibold tracking-widest text-violet-200">ESPACIO CIUDADANO · COSTA RICA</p>
          <h1 id="titulo-publico" className="mt-3 text-2xl font-semibold leading-tight tracking-tight sm:text-4xl">Los servicios de tu cantón y distrito</h1>
          <p className="mt-3 max-w-2xl text-sm leading-relaxed text-violet-50 sm:text-base">Elegí tu cantón y distrito para conocer la información y los servicios disponibles en tu zona. No necesitás iniciar sesión.</p>
        </section>

        <section aria-labelledby="titulo-territorio">
          <Card>
            <CardHeader className="flex items-center gap-2">
              <MapPin size={21} className="shrink-0 text-primary" aria-hidden="true" />
              <CardTitle id="titulo-territorio">Seleccioná tu zona</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">Mostramos únicamente los cantones y distritos configurados en la plataforma.</p>
              {portal.unavailable ? <p role="status" className="rounded-lg border bg-muted p-3 text-sm">El catálogo de cantones y distritos no está disponible en este momento. Podés consultar dónde votar en el sitio oficial del TSE.</p>
                : !portal.territories.length && <p role="status" className="rounded-lg border bg-muted p-3 text-sm">Aún no hay cantones disponibles para seleccionar.</p>}
              {portal.invalidSelection && <p role="alert" className="text-sm text-destructive">La zona seleccionada no está disponible. Elegí un cantón y un distrito del listado.</p>}
              <TerritorySelector key={selectionKey} territories={portal.territories} selectedCanton={portal.selection?.canton.id} selectedDistrict={portal.selection?.district.id} />
            </CardContent>
          </Card>
        </section>

        {portal.selection && <section aria-labelledby="titulo-servicios" className="space-y-4">
          <div>
            <h2 id="titulo-servicios" className="text-xl font-semibold">Servicios en {portal.selection.district.name}, {portal.selection.canton.name}</h2>
            <p className="mt-1 text-sm text-muted-foreground">Consultá el estado de cada servicio para tu zona.</p>
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            <Card>
              <CardHeader className="flex items-center gap-2"><MapPin size={20} className="shrink-0 text-primary" aria-hidden="true" /><CardTitle>Lugar de votación</CardTitle></CardHeader>
              <CardContent className="text-sm leading-relaxed"><p className="font-medium text-primary">Disponible en el sitio oficial del TSE</p><p>La consulta se realiza directamente en el enlace oficial de abajo.</p></CardContent>
            </Card>
            <Card>
              <CardHeader className="flex items-center gap-2"><Bus size={20} className="shrink-0 text-primary" aria-hidden="true" /><CardTitle>Opciones de transporte</CardTitle></CardHeader>
              <CardContent className="text-sm leading-relaxed"><p className="font-medium">Pendiente de habilitación</p><p>La consulta pública de transporte aún no está habilitada.</p></CardContent>
            </Card>
            <Card>
              <CardHeader className="flex items-center gap-2"><MessageSquare size={20} className="shrink-0 text-primary" aria-hidden="true" /><CardTitle>Denuncias ciudadanas</CardTitle></CardHeader>
              <CardContent className="text-sm leading-relaxed"><p className="font-medium">Pendiente de habilitación</p><p>La recepción de denuncias aún no está habilitada.</p></CardContent>
            </Card>
          </div>
        </section>}

        <section aria-labelledby="titulo-consulta" className="rounded-xl border bg-card p-4 sm:p-5">
          <h2 id="titulo-consulta" className="font-semibold">¿Querés saber dónde votar?</h2>
          <p className="mt-2 text-sm text-muted-foreground">Consultá en el sitio oficial del Tribunal Supremo de Elecciones (TSE). No necesitás seleccionar una zona para acceder.</p>
          <Button asChild className="mt-4 min-h-11 w-full sm:w-auto">
            <a href="https://www.tse.go.cr/DondeVotar/" referrerPolicy="no-referrer">Consultar dónde votar en el TSE <ArrowRight size={16} aria-hidden="true" /></a>
          </Button>
          <p className="mt-3 text-xs leading-relaxed text-muted-foreground">Continuarás al sitio oficial del TSE. Esta plataforma no solicita ni guarda cédulas para esta consulta.</p>
        </section>
      </main>
      <footer className="border-t px-4 py-2 text-center text-xs text-muted-foreground">SIPEC · Sistema Integral Político-Electoral Cantonal · Costa Rica</footer>
    </div>
  );
}

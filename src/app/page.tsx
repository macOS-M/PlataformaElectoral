import { BrandLogo } from "@/components/brand-logo";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowRight,ArrowUpRight,MapPin,ShieldCheck,Compass } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getPublicPortal } from "@/modules/public-portal/service";
import { TerritorySelector } from "@/modules/public-portal/territory-selector";
import type { TerritoryQuery } from "@/modules/public-portal/types";

export const metadata={title:"Información ciudadana",description:"Información y servicios ciudadanos de SIPEC."};
export default async function Home({searchParams}:{searchParams:Promise<TerritoryQuery>}){
 const portal=await getPublicPortal(await searchParams);
 // Preserve saved links from the previous GET flow without keeping two results screens.
 if(portal.selection){const query=new URLSearchParams({canton:portal.selection.canton.id,district:portal.selection.district.id});if(portal.selection.canton.province)query.set("province",portal.selection.canton.province.id);redirect(`/servicios?${query}`);}
 return <div className="citizen-home flex min-h-svh flex-col">
  <a href="#contenido" className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 focus:rounded focus:bg-white focus:p-3">Saltar al contenido</a>
  <header className="mx-auto flex w-full max-w-7xl items-center justify-between gap-3 px-5 py-5 sm:px-10"><Link href="/" className="flex items-center gap-2 text-xs font-semibold tracking-wide" aria-label="SIPEC · Inicio"><span className="size-2 rounded-full bg-primary"/>PORTAL CIUDADANO</Link><Button asChild variant="ghost" className="min-h-11 text-xs sm:text-sm"><Link href="/iniciar-sesion" prefetch={false}>Acceso interno <ArrowUpRight size={16} aria-hidden="true"/></Link></Button></header>
  <main id="contenido" className="mx-auto w-full max-w-7xl flex-1 px-4 pb-6 sm:px-8">
   <div className="citizen-stage overflow-hidden rounded-[2rem] border border-white bg-white shadow-[0_24px_80px_-40px_#29204450]">
    <section className="citizen-brand relative isolate flex flex-col overflow-hidden px-7 py-8 text-white sm:px-12 sm:py-10" aria-labelledby="titulo-publico">
     <svg className="citizen-route" viewBox="0 0 600 750" fill="none" aria-hidden="true"><path d="M600 75H380a100 100 0 0 0 0 200h20a100 100 0 0 1 0 200H220a100 100 0 0 0 0 200h380" stroke="currentColor" strokeWidth="60"/><circle cx="380" cy="75" r="17" fill="currentColor"/><circle cx="400" cy="475" r="17" fill="currentColor"/><circle cx="220" cy="675" r="17" fill="currentColor"/></svg>
     <BrandLogo inverse className="relative -ml-4 w-[calc(100%+2rem)] max-w-[430px]"/>
     <div className="relative mt-5 mb-8 lg:mt-10 lg:mb-12">

      <h1 id="titulo-publico" className="max-w-lg text-[2rem] font-semibold leading-[1.14] tracking-[-0.045em] sm:text-5xl lg:text-[3.25rem]">Los servicios de tu <span className="text-[#c4b5fd]">cantón y distrito</span></h1>

     </div>

    </section>
    <section aria-labelledby="titulo-territorio" className="citizen-zone flex flex-col px-6 py-8 sm:px-10 sm:py-10 lg:px-12">
     <div className="mb-6 flex items-start justify-between gap-4"><div><h2 id="titulo-territorio" className="text-2xl font-semibold tracking-tight">Seleccioná tu zona</h2></div><span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-muted text-primary"><Compass size={23} aria-hidden="true"/></span></div>
     <p className="mb-7 text-sm leading-relaxed text-muted-foreground">Elegí provincia, cantón y distrito para descubrir qué hay disponible para vos.</p>
     {portal.unavailable?<p role="status" className="mb-5 rounded-lg border bg-muted p-3 text-sm">El catálogo de cantones y distritos no está disponible en este momento. Podés consultar dónde votar en el sitio oficial del TSE.</p>:!portal.territories.length&&<p role="status" className="mb-5 rounded-lg border bg-muted p-3 text-sm">Aún no hay cantones disponibles para seleccionar.</p>}
     {portal.invalidSelection&&<p role="alert" className="mb-5 text-sm text-red-800">La zona seleccionada no está disponible. Elegí un cantón y un distrito del listado.</p>}
     <TerritorySelector territories={portal.territories} action="/servicios" stacked/>
     </section>
   </div>
   <section aria-labelledby="titulo-consulta" className="mt-5 flex flex-col gap-5 rounded-2xl border border-white bg-white/65 px-6 py-5 sm:flex-row sm:items-center sm:justify-between sm:px-8"><div><h2 id="titulo-consulta" className="text-sm font-semibold">¿Querés saber dónde votar?</h2><p className="mt-1 text-xs leading-relaxed text-muted-foreground">Consultá directamente en el sitio oficial del TSE.</p></div><a className="inline-flex min-h-11 shrink-0 items-center justify-between gap-4 rounded-xl border bg-white px-4 text-xs font-semibold text-primary transition-colors hover:bg-muted" href="https://www.tse.go.cr/DondeVotar/" referrerPolicy="no-referrer">Consultar dónde votar en el TSE <ArrowRight size={16} aria-hidden="true"/></a></section>
  </main><footer className="mx-auto flex w-full max-w-7xl flex-col gap-2 px-6 py-5 text-[10px] text-muted-foreground sm:flex-row sm:justify-between sm:px-10"><span>SIPEC · Sistema Integral Político-Electoral Cantonal</span><span>Costa Rica · Servicios ciudadanos</span></footer>
 </div>;
}

import Link from "next/link";
import { BrandLogo } from "@/components/brand-logo";
export function PublicTransportShell({title,description,children}:{title:string;description:string;children:React.ReactNode}){
 return <div className="min-h-svh"><header className="border-b bg-card"><div className="mx-auto flex max-w-5xl items-center justify-between gap-3 px-4 py-4 sm:px-8"><Link href="/" aria-label="SIPEC · Inicio"><BrandLogo className="w-[150px]"/></Link><Link href="/" className="min-h-11 py-3 text-sm font-semibold text-primary">Volver al inicio</Link></div></header><main className="mx-auto max-w-5xl space-y-6 px-4 py-8 sm:px-8"><div><p className="text-xs font-semibold tracking-widest text-primary uppercase">Servicios ciudadanos</p><h1 className="mt-2 text-3xl font-semibold tracking-tight">{title}</h1><p className="mt-3 max-w-2xl text-sm leading-relaxed text-muted-foreground">{description}</p></div>{children}</main></div>;
}

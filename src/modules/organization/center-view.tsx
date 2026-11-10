import Link from "next/link";
import { Network, Truck, GraduationCap, Package, ArrowUpRight } from "lucide-react";
import { getCenterDetail } from "@/modules/voting-centers/area-service";
import { canUseInventory } from "@/modules/inventory/policy";
import { CenterInventory } from "@/modules/inventory/center-summary";
export async function CenterOrganization({centerId}:{centerId:string}){
 const {center,areas:all,scope}=await getCenterDetail(centerId);
 const areas=all.filter(a=>a.code!=="A09");
 return <>
  <section className="rounded-2xl border bg-card p-5 sm:p-8">
   <div className="mx-auto max-w-lg rounded-xl border border-primary/30 bg-primary/5 p-5 text-center"><Network className="mx-auto mb-3 text-primary"/><p className="text-xs text-muted-foreground">Equipo del centro · {center.district}</p><h2 className="mt-1 text-lg font-semibold">{center.name}</h2><p className="mt-2 text-sm text-muted-foreground">{areas.filter(a=>a.assignmentId).length} de {areas.length} áreas con responsable</p></div>
   <div className="mx-auto h-8 w-px bg-border"/>
   <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{areas.map(area=><Link href={`/centros/${centerId}/areas/${area.code}`} key={area.id} className="rounded-xl border p-4 transition-colors hover:border-primary"><p className="text-xs text-muted-foreground">Responsabilidad del centro</p><h3 className="mt-1 text-sm font-semibold">{area.name}</h3><p className={`mt-4 text-sm ${area.responsible?"":"text-muted-foreground"}`}>{area.responsible??"Vacante"}</p><span className="mt-3 flex items-center gap-1 text-xs text-primary">Responsable, historial y documentos <ArrowUpRight size={14}/></span></Link>)}</div>
  </section>
  <section className="grid gap-4 md:grid-cols-2"><Link href={`/capacitacion?center=${centerId}`} className="rounded-xl border bg-card p-5 hover:border-primary"><GraduationCap className="mb-3 text-primary"/><h2 className="font-semibold">Capacitación del equipo</h2><p className="mt-2 text-sm text-muted-foreground">Requisitos y asistencia de los responsables de este centro.</p></Link><Link href={`/transporte?center=${centerId}`} className="rounded-xl border bg-card p-5 hover:border-primary"><Truck className="mb-3 text-primary"/><h2 className="font-semibold">Transporte del centro</h2><p className="mt-2 text-sm text-muted-foreground">Conductores, vehículos, documentos privados y agenda de este centro.</p></Link></section>
  <Link href={`/centros/${centerId}/fiscales`} className="block rounded-xl border border-primary/30 bg-primary/5 p-5 text-primary"><h2 className="font-semibold">Fiscales del centro y JRV</h2><p className="mt-2 text-sm">Fiscal general y suplentes del centro; titular y suplente por junta receptora de votos.</p></Link>
  {canUseInventory(scope)&&<><div className="flex items-center gap-2"><Package size={20}/><h2 className="font-semibold">Inventario del centro</h2></div><CenterInventory centerId={centerId}/></>}
  <p className="text-xs text-muted-foreground">Las personas son compartidas. Asignar un responsable no concede permisos de usuario ni crea vehículos o existencias.</p>
 </>;
}

import { CenterInventory } from "@/modules/inventory/center-summary";
import Link from "next/link";
import { ArrowLeft, ArrowUpRight, Flag, Users, MapPin, Vote, Truck, Utensils, CalendarCheck, Megaphone, Landmark } from "lucide-react";
import { getCenterDetail } from "@/modules/voting-centers/area-service";
import { areaCodeSchema, areaDescriptions } from "@/modules/voting-centers/area-schemas";
import { PageHeading } from "@/components/page-heading";
import { Card } from "@/components/ui/card";

export const metadata = { title: "Ficha del centro" };
const icons = [Flag, Users, MapPin, Vote, Truck, Utensils, CalendarCheck, Megaphone, Landmark];
export default async function CenterDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { center, areas } = await getCenterDetail(id);
  return <>
    <Link href="/centros" className="flex items-center gap-2 text-sm text-muted-foreground hover:text-primary"><ArrowLeft size={16} />Volver a centros</Link>
    <PageHeading eyebrow={`Distrito ${center.district}`} title={center.name} description={center.address} />
    <Link href={`/centros/${id}/organigrama`} className="rounded-xl border border-primary/30 bg-primary/5 p-5 text-sm font-semibold text-primary">Abrir organigrama y operación de este centro →</Link>
    <Link href={`/centros/${id}/fiscales`} className="text-sm font-semibold text-primary">Fiscales generales, suplentes y fiscales de mesa por JRV →</Link>
    <div><h2 className="text-lg font-semibold">Áreas de coordinación</h2><p className="mt-1 text-sm text-muted-foreground">Abre un área para consultar su encargado y documentos.</p></div>
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {areas.filter(area=>area.code!=="A09").map((area, i) => {
        const code = areaCodeSchema.safeParse(area.code);
        if (!code.success) return null;
        const Icon = icons[Number(area.code.slice(1)) - 1] ?? icons[i % icons.length];
        return <Link key={area.id} href={`/centros/${id}/areas/${area.code}`} className="group rounded-xl focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-primary">
          <Card className="h-full p-5 transition-colors group-hover:border-primary/40 group-hover:bg-primary/5">
            <div className="mb-5 flex items-center justify-between"><span className="rounded-xl bg-primary/10 p-3 text-primary"><Icon size={22} /></span><ArrowUpRight size={18} className="text-muted-foreground group-hover:text-primary" /></div>
            <h3 className="text-base font-semibold">{area.name}</h3><p className="mt-1 text-sm text-muted-foreground">{areaDescriptions[code.data]}</p>
            <div className="mt-5 border-t pt-3 text-sm"><p className="text-xs text-muted-foreground">Encargado</p><p className={area.responsible ? "mt-1 font-medium" : "mt-1 text-muted-foreground"}>{area.responsible ?? "Sin encargado asignado"}</p></div>
          </Card>
        </Link>;
      })}
    </div>
    <CenterInventory centerId={id}/>
  </>;
}

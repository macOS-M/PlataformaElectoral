import { PageHeading } from "@/components/page-heading";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TerritorySelector } from "@/modules/public-portal/territory-selector";
import type { TerritoryQuery } from "@/modules/public-portal/types";
import { TerritoryForm } from "@/modules/territories/forms";
import { getTerritories } from "@/modules/territories/service";
import { resolveTerritorySelection } from "@/modules/territories/selection";

export const metadata = { title: "Jerarquía territorial" };
export default async function TerritoriesPage({ searchParams }: { searchParams: Promise<TerritoryQuery> }) {
  const data = await getTerritories();
  const query = await searchParams;
  const selection = resolveTerritorySelection(data.territories, query);
  return <>
    <PageHeading eyebrow="Catálogo compartido" title="Jerarquía territorial" description="Provincias, cantones y distritos existentes, sin duplicar entidades entre módulos." />
    {!data.configured && <p role="status">Configurá la conexión para consultar el catálogo territorial.</p>}
    <Card><CardHeader><CardTitle>Navegar dependencias</CardTitle></CardHeader><CardContent className="space-y-4">
      <p className="text-sm text-muted-foreground">Se muestran los cantones disponibles del catálogo configurado y sus distritos activos. En eventos de demostración se incluyen los cantones vinculados para pruebas; las operaciones conservan su ámbito.</p>
      {data.configured && !selection && (query.province || query.canton || query.district) && <p role="alert">La selección no corresponde al catálogo disponible.</p>}
      <TerritorySelector key={selection ? `${selection.canton.id}/${selection.district.id}` : "none"} territories={data.territories} provinces={data.provinces} selectedCanton={selection?.canton.id} selectedDistrict={selection?.district.id} action="/territorios" buttonLabel="Ver dependencias" />
      {selection && <p role="status">{selection.canton.province?.name ?? "Provincia sin configurar"} → {selection.canton.name} → {selection.district.name}</p>}
      {data.territories.map(canton => <div key={canton.id} className="rounded-lg border p-4">
        <h2 className="font-semibold">{canton.name} · {canton.province?.name ?? "Provincia sin configurar"}</h2>
        <p className="mt-1 break-all text-xs text-muted-foreground">Identificador: {canton.id}</p>
        {canton.districts.length ? <ul className="mt-3 space-y-2 text-sm">{canton.districts.map(d => <li key={d.id}>{d.name}</li>)}</ul> : <p className="mt-3 text-sm">Este cantón no tiene distritos activos configurados.</p>}
      </div>)}
    </CardContent></Card>
    {data.admin && <>
      <Card><CardHeader><CardTitle>Registrar provincia compartida</CardTitle></CardHeader><CardContent><TerritoryForm provinces={data.provinces} /></CardContent></Card>
      {data.territories.filter(canton => canton.id === data.editableCantonId).map(canton => <Card key={canton.id}><CardHeader><CardTitle>Vincular {canton.name}</CardTitle></CardHeader><CardContent><TerritoryForm key={canton.province?.id ?? "none"} provinces={data.provinces} canton={canton} /></CardContent></Card>)}
    </>}
  </>;
}

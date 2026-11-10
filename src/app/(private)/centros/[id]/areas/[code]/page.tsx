import Link from "next/link";
import { ArrowLeft, Download, FileText } from "lucide-react";
import { getCenterArea } from "@/modules/voting-centers/area-service";
import { ResponsibleForm, DocumentForm } from "@/modules/voting-centers/area-forms";
import { PageHeading } from "@/components/page-heading";
import { Card } from "@/components/ui/card";

export const metadata = { title: "Área del centro" };
const categories: Record<string, string> = { contrato: "Contrato", cedula: "Cédula", otro: "Otro documento" };
export default async function CenterArea({ params }: { params: Promise<{ id: string; code: string }> }) {
  const { id, code } = await params;
  const data = await getCenterArea(id, code);
  const current = data.history.find(h => !h.endedAt);
  const person = data.directory.find(p => p.id === current?.personId);
  return <>
    <Link href={`/centros/${id}`} className="flex items-center gap-2 text-sm text-muted-foreground hover:text-primary"><ArrowLeft size={16} />Volver a {data.center.name}</Link>
    <PageHeading eyebrow={data.center.name} title={data.area.name} description="Encargado, datos de contacto y documentos de esta área en el centro." />
    {code==="A04"&&<Link href={`/centros/${id}/fiscales`} className="rounded-xl border border-primary/30 bg-primary/5 p-4 text-sm font-semibold text-primary">Gestionar fiscales generales y fiscales por JRV →</Link>}
    <div className="flex flex-wrap gap-4 text-sm font-medium text-primary"><Link href={`/centros/${id}/organigrama`}>Organigrama del centro</Link><Link href={`/capacitacion?center=${id}`}>Capacitación del equipo</Link>{code==="A05"&&<Link href={`/transporte?center=${id}`}>Gestionar transporte del centro</Link>}</div>
    <div className="grid items-start gap-6 xl:grid-cols-2">
      <Card className="p-5 sm:p-6"><h2 className="mb-5 text-lg font-semibold">Encargado del área</h2>
        {data.canEdit ? <ResponsibleForm key={`${current?.id ?? "new"}-${person?.version ?? ""}`} centerId={id} areaCode={code} expectedId={current?.id ?? ""} currentPersonId={current?.personId ?? ""} directory={data.directory} /> : person ? <dl className="space-y-3 text-sm"><div><dt className="text-muted-foreground">Nombre</dt><dd className="font-medium">{person.fullName}</dd></div><div><dt className="text-muted-foreground">Teléfono</dt><dd>{person.phone || "Sin registrar"}</dd></div><div><dt className="text-muted-foreground">Correo</dt><dd>{person.email || "Sin registrar"}</dd></div><div><dt className="text-muted-foreground">Observaciones</dt><dd className="whitespace-pre-wrap">{person.notes || "Sin observaciones"}</dd></div></dl> : <p className="text-sm text-muted-foreground">Todavía no hay un encargado asignado.</p>}
        {!data.canEdit && <p className="mt-5 text-xs text-muted-foreground">Tienes acceso de consulta a esta área.</p>}
      </Card>
      <Card className="p-5 sm:p-6"><h2 className="mb-5 text-lg font-semibold">Documentos adjuntos</h2>
        {data.documents.length ? <ul className="mb-6 space-y-3">{data.documents.map(doc => <li key={doc.id} className="flex min-w-0 items-start gap-3 rounded-lg border p-3"><FileText size={20} className="mt-0.5 shrink-0 text-primary" /><div className="min-w-0 flex-1"><a href={`/centros/${id}/areas/${code}/documentos/${doc.id}`} className="flex items-start gap-2 text-sm font-medium text-primary underline"><span className="break-all">{doc.filename}</span><Download size={15} className="shrink-0" /></a><p className="mt-1 text-xs text-muted-foreground">{categories[doc.category]} · {Math.ceil(doc.byteSize / 1024)} KB · {doc.createdAt.toLocaleDateString("es-CR", { timeZone: "America/Costa_Rica" })}</p></div></li>)}</ul> : <p className="mb-5 text-sm text-muted-foreground">Aún no hay documentos adjuntos.</p>}
        {data.canEdit && <DocumentForm centerId={id} areaCode={code} />}
      </Card>
    </div>
    {data.history.some(h => h.endedAt) && <Card className="p-5 sm:p-6"><h2 className="mb-4 text-lg font-semibold">Historial de encargados</h2><ul className="space-y-3">{data.history.filter(h => h.endedAt).map(h => <li key={h.id} className="border-t pt-3 text-sm"><p className="font-medium">{h.fullName}</p><p className="mt-1 text-muted-foreground">{h.reason}</p></li>)}</ul></Card>}
  </>;
}

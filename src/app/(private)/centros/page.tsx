import Link from "next/link";
import { Search, School, ChevronLeft, ChevronRight } from "lucide-react";
import { getCenters } from "@/modules/voting-centers/service";
import { getOrganization } from "@/modules/organization/service";
import { statusLabels } from "@/modules/voting-centers/schemas";
import { PageHeading } from "@/components/page-heading";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/empty-state";
import { getAccessContext } from "@/server/authorization/context";
import { isGlobalAdmin } from "@/server/authorization/policy";
export const metadata = { title: "Centros de votación" };
export default async function Centers({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const [data, org, scope] = await Promise.all([
    getCenters(params),
    getOrganization(),
    getAccessContext(),
  ]);
  const url = (page: number) =>
    `/centros?${new URLSearchParams({ q: data.filters.q, district: data.filters.district, status: data.filters.status, page: String(page) })}`;
  return (
    <>
      <PageHeading
        eyebrow="Gestión territorial"
        title="Centros de votación"
        description="Consulta los centros del evento seleccionado y su información de referencia. Los estados internos no equivalen a una ratificación oficial."
      >
        <div className="flex flex-wrap items-center gap-3">
        {isGlobalAdmin(scope) && <Button asChild><Link href="/centros/nuevo">Agregar centro</Link></Button>}
        <Badge>
          <School size={13} className="mr-1.5" />
          Catálogo inicial
        </Badge>
        </div>
      </PageHeading>
      {params.created === "1" && <p role="status" className="rounded-lg bg-emerald-50 p-3 text-sm text-emerald-900">Centro registrado. Está pendiente de verificar.</p>}
      <Card>
        <form
          className="grid items-end gap-4 border-b p-5 sm:grid-cols-2 xl:grid-cols-[1.5fr_1fr_1fr_auto]"
          action="/centros"
        >
          <div>
            <label htmlFor="q" className="mb-2 block text-xs font-semibold">
              Buscar centro
            </label>
            <div className="relative">
              <Search
                size={16}
                className="absolute top-3 left-3 text-muted-foreground"
              />
              <Input
                id="q"
                name="q"
                maxLength={100}
                defaultValue={data.filters.q}
                placeholder="Nombre o código TSE"
                className="pl-9"
              />
            </div>
          </div>
          <div>
            <label
              htmlFor="district"
              className="mb-2 block text-xs font-semibold"
            >
              Distrito
            </label>
            <select
              id="district"
              name="district"
              defaultValue={data.filters.district}
              className="h-10 w-full rounded-lg border bg-card px-3 text-sm"
            >
              <option value="">Todos los distritos</option>
              {org.districts.map((d) => (
                <option value={d.id} key={d.id}>
                  {d.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label
              htmlFor="status"
              className="mb-2 block text-xs font-semibold"
            >
              Estado interno
            </label>
            <select
              id="status"
              name="status"
              defaultValue={data.filters.status}
              className="h-10 w-full rounded-lg border bg-card px-3 text-sm"
            >
              <option value="">Todos los estados</option>
              {Object.entries(statusLabels).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </div>
          <div className="flex gap-2">
            <Button type="submit">Filtrar</Button>
            <Button variant="ghost" asChild>
              <Link href="/centros">Limpiar</Link>
            </Button>
          </div>
        </form>
        <div className="flex justify-between gap-2 border-b px-5 py-4">
          <h2 className="text-sm font-semibold">Catálogo de centros</h2>
          <span className="text-xs text-muted-foreground">
            {data.total} resultados
          </span>
        </div>
        {data.invalid && (
          <p
            role="alert"
            className="m-5 rounded-lg bg-amber-50 p-3 text-sm text-amber-900"
          >
            Los filtros no son válidos. Limpia la búsqueda e inténtalo
            nuevamente.
          </p>
        )}
        {data.rows.length ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <caption className="sr-only">
                Centros de votación por distrito
              </caption>
              <thead className="bg-muted/60 text-xs text-muted-foreground">
                <tr>
                  {[
                    "Centro / código",
                    "Distrito",
                    "JRV declaradas",
                    "Estado interno",
                  ].map((x) => (
                    <th
                      scope="col"
                      className="whitespace-nowrap px-5 py-3 font-medium"
                      key={x}
                    >
                      {x}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.rows.map((center) => (
                  <tr key={center.id} className="border-t">
                    <td className="min-w-60 px-5 py-4">
                      <Link href={`/centros/${center.id}`} className="block font-medium text-primary underline-offset-4 hover:underline">{center.name}</Link>
                      <span className="mt-1 block text-xs text-muted-foreground">{center.address}</span>
                      <span className="mt-1 block text-xs text-muted-foreground">
                        {center.code
                          ? `Código: ${center.code}`
                          : "Sin código oficial"}
                      </span>
                    </td>
                    <td className="px-5 py-4">{center.district}</td>
                    <td className="px-5 py-4">
                      {center.boards ?? "Sin confirmar"}
                    </td>
                    <td className="px-5 py-4">
                      <Badge>{statusLabels[center.status]}</Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState
            title={
              data.filters.q || data.filters.district || data.filters.status
                ? "No encontramos coincidencias"
                : "Todavía no hay centros registrados"
            }
            description="Los centros aparecerán aquí cuando se cargue el catálogo. Puedes buscar por nombre o código y filtrar por distrito o estado."
          />
        )}
        <div className="flex flex-wrap items-center justify-between gap-3 border-t px-5 py-4">
          <p className="text-xs text-muted-foreground">
            Página {data.page} de {data.totalPages}
          </p>
          <div className="flex gap-2">
            {data.page > 1 ? (
              <Button variant="outline" size="sm" asChild>
                <Link href={url(data.page - 1)}>
                  <ChevronLeft size={15} />
                  Anterior
                </Link>
              </Button>
            ) : (
              <Button variant="outline" size="sm" disabled>
                <ChevronLeft size={15} />
                Anterior
              </Button>
            )}
            {data.page < data.totalPages ? (
              <Button variant="outline" size="sm" asChild>
                <Link href={url(data.page + 1)}>
                  Siguiente
                  <ChevronRight size={15} />
                </Link>
              </Button>
            ) : (
              <Button variant="outline" size="sm" disabled>
                Siguiente
                <ChevronRight size={15} />
              </Button>
            )}
          </div>
        </div>
      </Card>
      <p className="text-xs text-muted-foreground">
        Selecciona una escuela para abrir sus áreas, encargados y documentos.
      </p>
    </>
  );
}

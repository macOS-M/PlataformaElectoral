import { Network, MapPin, Layers, UserRound } from "lucide-react";
import { getOrganization } from "@/modules/organization/service";
import { PageHeading } from "@/components/page-heading";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/empty-state";
import { ResponsibleForm } from "@/modules/organization/forms";
import { getAccessContext } from "@/server/authorization/context";
import { canEditPosition } from "@/server/authorization/policy";
export const metadata = { title: "Organigrama" };
export default async function Organigram() {
  const org = await getOrganization();
  const scope = await getAccessContext();
  const general = org.positions.find((x) => x.kind === "general");
  function responsible(post: { id: string }) {
    const position = org.positions.find((p) => p.id === post.id);
    const areaCode =
      org.areas.find((a) => a.id === position?.functionalAreaId)?.code ?? null;
    const canAssign = canEditPosition(
      scope,
      position?.kind === "area" || position?.kind === "area_link"
        ? areaCode
        : null,
    );
    const current = org.assignments.find(
      (a) => a.positionId === post.id && !a.endedAt,
    );
    const person = org.people.find((p) => p.id === current?.personId);
    const history = org.assignments.filter(
      (a) => a.positionId === post.id && a.endedAt,
    );
    return (
      <div className="mt-2 space-y-2">
        <p className="text-sm font-semibold">{person?.fullName ?? "Vacante"}</p>
        {person?.phone && (
          <p className="break-all text-xs text-muted-foreground">
            {person.phone}
          </p>
        )}
        {person?.email && (
          <p className="break-all text-xs text-muted-foreground">
            {person.email}
          </p>
        )}
        {canAssign && (
          <ResponsibleForm
            key={current?.id ?? "vacant"}
            positionId={post.id}
            current={current}
            people={org.people.filter((person) => person.assignable)}
          />
        )}
        {!!history.length && (
          <details className="text-left text-xs">
            <summary className="cursor-pointer text-muted-foreground">
              Historial ({history.length})
            </summary>
            <ul className="mt-2 space-y-2">
              {history.map((a) => (
                <li key={a.id}>
                  {a.fullName} ·{" "}
                  {a.startedAt.toLocaleDateString("es-CR", {
                    timeZone: "America/Costa_Rica",
                  })}{" "}
                  —{" "}
                  {a.endedAt?.toLocaleDateString("es-CR", {
                    timeZone: "America/Costa_Rica",
                  })}
                  <p className="text-muted-foreground">{a.endedReason}</p>
                </li>
              ))}
            </ul>
          </details>
        )}
      </div>
    );
  }
  return (
    <>
      <PageHeading
        eyebrow="Estructura organizacional"
        title="Organigrama cantonal"
        description="La coordinación general conecta a los distritos y las áreas funcionales. Asigna personas ya registradas a los puestos cantonales, distritales y de las nueve áreas."
      >
        <Badge>
          <Network size={13} className="mr-1.5" />
          Responsables y vacantes
        </Badge>
      </PageHeading>
      <p className="text-sm text-muted-foreground">
        Solo los usuarios con una cuenta y acceso activo a la plataforma pueden
        recibir nuevas asignaciones.
      </p>
      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <CardTitle>Líneas de coordinación</CardTitle>
            <span className="text-xs text-muted-foreground">
              {org.positions.length} puestos definidos
            </span>
          </div>
        </CardHeader>
        <CardContent>
          {!org.positions.length ? (
            <EmptyState
              title="La estructura está por comenzar"
              description="Cuando se configure el cantón y se carguen sus puestos, aquí aparecerán la coordinación general, los distritos y las áreas funcionales."
            />
          ) : (
            <div className="py-6">
              <div className="mx-auto max-w-sm rounded-xl border border-primary/30 bg-primary/5 p-5 text-center">
                <UserRound className="mx-auto mb-3 text-primary" size={25} />
                <h2 className="font-semibold">
                  {general?.name ?? "Coordinación general pendiente"}
                </h2>
                {general ? (
                  responsible(general)
                ) : (
                  <p>No hay puesto general registrado</p>
                )}
              </div>
              <div className="mx-auto h-8 w-px bg-border" />
              <div className="grid gap-6 lg:grid-cols-2">
                {[
                  {
                    title: "Coordinaciones distritales",
                    icon: MapPin,
                    posts: org.positions.filter(
                      (x) =>
                        x.kind === "district" ||
                        x.kind === "district_substitute",
                    ),
                  },
                  {
                    title: "Coordinaciones funcionales",
                    icon: Layers,
                    posts: org.positions.filter(
                      (x) =>
                        ![
                          "general",
                          "district",
                          "district_substitute",
                        ].includes(x.kind),
                    ),
                  },
                ].map(({ title, icon: Icon, posts }) => (
                  <section
                    key={title}
                    className="rounded-xl border bg-background p-4"
                  >
                    <h2 className="mb-4 flex items-center gap-2 text-sm font-semibold">
                      <Icon size={17} className="text-primary" />
                      {title}
                    </h2>
                    <ul className="space-y-3">
                      {posts.map((post) => (
                        <li
                          key={post.id}
                          className="rounded-lg border bg-card p-4"
                        >
                          <p className="text-sm font-medium">{post.name}</p>
                          {responsible(post)}
                        </li>
                      ))}
                    </ul>
                    {!posts.length && (
                      <p className="text-sm text-muted-foreground">
                        Aún no hay puestos en esta rama.
                      </p>
                    )}
                  </section>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
      <p className="text-xs text-muted-foreground">
        La edición requiere administración global o permiso asignado a este
        módulo. Estos cargos son responsabilidades internas de coordinación.
      </p>
    </>
  );
}

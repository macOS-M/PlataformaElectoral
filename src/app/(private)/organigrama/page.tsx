import { Network, MapPin, Layers, UserRound } from "lucide-react";
import { getOrganization } from "@/modules/organization/service";
import { PageHeading } from "@/components/page-heading";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/empty-state";
export const metadata = { title: "Organigrama" };
export default async function Organigram() {
  const org = await getOrganization();
  const general = org.positions.find((x) => x.kind === "general");
  return (
    <>
      <PageHeading
        eyebrow="Estructura organizacional"
        title="Organigrama cantonal"
        description="La coordinación general conecta a los distritos y las áreas funcionales. Consulta los puestos definidos para este cantón."
      >
        <Badge>
          <Network size={13} className="mr-1.5" />
          Estructura inicial
        </Badge>
      </PageHeading>
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
                <p className="mt-2 text-xs text-muted-foreground">
                  {general
                    ? "Puesto definido · asignación pendiente"
                    : "No hay puesto general registrado"}
                </p>
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
                          <p className="mt-2 text-xs text-muted-foreground">
                            Asignación pendiente
                          </p>
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
      <p className="text-xs leading-relaxed text-muted-foreground">
        Esta vista presenta el catálogo de puestos. El registro de personas, las
        suplencias y la gestión de asignaciones se habilitarán en el siguiente
        sprint.
      </p>
    </>
  );
}

import Link from "next/link";
import {
  ArrowRight,
  Network,
  School,
  MapPin,
  Layers,
  Check,
  Circle,
} from "lucide-react";
import { PageHeading } from "@/components/page-heading";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { getOrganization } from "@/modules/organization/service";
import { getCenters } from "@/modules/voting-centers/service";
import { getAccessContext } from "@/server/authorization/context";
export const metadata = { title: "Resumen general" };
export default async function Dashboard() {
  const [scope, org, centers] = await Promise.all([
    getAccessContext(),
    getOrganization(),
    getCenters({}),
  ]);
  const stats = [
    {
      label: "Distritos",
      value: org.districts.length,
      note: "En el ámbito cantonal",
      icon: MapPin,
    },
    {
      label: "Puestos definidos",
      value: org.positions.length,
      note: "Estructura organizacional",
      icon: Network,
    },
    {
      label: "Áreas funcionales",
      value: org.areas.length,
      note: "Catálogo de coordinación",
      icon: Layers,
    },
    {
      label: "Centros de votación",
      value: centers.total,
      note: "En el evento seleccionado",
      icon: School,
    },
  ];
  return (
    <>
      <PageHeading
        eyebrow="Tu centro de coordinación"
        title="Resumen general"
        description="Una visión compartida de la organización y su territorio. Empieza por conocer la estructura y los centros del cantón."
      />
      <section className="hero-grid relative overflow-hidden rounded-xl bg-[#1a493b] p-7 text-white sm:p-8">
        <p className="text-xs font-medium tracking-widest text-emerald-200">
          ORGANIZACIÓN QUE CONECTA
        </p>
        <h2 className="mt-3 max-w-lg text-2xl font-medium leading-tight">
          Cada responsabilidad,
          <br />
          en el lugar correcto.
        </h2>
        <p className="mt-3 max-w-lg text-sm leading-relaxed text-emerald-100/70">
          Consulta la estructura cantonal y los centros de votación desde un
          mismo espacio de trabajo.
        </p>
        <Button
          asChild
          className="mt-5 bg-white text-[#174b3b] hover:bg-emerald-50"
        >
          <Link href="/organigrama">
            Ver organigrama <ArrowRight size={16} />
          </Link>
        </Button>
        <Network
          className="absolute right-12 top-10 hidden size-36 text-emerald-100/15 xl:block"
          strokeWidth={0.8}
          aria-hidden="true"
        />
      </section>
      <section
        aria-label="Indicadores del catálogo"
        className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4"
      >
        {stats.map(({ label, value, note, icon: Icon }) => (
          <Card key={label}>
            <CardContent className="pt-5">
              <div className="flex items-center justify-between">
                <p className="text-sm text-muted-foreground">{label}</p>
                <Icon className="text-primary" size={19} />
              </div>
              <p className="mt-5 text-3xl font-semibold">
                {scope ? value : "—"}
              </p>
              <p className="mt-2 text-xs text-muted-foreground">
                {scope ? note : "Sin datos conectados"}
              </p>
            </CardContent>
          </Card>
        ))}
      </section>
      <div className="grid gap-5 xl:grid-cols-[1.5fr_1fr]">
        <Card>
          <CardHeader>
            <CardTitle>Explora tu espacio de trabajo</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {[
              {
                href: "/organigrama",
                title: "Organigrama cantonal",
                text: "Coordinación general, distritos y áreas funcionales.",
                icon: Network,
              },
              {
                href: "/centros",
                title: "Centros de votación",
                text: "Consulta el catálogo y encuentra centros por distrito.",
                icon: School,
              },
            ].map(({ href, title, text, icon: Icon }) => (
              <Link
                key={href}
                href={href}
                className="flex items-center gap-4 rounded-lg border p-4 transition-colors hover:bg-muted"
              >
                <span className="rounded-lg bg-muted p-3 text-primary">
                  <Icon size={21} />
                </span>
                <span className="flex-1">
                  <span className="block text-sm font-semibold">{title}</span>
                  <span className="mt-1 block text-xs leading-relaxed text-muted-foreground">
                    {text}
                  </span>
                </span>
                <ArrowRight size={17} className="text-muted-foreground" />
              </Link>
            ))}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Estado del espacio</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-5 text-sm">
              {[
                { text: "Pantallas de organización y centros", done: true },
                { text: "Acceso y conexión de datos", done: !!scope },
                {
                  text: "Catálogo territorial cargado",
                  done: org.districts.length > 0,
                },
              ].map((x) => (
                <li key={x.text} className="flex items-center gap-3">
                  {x.done ? (
                    <Check size={18} className="text-primary" />
                  ) : (
                    <Circle size={16} className="text-muted-foreground" />
                  )}
                  {x.text}
                </li>
              ))}
            </ul>
            <p className="mt-6 border-t pt-4 text-xs leading-relaxed text-muted-foreground">
              Ya puedes asignar personas registradas como responsables desde el
              organigrama. La edición de centros continúa pendiente.
            </p>
          </CardContent>
        </Card>
      </div>
    </>
  );
}

"use client";
import { Button } from "@/components/ui/button";
export default function ErrorPage({ reset }: { reset: () => void }) {
  return (
    <div role="alert" className="rounded-xl border bg-card p-8">
      <h1 className="text-xl font-semibold">
        No pudimos cargar la información
      </h1>
      <p className="my-4 text-sm text-muted-foreground">
        La conexión no está disponible o el acceso requiere revisión. Inténtalo
        de nuevo; si continúa, contacta a la administración.
      </p>
      <Button onClick={reset}>Volver a intentar</Button>
    </div>
  );
}

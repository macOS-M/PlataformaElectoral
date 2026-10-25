import Link from "next/link";
export default function NotFound() {
  return (
    <main className="mx-auto max-w-lg p-10">
      <h1 className="text-2xl font-semibold">No encontramos esta página</h1>
      <p className="my-4 text-muted-foreground">
        La dirección no existe o todavía no está disponible.
      </p>
      <Link href="/resumen" className="text-primary underline">
        Volver al resumen
      </Link>
    </main>
  );
}

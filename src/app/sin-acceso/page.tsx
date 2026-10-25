import { signOut } from "@/modules/auth/actions";
import { Button } from "@/components/ui/button";
export default function NoAccess() {
  return (
    <main className="mx-auto max-w-xl p-10">
      <h1 className="text-2xl font-semibold">
        Tu cuenta no tiene acceso a este espacio
      </h1>
      <p className="my-5 text-muted-foreground">
        Solicita a la administración que revise tu membresía y el ámbito de
        trabajo configurado.
      </p>
      <form action={signOut}>
        <Button>Cerrar sesión</Button>
      </form>
    </main>
  );
}

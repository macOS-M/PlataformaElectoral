"use client";
import { useActionState, useId } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { requestRecoveryAction, replacePasswordAction, type RecoveryState } from "./recovery-actions";
const initial = { error: "", success: "" };
function Messages({ state }: { state: RecoveryState }) {
  return <>{state.error && <p role="alert" className="text-sm text-red-800">{state.error}</p>}{state.success && <p role="status" className="text-sm text-primary">{state.success}</p>}</>;
}
export function RequestRecoveryForm({ configured }: { configured: boolean }) {
  const [state, action, pending] = useActionState(requestRecoveryAction, initial);
  const id = useId();
  return <form action={action} className="space-y-5">
    <div><label htmlFor={id} className="mb-2 block text-sm">Correo de acceso</label><Input id={id} name="email" type="email" autoComplete="email" maxLength={254} required disabled={!configured} className="h-11" /></div>
    <Messages state={state} /><Button className="min-h-11 w-full" disabled={!configured || pending}>{pending ? "Solicitando…" : "Enviar enlace de recuperación"}</Button>
  </form>;
}
export function ReplacePasswordForm() {
  const [state, action, pending] = useActionState(replacePasswordAction, initial);
  const id = useId();
  return <form action={action} className="space-y-5">
    <div><label htmlFor={`${id}-password`} className="mb-2 block text-sm">Nueva contraseña</label><Input id={`${id}-password`} name="password" type="password" autoComplete="new-password" required minLength={12} maxLength={256} className="h-11" /></div>
    <div><label htmlFor={`${id}-confirmation`} className="mb-2 block text-sm">Repetir contraseña</label><Input id={`${id}-confirmation`} name="confirmation" type="password" autoComplete="new-password" required minLength={12} maxLength={256} className="h-11" /></div>
    <Messages state={state} /><Button className="min-h-11 w-full" disabled={pending || !!state.success}>{pending ? "Guardando…" : "Guardar nueva contraseña"}</Button>
  </form>;
}

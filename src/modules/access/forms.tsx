"use client";
import { useActionState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { modules } from "@/server/authorization/policy";
import {
  authorizeAction,
  accessAction,
  registerAction,
  renewCodeAction,
  refreshNameAction,
  type AccessState,
} from "./actions";
import type { AccessRow } from "./repository";
const initial: AccessState = { error: "", success: "" };
function Status({ state }: { state: AccessState }) {
  return (
    <div aria-live="polite" className="space-y-2">
      {state.error && (
        <p role="alert" className="text-sm text-red-700">
          {state.error}
        </p>
      )}
      {state.success && (
        <p className="text-sm text-violet-700">{state.success}</p>
      )}
      {state.code && (
        <p
          className="break-all rounded-lg border bg-muted p-3 font-mono text-base select-all"
          aria-label="Código de activación"
        >
          {state.code}
        </p>
      )}
    </div>
  );
}
function Permissions({
  role = "member",
  selected = [],
}: {
  role?: string;
  selected?: string[];
}) {
  return (
    <div className="space-y-3">
      <label className="block text-sm">
        Tipo de usuario
        <select
          name="role"
          defaultValue={role}
          className="mt-1 w-full rounded-lg border bg-background p-2"
        >
          <option value="member">Usuario · lectura y áreas asignadas</option>
          <option value="admin">Administrador global</option>
        </select>
      </label>
      <fieldset className="space-y-2 rounded-lg border p-3">
        <legend className="px-1 text-sm font-medium">
          Permisos de edición
        </legend>
        {modules
          .filter((m) => m.id !== "organigrama" && m.id !== "centros")
          .map((m) => (
            <label key={m.id} className="flex items-start gap-2 text-sm">
              <input
                type="checkbox"
                name="modules"
                value={m.id}
                defaultChecked={selected.includes(m.id)}
                className="mt-1"
              />
              {m.label}
            </label>
          ))}
        <p className="text-xs text-muted-foreground">
          Sin asignaciones: solo lectura. Una o más áreas: coordinador de esas
          áreas. Coordinación distrital: edición de todos los módulos del
          ámbito. El administrador global gestiona también usuarios y
          autorizaciones.
        </p>
      </fieldset>
    </div>
  );
}
export function AuthorizeForm({ configured }: { configured: boolean }) {
  const [state, action, pending] = useActionState(authorizeAction, initial);
  return (
    <form action={action} className="space-y-4">
      <label className="block text-sm">
        Cédula a autorizar
        <Input
          name="cedula"
          required
          inputMode="numeric"
          maxLength={15}
          placeholder="9 dígitos"
          autoComplete="off"
        />
      </label>
      <Permissions />
      <p className="text-xs text-muted-foreground">
        Se generará un código de activación de un solo uso. La cédula se
        conserva como identificador privado; aquí solo se muestran sus últimos
        cuatro dígitos.
      </p>
      <Status state={state} />
      <Button disabled={pending || !configured}>
        {pending ? "Autorizando…" : "Autorizar cédula"}
      </Button>
      {!configured && (
        <p role="status" className="text-sm text-amber-800">
          Falta configurar el servicio de registro en el servidor.
        </p>
      )}
    </form>
  );
}
export function EditAccessForm({ entry }: { entry: AccessRow }) {
  const [state, action, pending] = useActionState(accessAction, initial);
  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="id" value={entry.id} />
      <Permissions role={entry.role} selected={entry.modules} />
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" name="active" defaultChecked={entry.active} />
        Acceso habilitado
      </label>
      <Status state={state} />
      <Button disabled={pending}>
        {pending ? "Guardando…" : "Guardar permisos"}
      </Button>
    </form>
  );
}
export function RegistrationForm({
  configured,
  automaticName = false,
}: {
  configured: boolean;
  automaticName?: boolean;
}) {
  const [state, action, pending] = useActionState(registerAction, initial);
  return (
    <form action={action} className="space-y-4">
      {automaticName ? (
        <p className="text-sm text-muted-foreground">
          Tu nombre se consultará con tu cédula al validar el código de
          activación.
        </p>
      ) : (
        <label className="block text-sm">
          Nombre completo
          <Input
            name="fullName"
            required
            minLength={2}
            maxLength={160}
            autoComplete="name"
            disabled={!configured}
          />
        </label>
      )}
      <label className="block text-sm">
        Cédula
        <Input
          name="cedula"
          required
          inputMode="numeric"
          maxLength={15}
          autoComplete="username"
          disabled={!configured}
        />
      </label>
      <label className="block text-sm">
        Código de activación
        <Input
          name="code"
          required
          maxLength={100}
          autoComplete="off"
          disabled={!configured}
        />
      </label>
      <label className="block text-sm">
        Contraseña
        <Input
          name="password"
          type="password"
          required
          minLength={12}
          maxLength={128}
          autoComplete="new-password"
          disabled={!configured}
        />
      </label>
      <label className="block text-sm">
        Confirmar contraseña
        <Input
          name="confirmPassword"
          type="password"
          required
          minLength={12}
          maxLength={128}
          autoComplete="new-password"
          disabled={!configured}
        />
      </label>
      <p className="text-xs text-muted-foreground">
        Usa al menos 12 caracteres. La cédula y el código deben haber sido
        autorizados por la administración.
      </p>
      <Status state={state} />
      <Button disabled={!configured || pending} className="w-full">
        {pending ? "Creando cuenta…" : "Crear mi cuenta"}
      </Button>
      {!configured && (
        <p role="status" className="text-sm text-amber-800">
          El registro aún no está habilitado. Contacta a la administración.
        </p>
      )}
    </form>
  );
}

export function RenewCodeForm({ id }: { id: string }) {
  const [state, action, pending] = useActionState(renewCodeAction, initial);
  return (
    <form action={action} className="mt-5 space-y-3 border-t pt-4">
      <input type="hidden" name="id" value={id} />
      <Status state={state} />
      <Button variant="outline" disabled={pending}>
        {pending ? "Generando…" : "Generar nuevo código de activación"}
      </Button>
    </form>
  );
}

export function RefreshNameForm({
  id,
  configured,
}: {
  id: string;
  configured: boolean;
}) {
  const [state, action, pending] = useActionState(refreshNameAction, initial);
  return (
    <form action={action} className="mt-5 space-y-3 border-t pt-4">
      <input type="hidden" name="id" value={id} />
      <label className="block text-sm">
        Cédula para consultar nombre
        <Input
          name="cedula"
          required
          inputMode="numeric"
          maxLength={15}
          autoComplete="off"
          disabled={!configured}
        />
      </label>
      <p className="text-xs text-muted-foreground">
        Se enviará esta cédula a Soporte Real y se actualizará únicamente el
        nombre de esta cuenta. No cambia sus permisos.
      </p>
      <Status state={state} />
      <Button variant="outline" disabled={!configured || pending}>
        {pending ? "Consultando…" : "Actualizar nombre desde Soporte Real"}
      </Button>
      {!configured && (
        <p className="text-sm text-amber-800">
          Falta configurar el token de Soporte Real en el servidor.
        </p>
      )}
    </form>
  );
}

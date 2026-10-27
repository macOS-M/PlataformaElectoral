"use client";
import { useActionState, useState } from "react";
import { assignAction, type FormState } from "./actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
const initial: FormState = { error: "", success: "" };
const control = "w-full rounded-lg border bg-background px-3 py-2 text-sm";
export type PersonOption = {
  id: string;
  fullName: string;
  email: string | null;
  phone: string | null;
};
function Status({ state }: { state: FormState }) {
  return (
    <div aria-live="polite">
      {state.error && (
        <p role="alert" className="text-sm text-red-700">
          {state.error}
        </p>
      )}
      {state.success && (
        <p className="text-sm text-emerald-700">{state.success}</p>
      )}
    </div>
  );
}
export function ResponsibleForm({
  positionId,
  current,
  people,
}: {
  positionId: string;
  current?: { id: string; personId: string };
  people: PersonOption[];
}) {
  const [state, action, pending] = useActionState(assignAction, initial);
  const [personId, setPersonId] = useState(current?.personId ?? "");
  return (
    <details className="mt-3 text-left">
      <summary className="cursor-pointer text-sm font-semibold text-primary">
        {current ? "Cambiar o finalizar responsable" : "Asignar responsable"}
      </summary>
      <form action={action} className="mt-3 space-y-3">
        <input type="hidden" name="positionId" value={positionId} />
        <input type="hidden" name="expectedId" value={current?.id ?? ""} />
        <label className="block text-sm">
          Persona
          <select
            className={control}
            name="personId"
            value={personId}
            onChange={(e) => setPersonId(e.target.value)}
          >
            <option value="">
              {current ? "Dejar puesto vacante" : "Selecciona una persona"}
            </option>
            {current && !people.some((p) => p.id === current.personId) && (
              <option value={current.personId} disabled>
                Responsable anterior · sin acceso activo
              </option>
            )}
            {people.map((p) => (
              <option key={p.id} value={p.id}>
                {p.fullName}
                {p.email
                  ? ` · ${p.email}`
                  : p.phone
                    ? ` · ${p.phone}`
                    : ` · ${p.id.slice(0, 8)}`}
              </option>
            ))}
          </select>
        </label>
        {!people.length && (
          <p className="text-xs text-muted-foreground">
            No hay usuarios con acceso activo disponibles para asignar.
          </p>
        )}
        {current ? (
          <label className="block text-sm">
            Motivo del cambio *
            <Input name="reason" required minLength={3} maxLength={500} />
          </label>
        ) : (
          <input type="hidden" name="reason" value="" />
        )}
        <p className="text-xs text-muted-foreground">
          {current
            ? "El responsable anterior quedará en el historial."
            : "La asignación comienza al guardar. Puedes elegir la misma persona en varios puestos."}
        </p>
        <Status state={state} />
        <Button
          size="sm"
          disabled={pending || personId === (current?.personId ?? "")}
        >
          {pending
            ? "Guardando…"
            : current && !personId
              ? "Finalizar asignación"
              : "Guardar responsable"}
        </Button>
      </form>
    </details>
  );
}

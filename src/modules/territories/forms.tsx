"use client";
import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { saveTerritoryAction } from "./actions";

const fieldClass = "min-h-11 w-full rounded-lg border bg-card px-3 text-sm";
export function TerritoryForm({ provinces, canton }: {
  provinces: { id: string; name: string }[];
  canton?: { name: string; province?: { id: string; name: string } | null };
}) {
  const [state, action, pending] = useActionState(saveTerritoryAction, { error: "", success: "" });
  return <form action={action} className="space-y-4">
    <input type="hidden" name="operation" value={canton ? "link" : "province"} />
    {canton ? <>
      <input type="hidden" name="expectedProvinceId" value={canton.province?.id ?? ""} />
      <label className="block space-y-2"><span>Provincia de {canton.name}</span>
        <select name="provinceId" required className={fieldClass} defaultValue={canton.province?.id ?? ""}>
          <option value="">Seleccioná una provincia existente</option>
          {provinces.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
      </label>
    </> : <>
      <label className="block space-y-2"><span>Nombre de la provincia</span><input name="name" required minLength={2} maxLength={100} className={fieldClass} /></label>
      <label className="block space-y-2"><span>Código oficial verificado (opcional)</span><input name="officialCode" pattern="[0-9]{1,10}" maxLength={10} className={fieldClass} /></label>
      <p className="text-sm text-muted-foreground">Dejá el código vacío si no lo verificaste. Reutilizá las provincias existentes.</p>
    </>}
    <label className="block space-y-2"><span>Enlace a la fuente territorial consultada</span><input name="sourceUrl" type="url" pattern="https?://.*" required maxLength={1000} className={fieldClass} /></label>
    <label className="flex items-start gap-2 text-sm"><input type="checkbox" name="confirmed" required className="mt-1" /><span>Revisé la fuente y confirmo los datos territoriales indicados. El sistema no verifica automáticamente esta fuente.</span></label>
    {state.error && <p role="alert" className="text-sm text-destructive">{state.error}</p>}
    {state.success && <p role="status" className="text-sm">{state.success}</p>}
    <Button disabled={pending || (!!canton && !provinces.length)}>{pending ? "Guardando…" : canton ? "Guardar relación provincial" : "Registrar provincia"}</Button>
  </form>;
}

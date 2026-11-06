"use client";
import { useActionState, useState } from "react";
import { saveResponsibleAction, uploadDocumentAction } from "./area-actions";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

type Person = { id: string; fullName: string; email: string | null; phone: string | null; notes: string | null; version: string };
const empty = { error: "", success: "" };
function Message({ state }: { state: typeof empty }) {
  return <>{state.error && <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-800">{state.error}</p>}{state.success && <p role="status" className="rounded-lg bg-violet-50 p-3 text-sm text-violet-900">{state.success}</p>}</>;
}
export function ResponsibleForm({ centerId, areaCode, expectedId, currentPersonId, directory }: { centerId: string; areaCode: string; expectedId: string; currentPersonId: string; directory: Person[] }) {
  const [state, action, pending] = useActionState(saveResponsibleAction, empty);
  const [personId, setPersonId] = useState(currentPersonId);
  const person = directory.find(p => p.id === personId);
  const initial = directory.find(p => p.id === currentPersonId);
  const [fields, setFields] = useState({ fullName: initial?.fullName ?? "", phone: initial?.phone ?? "", email: initial?.email ?? "", notes: initial?.notes ?? "", reason: "" });
  const replacing = !!expectedId && personId !== currentPersonId;
  return <form action={action} className="space-y-4">
    <input type="hidden" name="centerId" value={centerId} /><input type="hidden" name="areaCode" value={areaCode} />
    <input type="hidden" name="expectedId" value={expectedId} /><input type="hidden" name="previousPersonId" value={currentPersonId} />
    <input type="hidden" name="version" value={person?.version ?? ""} />
    <div><label htmlFor="personId" className="mb-2 block text-sm font-medium">Encargado</label>
      <select id="personId" name="personId" value={personId} onChange={e => {
        setPersonId(e.target.value);
        const selected = directory.find(p => p.id === e.target.value);
        setFields({ fullName: selected?.fullName ?? "", phone: selected?.phone ?? "", email: selected?.email ?? "", notes: selected?.notes ?? "", reason: "" });
      }} className="h-10 w-full rounded-lg border bg-card px-3 text-sm">
        <option value="">Registrar una persona por nombre</option>
        {directory.map(p => <option key={p.id} value={p.id}>{p.fullName}{p.phone ? ` · ${p.phone}` : ""}</option>)}
      </select><p className="mt-2 text-xs text-muted-foreground">Si la persona ya existe, selecciónala para compartir su ficha entre áreas y centros. Registrar un encargado no le concede acceso a la página.</p></div>
    <div key={personId} className="space-y-4">
      <div><label htmlFor="fullName" className="mb-2 block text-sm font-medium">Nombre completo</label><Input id="fullName" name="fullName" required minLength={2} maxLength={160} value={fields.fullName} onChange={e => setFields({ ...fields, fullName: e.target.value })} autoComplete="name" /></div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div><label htmlFor="phone" className="mb-2 block text-sm font-medium">Teléfono</label><Input id="phone" name="phone" type="tel" maxLength={40} value={fields.phone} onChange={e => setFields({ ...fields, phone: e.target.value })} autoComplete="tel" /></div>
        <div><label htmlFor="email" className="mb-2 block text-sm font-medium">Correo electrónico</label><Input id="email" name="email" type="email" maxLength={254} value={fields.email} onChange={e => setFields({ ...fields, email: e.target.value })} autoComplete="email" /></div>
      </div>
      <div><label htmlFor="notes" className="mb-2 block text-sm font-medium">Datos adicionales / observaciones</label><textarea id="notes" name="notes" maxLength={2000} rows={3} value={fields.notes} onChange={e => setFields({ ...fields, notes: e.target.value })} className="w-full rounded-lg border bg-card px-3 py-2 text-sm" /></div>
    </div>
    {personId && <p className="text-xs text-muted-foreground">Los cambios de contacto se guardan en la ficha compartida de esta persona.</p>}
    {replacing ? <div><label htmlFor="reason" className="mb-2 block text-sm font-medium">Motivo del cambio</label><Input id="reason" name="reason" required minLength={3} maxLength={500} value={fields.reason} onChange={e => setFields({ ...fields, reason: e.target.value })} /></div> : <input type="hidden" name="reason" value="" />}
    <Message state={state} /><Button disabled={pending} type="submit">{pending ? "Guardando…" : "Guardar encargado"}</Button>
  </form>;
}
export function DocumentForm({ centerId, areaCode }: { centerId: string; areaCode: string }) {
  const [state, action, pending] = useActionState(uploadDocumentAction, empty);
  return <form action={action} className="space-y-4">
    <input type="hidden" name="centerId" value={centerId} /><input type="hidden" name="areaCode" value={areaCode} />
    <div><label htmlFor="category" className="mb-2 block text-sm font-medium">Tipo de documento</label><select id="category" name="category" className="h-10 w-full rounded-lg border bg-card px-3 text-sm"><option value="contrato">Contrato</option><option value="cedula">Cédula</option><option value="otro">Otro documento</option></select></div>
    <div><label htmlFor="file" className="mb-2 block text-sm font-medium">Archivo</label><Input id="file" name="file" type="file" required accept="application/pdf,image/jpeg,image/png" className="h-auto py-2" /><p className="mt-2 text-xs text-muted-foreground">PDF, JPG o PNG. Máximo 5 MB por archivo. Disponible para usuarios autorizados de la plataforma.</p></div>
    <Message state={state} /><Button disabled={pending} type="submit">{pending ? "Subiendo…" : "Adjuntar archivo"}</Button>
  </form>;
}

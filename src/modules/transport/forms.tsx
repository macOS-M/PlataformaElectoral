"use client";
import { useActionState, useId, useState } from "react";
import { saveVehicleAction } from "./actions";
import type { TransportPerson, VehicleRow } from "./repository";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export function VehicleForm({ vehicle, people, districts, centers }: {
  vehicle?: VehicleRow; people: TransportPerson[]; districts: { id: string; name: string }[];
  centers: { id: string; name: string; districtId: string }[];
}) {
  const prefix = useId();
  const [state, action, pending] = useActionState(saveVehicleAction, { error: "", success: "" });
  const [personId, setPersonId] = useState(vehicle?.responsibleId ?? "");
  const person = people.find(p => p.id === personId);
  const [districtIds, setDistrictIds] = useState(vehicle?.districtIds ?? []);
  const [centerIds, setCenterIds] = useState(vehicle?.centerIds ?? []);
  const [active, setActive] = useState(vehicle?.active ?? true);
  return <form action={action} className="space-y-4">
    <input type="hidden" name="id" value={vehicle?.id ?? ""} />
    <input type="hidden" name="version" value={vehicle?.version ?? 0} />
    <input type="hidden" name="personVersion" value={person?.version ?? ""} />
    <div className="grid gap-4 sm:grid-cols-2">
      <div><label htmlFor={`${prefix}-plate`} className="mb-1 block text-sm">Placa</label><Input id={`${prefix}-plate`} name="plate" required minLength={2} maxLength={20} pattern="[A-Za-z0-9-]{2,20}" defaultValue={vehicle?.plate} /></div>
      <div><label htmlFor={`${prefix}-description`} className="mb-1 block text-sm">Descripción del vehículo</label><Input id={`${prefix}-description`} name="description" required minLength={2} maxLength={160} defaultValue={vehicle?.description} /></div>
    </div>
    <div><label htmlFor={`${prefix}-person`} className="mb-1 block text-sm">Encargado</label>
      <select id={`${prefix}-person`} name="personId" className="min-h-11 w-full rounded-lg border bg-card px-3 text-sm" value={personId} onChange={e => setPersonId(e.target.value)}>
        <option value="">Registrar persona nueva</option>{people.map(p => <option key={p.id} value={p.id}>{p.fullName}{p.phone ? ` · ${p.phone}` : ""}</option>)}
      </select>
      <p className="mt-1 text-xs text-muted-foreground">Selecciona la ficha existente para reutilizarla. Los contactos se comparten con sus otros cargos; registrar una persona no crea una cuenta.</p>
    </div>
    <div key={`${personId}-${person?.version ?? ""}`} className="grid gap-4 sm:grid-cols-3">
      <div><label htmlFor={`${prefix}-name`} className="mb-1 block text-sm">Nombre completo</label><Input id={`${prefix}-name`} name="fullName" required minLength={2} maxLength={160} defaultValue={person?.fullName ?? ""} /></div>
      <div><label htmlFor={`${prefix}-phone`} className="mb-1 block text-sm">Teléfono</label><Input id={`${prefix}-phone`} name="phone" type="tel" maxLength={40} defaultValue={person?.phone ?? ""} /></div>
      <div><label htmlFor={`${prefix}-email`} className="mb-1 block text-sm">Correo</label><Input id={`${prefix}-email`} name="email" type="email" maxLength={254} defaultValue={person?.email ?? ""} /></div>
    </div>
    <label className="flex min-h-11 items-center gap-2 text-sm"><input type="checkbox" name="active" checked={active} onChange={e => setActive(e.target.checked)} />Vehículo activo</label>
    <fieldset disabled={!active} className="space-y-2 rounded-lg border p-3">
      <legend className="px-1 text-sm font-semibold">Distritos de atención · evento actual</legend>
      {districts.map(d => <label key={d.id} className="flex min-h-11 items-center gap-2 text-sm"><input type="checkbox" name="districtIds" value={d.id} checked={districtIds.includes(d.id)} onChange={e => {
        setDistrictIds(e.target.checked ? [...districtIds, d.id] : districtIds.filter(id => id !== d.id));
        if (!e.target.checked) setCenterIds(centerIds.filter(id => centers.find(c => c.id === id)?.districtId !== d.id));
      }} />{d.name}</label>)}
      {!districts.length && <p className="text-sm">No hay distritos activos.</p>}
    </fieldset>
    <fieldset disabled={!active} className="space-y-2 rounded-lg border p-3">
      <legend className="px-1 text-sm font-semibold">Centros atendidos · selección múltiple</legend>
      {centers.filter(c => districtIds.includes(c.districtId)).map(c => <label key={c.id} className="flex min-h-11 items-center gap-2 text-sm"><input type="checkbox" name="centerIds" value={c.id} checked={centerIds.includes(c.id)} onChange={e => setCenterIds(e.target.checked ? [...centerIds, c.id] : centerIds.filter(id => id !== c.id))} />{c.name}</label>)}
      {!centers.some(c => districtIds.includes(c.districtId)) && <p className="text-sm text-muted-foreground">Selecciona un distrito con centros disponibles.</p>}
    </fieldset>
    {!active && <p className="text-sm text-muted-foreground">Desactivar cierra las asignaciones vigentes del vehículo en todos los eventos; el historial se conserva.</p>}
    {vehicle ? <div><label htmlFor={`${prefix}-reason`} className="mb-1 block text-sm">Motivo del cambio (sin datos personales)</label><Input id={`${prefix}-reason`} name="reason" required minLength={3} maxLength={500} /></div> : <input type="hidden" name="reason" value="" />}
    {state.error && <p role="alert" className="text-sm text-red-800">{state.error}</p>}
    {state.success && <p role="status" className="text-sm text-primary">{state.success}</p>}
    <Button type="submit" disabled={pending}>{pending ? "Guardando…" : vehicle ? "Guardar vehículo" : "Registrar vehículo"}</Button>
  </form>;
}

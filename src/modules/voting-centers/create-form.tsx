"use client";
import Link from "next/link";
import { useActionState } from "react";
import { createCenterAction } from "./actions";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export function CreateCenterForm({ districts }: { districts: { id: string; name: string }[] }) {
  const [state, action, pending] = useActionState(createCenterAction, { error: "" });
  return <form action={action} className="space-y-5">
    <div><label htmlFor="name" className="mb-2 block text-sm font-medium">Nombre del centro</label>
      <Input id="name" name="name" required minLength={2} maxLength={160} autoComplete="off" /></div>
    <div><label htmlFor="districtId" className="mb-2 block text-sm font-medium">Distrito</label>
      <select id="districtId" name="districtId" required defaultValue={districts.length === 1 ? districts[0].id : ""} className="h-10 w-full rounded-lg border bg-card px-3 text-sm">
        <option value="" disabled>Selecciona un distrito</option>
        {districts.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
      </select></div>
    <div><label htmlFor="address" className="mb-2 block text-sm font-medium">Dirección</label>
      <textarea id="address" name="address" required minLength={2} maxLength={500} rows={3} className="w-full rounded-lg border bg-card px-3 py-2 text-sm" />
      <p className="mt-2 text-xs text-muted-foreground">Incluye la comunidad y las señas disponibles.</p></div>
    {state.error && <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-800">{state.error}</p>}
    <div className="flex flex-wrap gap-3"><Button type="submit" disabled={pending || !districts.length}>{pending ? "Guardando…" : "Guardar centro"}</Button>
      <Button variant="outline" asChild><Link href="/centros">Cancelar</Link></Button></div>
  </form>;
}

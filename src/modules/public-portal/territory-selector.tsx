"use client";

import { useState } from "react";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { PublicCanton } from "./types";

export function TerritorySelector({ territories, selectedCanton = "", selectedDistrict = "", provinces: catalog, action = "/", buttonLabel = "Ver servicios disponibles", stacked = false }: {
  territories: PublicCanton[]; selectedCanton?: string; selectedDistrict?: string;
  provinces?: { id: string; name: string }[]; action?: string; buttonLabel?: string; stacked?: boolean;
}) {
  const [provinceId, setProvinceId] = useState(() => territories.find(item => item.id === selectedCanton)?.province?.id ?? "");
  const [cantonId, setCantonId] = useState(selectedCanton);
  const [districtId, setDistrictId] = useState(selectedDistrict);
  const provinces = catalog ?? [...new Map(territories.flatMap(item => item.province ? [[item.province.id, item.province] as const] : [])).values()];
  const cantons = territories.filter(item => item.province?.id === provinceId);
  const canton = cantons.find(item => item.id === cantonId);
  return (
    <form action={action} method="get" className="space-y-4">
      {provinceId && <input type="hidden" name="province" value={provinceId} />}
      <div className={stacked ? "grid gap-5" : "grid gap-4 sm:grid-cols-3"}>
        <div className="space-y-2">
          <label htmlFor="territory-province" className="text-sm font-medium">Provincia</label>
          <select id="territory-province" value={provinceId} disabled={!provinces.length} required
            onChange={event => { setProvinceId(event.target.value); setCantonId(""); setDistrictId(""); }}
            className="min-h-11 w-full rounded-lg border bg-card px-3 text-sm disabled:opacity-60">
            <option value="">Seleccioná tu provincia</option>
            {provinces.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}
          </select>
        </div>
        <div className="space-y-2">
          <label htmlFor="public-canton" className="text-sm font-medium">Cantón</label>
          <select id="public-canton" name="canton" required value={cantonId} disabled={!cantons.length}
            onChange={event => { setCantonId(event.target.value); setDistrictId(""); }}
            className="min-h-11 w-full rounded-lg border bg-card px-3 text-sm disabled:opacity-60">
            <option value="">Seleccioná tu cantón</option>
            {cantons.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}
          </select>
        </div>
        <div className="space-y-2">
          <label htmlFor="public-district" className="text-sm font-medium">Distrito</label>
          <select id="public-district" name="district" required value={districtId} disabled={!canton?.districts.length}
            onChange={event => setDistrictId(event.target.value)}
            className="min-h-11 w-full rounded-lg border bg-card px-3 text-sm disabled:opacity-60">
            <option value="">Seleccioná tu distrito</option>
            {canton?.districts.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}
          </select>
        </div>
      </div>
      {provinceId && !cantons.length && <p role="status" className="text-sm text-muted-foreground">Esta provincia no tiene cantones disponibles en el ámbito configurado.</p>}
      {canton && !canton.districts.length && <p role="status" className="text-sm text-muted-foreground">Este cantón aún no tiene distritos activos configurados.</p>}
      <Button type="submit" disabled={!canton || !canton.districts.some(item => item.id === districtId)} className="min-h-11 w-full">{buttonLabel} <ArrowRight size={16} aria-hidden="true" /></Button>
    </form>
  );
}

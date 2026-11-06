"use client";

import { useState } from "react";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { PublicCanton } from "./types";

export function TerritorySelector({ territories, selectedCanton = "", selectedDistrict = "" }: {
  territories: PublicCanton[]; selectedCanton?: string; selectedDistrict?: string;
}) {
  const [cantonId, setCantonId] = useState(selectedCanton);
  const [districtId, setDistrictId] = useState(selectedDistrict);
  const canton = territories.find(item => item.id === cantonId);
  return (
    <form action="/" method="get" className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <label htmlFor="public-canton" className="text-sm font-medium">Cantón</label>
          <select id="public-canton" name="canton" required value={cantonId} disabled={!territories.length}
            onChange={event => { setCantonId(event.target.value); setDistrictId(""); }}
            className="min-h-11 w-full rounded-lg border bg-card px-3 text-sm disabled:opacity-60">
            <option value="">Seleccioná tu cantón</option>
            {territories.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}
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
      {canton && !canton.districts.length && <p role="status" className="text-sm text-muted-foreground">Este cantón aún no tiene distritos activos configurados.</p>}
      <Button type="submit" disabled={!cantonId || !districtId} className="min-h-11 w-full">Ver servicios disponibles <ArrowRight size={16} aria-hidden="true" /></Button>
    </form>
  );
}

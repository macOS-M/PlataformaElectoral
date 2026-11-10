import Link from "next/link";
import { getInventory } from "./service";
import { InventoryHistory } from "./history";
export async function CenterInventory({ centerId }: {centerId:string}) {
 const data=await getInventory();
 if(!data.allowed)return null;
 const location=data.locations.find(l=>l.centerId===centerId);
 if(!location)return <section className="rounded-xl border bg-card p-5"><h2 className="font-semibold">Materiales de signos externos</h2><p className="mt-2 text-sm">Este centro no tiene ubicación de inventario registrada.</p><Link href="/inventario" className="mt-2 inline-block text-sm text-primary">Abrir inventario</Link></section>;
 const filtered=await getInventory({location:location.id,kind:"transferencia"});
 if(!filtered.allowed)return null;
 const stock=data.stock.filter(s=>s.locationId===location.id);
 return <section className="space-y-3 rounded-xl border bg-card p-5"><h2 className="font-semibold">Materiales y entregas del centro</h2>{stock.length?<div className="max-h-80 overflow-auto"><table className="w-full text-left text-sm"><thead><tr><th className="p-2">Material</th><th className="p-2">Utilizable</th><th className="p-2">Dañado</th></tr></thead><tbody>{stock.map(s=>{const item=data.items.find(i=>i.id===s.itemId);return <tr key={s.itemId} className="border-t"><td className="p-2">{item?.name} {item?.variant} · {item?.unit}</td><td className="p-2">{s.usable}</td><td className="p-2">{s.damaged}</td></tr>;})}</tbody></table></div>:<p className="text-sm text-muted-foreground">No hay existencias registradas en esta ubicación.</p>}<InventoryHistory rows={filtered.history.slice(0,500)}/><Link href={`/inventario?location=${location.id}`} className="inline-block text-sm text-primary">Gestionar stock, entregas y necesidades de esta ubicación</Link></section>;
}

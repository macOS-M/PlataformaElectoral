import type { Movement } from "./repository";
import { kinds, labels } from "./schemas";
export function InventoryHistory({ rows }: { rows:Movement[] }) {
 return <ul className="space-y-3">{rows.map(m=><li key={m.id} className="break-words rounded-lg border p-3 text-sm">
 <p className="font-semibold">{labels[m.kind as typeof kinds[number]]??m.kind} · {m.item} · {m.quantity} {m.unit}</p>
 <p>{m.date} · {m.source??"Origen externo"} → {m.destination??"Sin destino de stock"}</p>
 <p>Responsable/receptor: {m.person}</p>{m.origin && <p>Origen del material: {m.origin}</p>}<p>Motivo: {m.reason}</p>{m.evidence && <p>Comprobante: {m.evidence}</p>}
 {!!m.attachments?.length&&<ul className="mt-2 space-y-2">{m.attachments.map(file=><li key={file.id}><a href={`/inventario/comprobantes/${file.id}`} className="inline-block min-h-11 break-all py-3 text-sm font-medium text-primary underline">Descargar comprobante · {file.filename}</a></li>)}</ul>}
 <p className="text-xs text-muted-foreground">Movimiento {m.id} · Autor {m.author} · Registro {m.createdAt}</p>
 {["perdida","robo","baja"].includes(m.kind) && <p>{m.approved===null?"Pendiente de aprobación":m.approved?"Aprobado":"Rechazado"}{m.decisionAuthor && ` · Aprobador ${m.decisionAuthor} · ${m.decisionReason}`}</p>}
 </li>)}</ul>;
}

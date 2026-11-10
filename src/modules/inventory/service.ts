import "server-only";
import { getAccessContext } from "@/server/authorization/context";
import { canUseInventory } from "./policy";
import { commandSchema, filterSchema } from "./schemas";
import * as repository from "./repository";
import { readReceiptLinks } from "./receipt-repository";
export async function getInventory(input: unknown = {}) {
  const scope = await getAccessContext();
  const parsed = filterSchema.safeParse(input);
  if (!scope || !canUseInventory(scope)) return { allowed:false as const, configured:!!scope, unavailable:false };
  const filters = parsed.success ? parsed.data : filterSchema.parse({});
  let data;
  try { data = await repository.readInventory(scope, filters); }
  catch(error) {
    const e = error as {code?:string;cause?:{code?:string}};
    if ((e.cause?.code ?? e.code) === "42P01") return {allowed:false as const, configured:true, unavailable:true};
    throw error;
  }
  const receipts=await readReceiptLinks(scope,[...new Set([...data.history,...data.pending].map(m=>m.id))]);
  const receiptGroups=new Map<string,typeof receipts>();
  for(const receipt of receipts){const group=receiptGroups.get(receipt.movementId)??[];group.push(receipt);receiptGroups.set(receipt.movementId,group);}
  const withReceipts=(rows:repository.Movement[])=>rows.map(m=>({...m,attachments:receiptGroups.get(m.id)??[]}));
  return { allowed:true as const, configured:true, unavailable:false, admin:scope.role === "admin", userId:scope.userId, invalidFilters:!parsed.success, filters, ...data,history:withReceipts(data.history),pending:withReceipts(data.pending) };
}
export async function updateInventory(input: unknown) {
  const scope = await getAccessContext();
  if (!scope || !canUseInventory(scope)) throw new Error("Sin permiso de inventario");
  const data = commandSchema.parse(input);
  if (data.operation === "decision" && scope.role !== "admin") throw new Error("Solo administradores aprueban");
  return repository.command(scope, data);
}
export function csvCell(value: unknown) {
  let text = String(value ?? "");
  if (/^[\s]*[=+@-]/.test(text)) text = "'" + text;
  return '"' + text.replaceAll('"','""') + '"';
}
export async function exportInventory(input: unknown) {
  const scope = await getAccessContext();
  if (!scope || scope.role !== "admin") throw new Error("Exportación restringida");
  const rows = await repository.readHistory(scope, filterSchema.parse(input), 10001);
  if (rows.length > 10000) throw new Error("Acota el período a 10000 movimientos");
  await repository.recordExport(scope, rows.length);
  const headers = ["ID","Artículo","Unidad","Tipo","Cantidad","Origen","Destino","Responsable/receptor","Fecha efectiva","Motivo","Origen del material","Comprobante (referencia)","Autor UUID","Fecha registro","Aprobado","Aprobador UUID","Motivo decisión"];
  return '\uFEFF' + [headers, ...rows.map(r => [r.id,r.item,r.unit,r.kind,r.quantity,r.source,r.destination,r.person,r.date,r.reason,r.origin,r.evidence,r.author,r.createdAt,r.approved === null ? "" : r.approved ? "Sí" : "No",r.decisionAuthor,r.decisionReason])].map(row=>row.map(csvCell).join(",")).join("\r\n");
}

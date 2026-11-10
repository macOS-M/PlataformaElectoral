"use server";
import { revalidatePath } from "next/cache";
import { updateInventory } from "./service";
export type InventoryState = { error:string; success:string; id?:string };
export async function inventoryAction(_state: InventoryState, form: FormData): Promise<InventoryState> {
  let id:string;
  try {
    const data = {...Object.fromEntries([...form].filter(([key])=>key!=="receipts")),active:form.get("active")==="on",approved:form.get("approved")==="true"};
    const entries=form.getAll("receipts");
    if(entries.some(entry=>!(entry instanceof File)))throw new Error("Comprobantes inválidos");
    const files=entries.filter((entry):entry is File=>entry instanceof File&&!(entry.size===0&&!entry.name));
    id = files.length ? await (await import("./receipt-service")).updateInventoryWithReceipts(data,files) : await updateInventory(data);
  } catch (error) {
    const e = error as { code?:string; cause?:{code?:string} };
    const code = e.cause?.code ?? e.code;
    if(error instanceof Error&&error.name==="ReceiptError")return {error:error.message,success:""};
    return {error:code === "40001" ? "Los datos cambiaron. Recarga antes de continuar." : code === "23505" ? "Ya existe ese artículo, ubicación o solicitud." : code === "23514" ? "La operación supera el stock disponible o tiene datos inválidos." : "No se pudo registrar. Revisa datos, unidades, ubicaciones y permisos. Para aprobar se requiere otro administrador.",success:""};
  }
  revalidatePath("/inventario"); revalidatePath("/centros", "layout");
  const operation = form.get("operation");
  const kind = form.get("kind");
  const success = operation === "item" ? (form.get("id") ? "Artículo actualizado." : "Artículo creado. Ya podés agregar sus existencias.")
    : operation === "location" ? "Ubicación creada."
    : operation === "need" ? "Meta guardada."
    : operation === "decision" ? "Decisión registrada."
    : ["perdida", "robo", "baja"].includes(String(kind)) ? "Solicitud registrada. El stock cambiará cuando otro administrador la apruebe."
    : "Movimiento registrado. Las existencias fueron actualizadas.";
  return {error:"",success,id};
}

import { beforeEach, expect, it, vi } from "vitest";
const mocks=vi.hoisted(()=>({update:vi.fn(),revalidate:vi.fn(),receipts:vi.fn()}));
vi.mock("@/modules/inventory/service",()=>({updateInventory:mocks.update}));
vi.mock("next/cache",()=>({revalidatePath:mocks.revalidate}));
vi.mock("@/modules/inventory/receipt-service",()=>({updateInventoryWithReceipts:mocks.receipts}));
import { inventoryAction } from "@/modules/inventory/actions";
const id="10000000-0000-4000-8000-000000000001";
beforeEach(()=>{vi.resetAllMocks();mocks.update.mockResolvedValue(id);});
it("envía todos los archivos al guardado protegido y no usa el comando simple",async()=>{
 mocks.receipts.mockResolvedValue(id);const form=new FormData();form.set("operation","movement");form.append("receipts",new File(["%PDF-1.7"],"recibo.pdf",{type:"application/pdf"}));form.append("receipts",new File(["%PDF-1.7"],"otro.pdf",{type:"application/pdf"}));
 expect(await inventoryAction({error:"",success:""},form)).toMatchObject({id,error:""});expect(mocks.receipts.mock.calls[0][1]).toHaveLength(2);expect(mocks.receipts.mock.calls[0][0]).not.toHaveProperty("receipts");expect(mocks.update).not.toHaveBeenCalled();
});
it("no trata el campo de archivo vacío del navegador como un adjunto",async()=>{
 const form=new FormData();form.set("operation","movement");form.append("receipts",new File([],""));await inventoryAction({error:"",success:""},form);expect(mocks.update).toHaveBeenCalledOnce();expect(mocks.receipts).not.toHaveBeenCalled();
});
it("devuelve el artículo guardado para continuar con sus existencias",async()=>{const form=new FormData();form.set("operation","item");const result=await inventoryAction({error:"",success:""},form);expect(result.id).toBe(id);expect(result.success).toContain("Artículo creado");expect(mocks.revalidate).toHaveBeenCalledWith("/inventario");});
it("distingue ajuste pendiente de una actualización efectiva del stock",async()=>{const form=new FormData();form.set("operation","movement");form.set("kind","robo");const result=await inventoryAction({error:"",success:""},form);expect(result.success).toContain("cuando otro administrador");});
it("no comunica éxito ni revalida si falla la operación",async()=>{mocks.update.mockRejectedValue({code:"23514"});const result=await inventoryAction({error:"",success:""},new FormData());expect(result.success).toBe("");expect(result.id).toBeUndefined();expect(result.error).toContain("stock");expect(mocks.revalidate).not.toHaveBeenCalled();});

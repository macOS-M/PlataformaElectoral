import { beforeEach,it,expect,vi } from "vitest";
const mocks=vi.hoisted(()=>({access:vi.fn(),client:vi.fn(),bucket:vi.fn(),upload:vi.fn(),remove:vi.fn(),save:vi.fn(),unused:vi.fn(),read:vi.fn(),download:vi.fn(),ready:vi.fn()}));
vi.mock("server-only",()=>({}));
vi.mock("@/server/authorization/context",()=>({getAccessContext:mocks.access}));
vi.mock("@/server/auth/admin",()=>({createAdminAuthClient:mocks.client}));
vi.mock("@/modules/inventory/receipt-repository",()=>({saveWithReceipts:mocks.save,unusedReceiptPaths:mocks.unused,readReceipt:mocks.read,receiptSupportReady:mocks.ready}));
import { updateInventoryWithReceipts } from "@/modules/inventory/receipt-service";
import { getInventoryReceipt } from "@/modules/inventory/receipt-download";
import { GET } from "@/app/(private)/inventario/comprobantes/[id]/route";
const id="10000000-0000-4000-8000-000000000001";
const scope={userId:id,organizationId:id,cantonId:id,eventId:id,role:"member",editableModules:["A01"]};
const movement={operation:"movement",kind:"ingreso",itemId:id,quantity:1,sourceId:"",destinationId:id,personId:id,occurredOn:"2020-01-01",origin:"Prueba",reason:"Ingreso de prueba",evidence:"",requestId:id};
const pdf=()=>new File(["%PDF-1.7\nContenido sintético"],"prueba.pdf",{type:"application/pdf"});
beforeEach(()=>{
 vi.resetAllMocks();mocks.ready.mockResolvedValue(true);mocks.access.mockResolvedValue(scope);mocks.bucket.mockResolvedValue({data:{public:false},error:null});mocks.upload.mockResolvedValue({error:null});mocks.remove.mockResolvedValue({error:null});mocks.client.mockReturnValue({storage:{getBucket:mocks.bucket,from:()=>({upload:mocks.upload,remove:mocks.remove,download:mocks.download})}});
 mocks.save.mockImplementation(async(_scope,_data,files)=>({id,paths:files.map((f:{storagePath:string})=>f.storagePath)}));mocks.unused.mockImplementation(async(_scope,paths)=>paths);mocks.read.mockResolvedValue(null);
});
it.each([null,{...scope,editableModules:[]},{...scope,editableModules:["district"]}])("no sube ni guarda sin A01/admin %j",async access=>{
 mocks.access.mockResolvedValue(access);await expect(updateInventoryWithReceipts(movement,[pdf()])).rejects.toThrow("permiso");expect(mocks.client).not.toHaveBeenCalled();expect(mocks.save).not.toHaveBeenCalled();
});
it("rechaza cantidad, tamaño y contenido falsificado antes de subir",async()=>{
 await expect(updateInventoryWithReceipts(movement,[pdf(),pdf(),pdf(),pdf()])).rejects.toThrow("3 archivos");
 await expect(updateInventoryWithReceipts(movement,[new File([new Uint8Array(5242881)],"grande.pdf",{type:"application/pdf"})])).rejects.toThrow("5 MB");
 await expect(updateInventoryWithReceipts(movement,[new File(["<script>"],"falso.pdf",{type:"application/pdf"})])).rejects.toThrow("válidos");
 await expect(updateInventoryWithReceipts(movement,[pdf(),pdf()])).rejects.toThrow("repetidos");expect(mocks.upload).not.toHaveBeenCalled();expect(mocks.save).not.toHaveBeenCalled();
});
it("rechaza bucket público antes de subir",async()=>{
 mocks.bucket.mockResolvedValue({data:{public:true}});await expect(updateInventoryWithReceipts(movement,[pdf()])).rejects.toThrow("privado");expect(mocks.upload).not.toHaveBeenCalled();
});
it("sin migración no llega a Storage ni altera el libro",async()=>{
 mocks.ready.mockResolvedValue(false);await expect(updateInventoryWithReceipts(movement,[pdf()])).rejects.toThrow("0016");expect(mocks.client).not.toHaveBeenCalled();expect(mocks.save).not.toHaveBeenCalled();
});
it("sube con ruta aleatoria propia y solo después confirma movimiento y metadata",async()=>{
 expect(await updateInventoryWithReceipts({...movement,storagePath:"ruta inyectada"},[pdf()])).toBe(id);
 const metadata=mocks.save.mock.calls[0][2][0];expect(metadata).toMatchObject({filename:"prueba.pdf",mimeType:"application/pdf",sha256:expect.stringMatching(/^[a-f0-9]{64}$/)});expect(metadata.storagePath).toMatch(new RegExp(`^${id}/${id}/${id}/[a-f0-9-]+\.pdf$`));
 expect(mocks.upload.mock.invocationCallOrder[0]).toBeLessThan(mocks.save.mock.invocationCallOrder[0]);expect(mocks.save.mock.calls[0][1]).not.toHaveProperty("storagePath");expect(mocks.remove).not.toHaveBeenCalled();
});
it("si falla Storage no intenta cambiar stock",async()=>{
 mocks.upload.mockResolvedValue({error:{message:"falló"}});await expect(updateInventoryWithReceipts(movement,[pdf()])).rejects.toThrow("no se confirmó");expect(mocks.save).not.toHaveBeenCalled();
});
it("un fallo SQL limpia solo los objetos confirmados como no referenciados",async()=>{
 mocks.save.mockRejectedValue({code:"23514"});await expect(updateInventoryWithReceipts(movement,[pdf()])).rejects.toMatchObject({code:"23514"});expect(mocks.unused).toHaveBeenCalledOnce();expect(mocks.remove).toHaveBeenCalledWith([expect.stringContaining(`${id}/${id}/`)]);
});
it("si la confirmación es ambigua conserva archivos ya referenciados o de estado desconocido",async()=>{
 mocks.save.mockRejectedValue(new Error("Conexión perdida"));mocks.unused.mockResolvedValue([]);await expect(updateInventoryWithReceipts(movement,[pdf()])).rejects.toThrow();expect(mocks.remove).not.toHaveBeenCalled();
 mocks.unused.mockRejectedValue(new Error("Sin conexión"));await expect(updateInventoryWithReceipts(movement,[pdf()])).rejects.toThrow();expect(mocks.remove).not.toHaveBeenCalled();
});
it("reintento idempotente elimina la copia nueva y conserva el comprobante original",async()=>{
 mocks.save.mockResolvedValue({id,paths:["original.pdf"]});expect(await updateInventoryWithReceipts(movement,[pdf()])).toBe(id);expect(mocks.remove).toHaveBeenCalledWith([expect.stringContaining(`${id}/${id}/`)]);
});
it("descarga rechaza permisos insuficientes e identificadores inválidos sin Storage",async()=>{
 mocks.access.mockResolvedValue({...scope,editableModules:["district"]});expect(await getInventoryReceipt(id)).toBeNull();expect(mocks.read).not.toHaveBeenCalled();
 const response=await GET(new Request("http://localhost"),{params:Promise.resolve({id})});expect(response.status).toBe(404);expect(mocks.client).not.toHaveBeenCalled();
 mocks.access.mockResolvedValue(scope);expect(await getInventoryReceipt("invalido")).toBeNull();expect(mocks.read).not.toHaveBeenCalled();
});
it("descarga autorizada usa ámbito servidor y respuesta privada como adjunto",async()=>{
 mocks.read.mockResolvedValue({id,storagePath:"privado/prueba.pdf",filename:"prueba.pdf",mimeType:"application/pdf"});mocks.download.mockResolvedValue({data:new Blob(["%PDF-1.7"]),error:null});
 const response=await GET(new Request("http://localhost"),{params:Promise.resolve({id})});expect(mocks.read).toHaveBeenCalledWith(scope,id);expect(response.status).toBe(200);expect(response.headers.get("cache-control")).toBe("private, no-store");expect(response.headers.get("content-disposition")).toContain("attachment");expect(response.headers.get("x-content-type-options")).toBe("nosniff");
});

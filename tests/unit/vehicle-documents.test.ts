import { beforeEach,it,expect,vi } from "vitest";
const mocks=vi.hoisted(()=>({access:vi.fn(),vehicle:vi.fn(),ready:vi.fn(),list:vi.fn(),read:vi.fn(),save:vi.fn(),unused:vi.fn(),client:vi.fn(),bucket:vi.fn(),upload:vi.fn(),remove:vi.fn(),download:vi.fn()}));
vi.mock("server-only",()=>({}));vi.mock("@/server/authorization/context",()=>({getAccessContext:mocks.access}));
vi.mock("@/modules/transport/document-repository",()=>({readVehicle:mocks.vehicle,documentSupportReady:mocks.ready,readVehicleDocuments:mocks.list,readVehicleDocument:mocks.read,saveVehicleDocuments:mocks.save,unusedVehiclePaths:mocks.unused}));
vi.mock("@/server/auth/admin",()=>({createAdminAuthClient:mocks.client}));
import { uploadVehicleDocuments,getVehicleDetail,getVehicleDocument } from "@/modules/transport/document-service";
import { GET } from "@/app/(private)/transporte/vehiculos/[id]/documentos/[documentId]/route";
const id="10000000-0000-4000-8000-000000000001",other="20000000-0000-4000-8000-000000000001";
const scope={userId:id,organizationId:id,cantonId:id,eventId:id,role:"member",editableModules:["A05"]},data={vehicleId:id,conductorId:other,batchId:id,category:"vehiculo"};
const pdf=()=>new File(["%PDF-1.7\nDocumento sintético"],"prueba.pdf",{type:"application/pdf"});
beforeEach(()=>{
 vi.resetAllMocks();mocks.access.mockResolvedValue(scope);mocks.vehicle.mockResolvedValue({id,responsibleId:other,conductorName:"Conductor sintético"});mocks.ready.mockResolvedValue(true);mocks.list.mockResolvedValue([]);mocks.read.mockResolvedValue(null);
 mocks.bucket.mockResolvedValue({data:{public:false},error:null});mocks.upload.mockResolvedValue({error:null});mocks.remove.mockResolvedValue({error:null});mocks.client.mockReturnValue({storage:{getBucket:mocks.bucket,from:()=>({upload:mocks.upload,remove:mocks.remove,download:mocks.download})}});mocks.save.mockImplementation(async(_scope,_input,files)=>files.map((f:{storagePath:string})=>f.storagePath));mocks.unused.mockImplementation(async(_scope,_vehicle,paths)=>paths);
});
it.each([null,{...scope,editableModules:[]},{...scope,editableModules:["A01"]}])("sin permiso de Transporte no adjunta ni descarga %j",async access=>{
 mocks.access.mockResolvedValue(access);await expect(uploadVehicleDocuments(data,[pdf()])).rejects.toThrow("permiso");expect(await getVehicleDocument(id,other)).toBeNull();expect(mocks.client).not.toHaveBeenCalled();expect(mocks.save).not.toHaveBeenCalled();expect(mocks.read).not.toHaveBeenCalled();
});
it("la consulta general de flota no entrega documentos sin permiso específico",async()=>{
 mocks.access.mockResolvedValue({...scope,editableModules:[]});expect(await getVehicleDetail(id)).toMatchObject({canManage:false,documents:[]});expect(mocks.list).not.toHaveBeenCalled();expect(mocks.ready).not.toHaveBeenCalled();
});
it("valida unidad y conductor actual antes de subir",async()=>{
 mocks.vehicle.mockResolvedValue(null);await expect(uploadVehicleDocuments(data,[pdf()])).rejects.toThrow("ámbito");expect(mocks.upload).not.toHaveBeenCalled();
 mocks.vehicle.mockResolvedValue({id,responsibleId:id});await expect(uploadVehicleDocuments({...data,category:"conductor"},[pdf()])).rejects.toThrow("conductor cambió");
});
it("rechaza cantidad, tamaño y contenido inválido",async()=>{
 await expect(uploadVehicleDocuments(data,[pdf(),pdf(),pdf(),pdf()])).rejects.toThrow("3 archivos");await expect(uploadVehicleDocuments(data,[new File([new Uint8Array(5242881)],"grande.pdf",{type:"application/pdf"})])).rejects.toThrow("5 MB");await expect(uploadVehicleDocuments(data,[new File(["<script>"],"falso.pdf",{type:"application/pdf"})])).rejects.toThrow("válidos");await expect(uploadVehicleDocuments(data,[pdf(),pdf()])).rejects.toThrow("repetidos");expect(mocks.upload).not.toHaveBeenCalled();
});
it("sin migración o con bucket público no sube archivos",async()=>{
 mocks.ready.mockResolvedValue(false);await expect(uploadVehicleDocuments(data,[pdf()])).rejects.toThrow("habilitada");expect(mocks.client).not.toHaveBeenCalled();mocks.ready.mockResolvedValue(true);mocks.bucket.mockResolvedValue({data:{public:true}});await expect(uploadVehicleDocuments(data,[pdf()])).rejects.toThrow("privado");expect(mocks.upload).not.toHaveBeenCalled();
});
it("sube una ruta propia y registra la misma unidad y conductor con hash",async()=>{
 await uploadVehicleDocuments({...data,organizationId:"inyectada",storagePath:"inyectada"},[pdf()]);expect(mocks.save).toHaveBeenCalledWith(scope,data,[expect.objectContaining({filename:"prueba.pdf",sha256:expect.stringMatching(/^[a-f0-9]{64}$/),storagePath:expect.stringContaining(`${id}/${id}/${id}/`)})]);
 expect(mocks.upload.mock.invocationCallOrder[0]).toBeLessThan(mocks.save.mock.invocationCallOrder[0]);expect(mocks.remove).not.toHaveBeenCalled();
});
it("un fallo de carga no registra metadata; un fallo SQL solo limpia copias no referenciadas",async()=>{
 mocks.upload.mockResolvedValue({error:{}});await expect(uploadVehicleDocuments(data,[pdf()])).rejects.toThrow("cargar");expect(mocks.save).not.toHaveBeenCalled();mocks.upload.mockResolvedValue({error:null});mocks.save.mockRejectedValue(new Error("SQL"));mocks.unused.mockResolvedValue([]);await expect(uploadVehicleDocuments(data,[pdf()])).rejects.toThrow();expect(mocks.remove).not.toHaveBeenCalled();
 mocks.unused.mockRejectedValue(new Error("Sin conexión"));await expect(uploadVehicleDocuments(data,[pdf()])).rejects.toThrow();expect(mocks.remove).not.toHaveBeenCalled();
});
it("descarga únicamente un documento autorizado de la unidad con respuesta privada",async()=>{
 mocks.read.mockResolvedValue({storagePath:"privado/prueba.pdf",filename:"prueba.pdf",mimeType:"application/pdf"});mocks.download.mockResolvedValue({data:new Blob(["%PDF-1.7"]),error:null});const response=await GET(new Request("http://localhost"),{params:Promise.resolve({id,documentId:other})});expect(mocks.read).toHaveBeenCalledWith(scope,id,other);expect(response.status).toBe(200);expect(response.headers.get("cache-control")).toBe("private, no-store");expect(response.headers.get("content-disposition")).toContain("attachment");
 mocks.access.mockResolvedValue(null);const denied=await GET(new Request("http://localhost"),{params:Promise.resolve({id,documentId:other})});expect(denied.status).toBe(404);
});

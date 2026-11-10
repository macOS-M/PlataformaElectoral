import { beforeEach,it,expect,vi } from "vitest";
const mocks=vi.hoisted(()=>({access:vi.fn(),prepare:vi.fn(),storage:vi.fn(),upload:vi.fn(),remove:vi.fn(),ready:vi.fn(),save:vi.fn(),unused:vi.fn()}));
vi.mock("server-only",()=>({}));vi.mock("@/server/authorization/context",()=>({getAccessContext:mocks.access}));
vi.mock("@/modules/transport/document-service",()=>({VehicleDocumentError:class extends Error{constructor(message:string){super(message);this.name="VehicleDocumentError";}},prepareVehicleFiles:mocks.prepare,getVehicleDocumentStorage:mocks.storage}));
vi.mock("@/modules/transport/registration-repository",()=>({registrationSupportReady:mocks.ready,saveVehicleWithDocuments:mocks.save,unusedRegistrationPaths:mocks.unused}));
import { registerVehicleWithDocuments } from "@/modules/transport/registration-service";
const id="10000000-0000-4000-8000-000000000001",scope={role:"member",editableModules:["A05"],organizationId:id,cantonId:id,eventId:id,userId:id};
const input={id:"",version:0,plate:"TEST-01",description:"Unidad sintética",personId:"",personVersion:"",fullName:"Conductor de prueba",phone:"",email:"",active:true,districtIds:[],centerIds:[],reason:"",registrationId:id,documentCategory:"conductor"};
beforeEach(()=>{
 vi.resetAllMocks();mocks.access.mockResolvedValue(scope);mocks.ready.mockResolvedValue(true);mocks.storage.mockResolvedValue({upload:mocks.upload,remove:mocks.remove});mocks.upload.mockResolvedValue({error:null});mocks.remove.mockResolvedValue({error:null});
 mocks.prepare.mockImplementation(async(_files,prefix)=>[{bytes:new Uint8Array([1]),metadata:{filename:"prueba.pdf",storagePath:`${prefix}/copia.pdf`,mimeType:"application/pdf",byteSize:1,sha256:"a".repeat(64)}}]);mocks.save.mockImplementation(async(_scope,_id,_hash,_data,_category,files)=>({id,paths:files.map((f:{storagePath:string})=>f.storagePath)}));mocks.unused.mockResolvedValue([]);
});
it.each([null,{...scope,editableModules:[]},{...scope,editableModules:["A01"]}])("rechaza guardar con archivos sin permiso de Transporte %j",async access=>{
 mocks.access.mockResolvedValue(access);await expect(registerVehicleWithDocuments(input,[])).rejects.toThrow("permiso");expect(mocks.prepare).not.toHaveBeenCalled();expect(mocks.save).not.toHaveBeenCalled();
});
it("valida los datos y disponibilidad antes de Storage",async()=>{
 await expect(registerVehicleWithDocuments({...input,plate:"?"},[])).rejects.toThrow();expect(mocks.prepare).not.toHaveBeenCalled();mocks.ready.mockResolvedValue(false);await expect(registerVehicleWithDocuments(input,[])).rejects.toThrow("No se guardó");expect(mocks.storage).not.toHaveBeenCalled();expect(mocks.save).not.toHaveBeenCalled();
});
it("carga en rutas propias y usa una única operación con metadata validada",async()=>{
 expect(await registerVehicleWithDocuments({...input,organizationId:"ajena"},[])).toBe(id);expect(mocks.prepare).toHaveBeenCalledWith([],`${id}/registrations/${id}`);expect(mocks.save).toHaveBeenCalledWith(scope,id,expect.stringMatching(/^[a-f0-9]{64}$/),expect.not.objectContaining({organizationId:"ajena"}),"conductor",[expect.objectContaining({filename:"prueba.pdf"})]);expect(mocks.upload.mock.invocationCallOrder[0]).toBeLessThan(mocks.save.mock.invocationCallOrder[0]);
});
it("si falla la carga no guarda conductor ni vehículo",async()=>{
 mocks.upload.mockResolvedValue({error:{}});await expect(registerVehicleWithDocuments(input,[])).rejects.toThrow("No se guardó el conductor");expect(mocks.save).not.toHaveBeenCalled();
});
it("reintento usa el mismo identificador/hash y limpia solo copias sobrantes",async()=>{
 mocks.save.mockResolvedValue({id,paths:["original.pdf"]});await registerVehicleWithDocuments(input,[]);await registerVehicleWithDocuments(input,[]);expect(mocks.save.mock.calls[0][1]).toBe(mocks.save.mock.calls[1][1]);expect(mocks.save.mock.calls[0][2]).toBe(mocks.save.mock.calls[1][2]);expect(mocks.remove).toHaveBeenCalledWith([`${id}/registrations/${id}/copia.pdf`]);
});
it("si el guardado es ambiguo no elimina evidencia referenciada ni comunica éxito",async()=>{
 mocks.save.mockRejectedValue(new Error("Sin conexión"));await expect(registerVehicleWithDocuments(input,[])).rejects.toThrow();expect(mocks.remove).not.toHaveBeenCalled();mocks.unused.mockRejectedValue(new Error("Sin conexión"));await expect(registerVehicleWithDocuments(input,[])).rejects.toThrow();expect(mocks.remove).not.toHaveBeenCalled();
});

import { beforeEach,afterEach,expect,it,vi } from "vitest";
vi.mock("server-only",()=>({}));
const mocks=vi.hoisted(()=>({access:vi.fn(),config:vi.fn(),command:vi.fn(),submit:vi.fn(),readOperations:vi.fn(),options:vi.fn(),services:vi.fn(),base:vi.fn(),vehicle:vi.fn()}));
vi.mock("@/server/authorization/context",()=>({getAccessContext:mocks.access}));
vi.mock("@/server/config",()=>({getConfiguration:mocks.config}));
vi.mock("@/modules/transport/repository",()=>({readTransport:mocks.base}));
vi.mock("@/modules/transport/document-repository",()=>({readVehicle:mocks.vehicle}));
vi.mock("@/modules/public-transport/repository",()=>({runCommand:mocks.command,submitRequest:mocks.submit,readOperations:mocks.readOperations,readPublicOptions:mocks.options,readPublicServices:mocks.services}));
import { formProtectionReady,issueTransportToken,sessionValue,verifyTransportToken } from "@/modules/public-transport/security";
import { getPublicTransport,scopeKey,submitPublicTransport,updateTransportOperations } from "@/modules/public-transport/service";
import { publicRequestSchema,publicFilterSchema,transportCommandSchema } from "@/modules/public-transport/schemas";
import { transportDate,transportTimestamp } from "@/modules/public-transport/dates";
const org="10000000-0000-4000-8000-000000000001",canton="20000000-0000-4000-8000-000000000001",event="30000000-0000-4000-8000-000000000001",district="40000000-0000-4000-8000-000000000001",center="50000000-0000-4000-8000-000000000001";
const scope={organizationId:org,cantonId:canton,eventId:event};
const passenger={kind:"passenger",name:"",contactChannel:"",contact:"",districtId:district,centerId:"",desiredTime:"",vehicleDetails:""};
it.each(["", "00:00", "16:59", "17:00"])("acepta horario opcional hasta las 17:00 inclusive: %s",desiredTime=>{
 expect(publicRequestSchema.safeParse({...passenger,desiredTime}).success).toBe(true);
});
it.each(["17:01", "18:00", "23:59", "25:00", "5:00 PM"])("rechaza horario posterior al límite o inválido: %s",desiredTime=>{
 expect(publicRequestSchema.safeParse({...passenger,desiredTime}).success).toBe(false);
});
it("acepta GUID heredados de PostgreSQL en filtros, solicitudes y asignaciones",()=>{
 const seeded="808ac790-525c-7b7d-06a7-51834c10a805";
 expect(publicFilterSchema.safeParse({district:seeded}).success).toBe(true);
 expect(publicRequestSchema.safeParse({...passenger,districtId:seeded,centerId:seeded}).success).toBe(true);
 expect(transportCommandSchema.safeParse({operation:"window",vehicleId:seeded,districtId:seeded,startsAt:"2099-11-08T08:00:00Z",endsAt:"2099-11-08T09:00:00Z"}).success).toBe(true);
 expect(publicFilterSchema.safeParse({district:"invalido"}).success).toBe(false);
});
beforeEach(()=>{vi.resetAllMocks();vi.stubEnv("AUTH_IDENTIFIER_SECRET","synthetic-test-secret-with-at-least-32-characters");mocks.config.mockReturnValue({APP_ORGANIZATION_ID:org,APP_CANTON_ID:canton,APP_EVENT_ID:event});mocks.options.mockResolvedValue({districts:[{id:district,name:"Distrito sintético"}],centers:[{id:center,name:"Centro sintético",districtId:district}]});mocks.services.mockResolvedValue([]);});
afterEach(()=>vi.unstubAllEnvs());
it("aprobar reutiliza el conductor de la unidad y rechaza otra persona también en servidor",async()=>{
 const current={role:"admin",editableModules:[],...scope,userId:org};mocks.access.mockResolvedValue(current);mocks.vehicle.mockResolvedValue({responsibleId:org});
 const input={operation:"review",id:org,version:1,status:"aprobada",personId:"",vehicleId:center,plate:"",description:"",reason:"Revisión de prueba",confirmed:true};
 await updateTransportOperations(input);expect(mocks.command).toHaveBeenCalledWith(current,expect.objectContaining({personId:org,vehicleId:center}));
 await expect(updateTransportOperations({...input,personId:district})).rejects.toThrow("conductor");expect(mocks.command).toHaveBeenCalledOnce();
});
it("un envío directo posterior a las 17:00 se rechaza antes de persistir",async()=>{
 const session=sessionValue();const token=issueTransportToken(session,scopeKey(scope),"passenger",Date.now()-3000);
 await expect(submitPublicTransport({...passenger,desiredTime:"17:01"},token,session,"")).rejects.toThrow("5:00 p. m.");
 expect(mocks.submit).not.toHaveBeenCalled();
});
it("firma formularios ligados a navegador, ámbito y tipo, con tiempo mínimo y caducidad",()=>{
 const session=sessionValue();const token=issueTransportToken(session,scopeKey(scope),"passenger",10000);
 expect(sessionValue(session)).toBe(session);
 expect(verifyTransportToken(token,session,scopeKey(scope),"passenger",13000).id).toMatch(/^[a-f0-9-]{36}$/);
 for(const run of [()=>verifyTransportToken(token,session,scopeKey(scope),"passenger",10001),()=>verifyTransportToken(token,session,scopeKey(scope),"passenger",2000000),()=>verifyTransportToken(token,sessionValue(),scopeKey(scope),"passenger",13000),()=>verifyTransportToken(token,session,"ajeno","passenger",13000),()=>verifyTransportToken(token,session,scopeKey(scope),"driver",13000),()=>verifyTransportToken(`${token}.extra`,session,scopeKey(scope),"passenger",13000)])expect(run).toThrow();
});
it("sin secreto no habilita recepción ni emite una firma",()=>{vi.stubEnv("AUTH_IDENTIFIER_SECRET","");expect(formProtectionReady()).toBe(false);expect(()=>sessionValue()).toThrow();});
it("normaliza offsets SQL para no depender del análisis de fechas del navegador",()=>{
 expect(transportTimestamp("2099-11-08 15:00:00.123456+00")).toBe(Date.parse("2099-11-08T15:00:00.123Z"));
 expect(transportDate("2099-11-08 15:00:00+00")).toContain("9:00");
});
it("valida contacto opcional del pasajero y vehículo obligatorio del conductor",()=>{
 expect(publicRequestSchema.safeParse(passenger).success).toBe(true);
 const driver={...passenger,kind:"driver",name:"Persona sintética",contactChannel:"correo",contact:"persona@example.test"};
 expect(publicRequestSchema.safeParse(driver).success).toBe(false);
 expect(publicRequestSchema.safeParse({...driver,vehicleDetails:"Vehículo sintético TEST-01"}).success).toBe(true);
 expect(publicRequestSchema.safeParse({...passenger,kind:"driver"}).success).toBe(false);
 expect(publicRequestSchema.safeParse({...passenger,contactChannel:"telefono",contact:"------"}).success).toBe(false);
 expect(publicRequestSchema.safeParse({...passenger,districtId:""}).success).toBe(false);
});
it("recibe sin consultar Auth y no persiste el honeypot ni campos extra",async()=>{
 const session=sessionValue();const token=issueTransportToken(session,scopeKey(scope),"passenger",Date.now()-3000);
 mocks.submit.mockResolvedValue("acuse-opaco");
 expect(await submitPublicTransport({...passenger,cedula:"dato no admitido"},token,session,"")).toBe("acuse-opaco");
 expect(mocks.access).not.toHaveBeenCalled();
 const sent=mocks.submit.mock.calls[0];expect(sent[0]).toEqual(scope);expect(sent[1]).toEqual(passenger);expect(sent[3]).toMatch(/^[a-f0-9]{64}$/);
 await expect(submitPublicTransport(passenger,token,session,"spam")).rejects.toThrow();expect(mocks.submit).toHaveBeenCalledTimes(1);
});
it("una consulta fallida se distingue de no tener rutas publicadas",async()=>{
 expect(await getPublicTransport({district})).toMatchObject({ready:true,services:[],invalidFilters:false});
 mocks.services.mockRejectedValue(new Error("Detalle privado no publicable"));
 expect(await getPublicTransport({district})).toMatchObject({ready:false,services:[]});
});
it("acepta los filtros opcionales vacíos enviados por formularios GET",async()=>{expect(await getPublicTransport({district,center:""})).toMatchObject({ready:true,invalidFilters:false,district,center:""});expect(await getPublicTransport({district:"",center:""})).toMatchObject({ready:true,invalidFilters:false});});
it.each([{district:[district]}, {center:org}, {district:org,center}])("rechaza filtros ambiguos o ajenos sin devolver servicios %j",async query=>{
 mocks.services.mockResolvedValue([{id:"privado",title:"Nunca mostrar con filtros inválidos"}]);
 expect(await getPublicTransport(query)).toMatchObject({invalidFilters:true,services:[]});
});
it("no consulta datos si falta configuración",async()=>{mocks.config.mockReturnValue(null);expect(await getPublicTransport()).toMatchObject({ready:false});expect(mocks.options).not.toHaveBeenCalled();});
it.each([null,{role:"member",editableModules:[]},{role:"member",editableModules:["A05"]}])("protege revisión y publicación ante llamadas directas %j",async current=>{
 mocks.access.mockResolvedValue(current);
 await expect(updateTransportOperations({operation:"vehicleStatus",vehicleId:org,version:0,approved:true,operationalStatus:"operativo"})).rejects.toThrow();
 await expect(updateTransportOperations({operation:"tripAction",id:org,version:1,action:"publish",authorized:true,reason:""})).rejects.toThrow();
 expect(mocks.command).not.toHaveBeenCalled();
});
it("A05 puede cancelar conservando el ámbito obtenido en servidor",async()=>{
 const current={role:"member",editableModules:["A05"],...scope,userId:org};mocks.access.mockResolvedValue(current);
 await updateTransportOperations({operation:"tripAction",id:org,version:1,action:"cancel",authorized:false,reason:"Cancelación sintética",organizationId:center});
 expect(mocks.command.mock.calls[0][0]).toBe(current);
 expect(mocks.command.mock.calls[0][1]).not.toHaveProperty("organizationId");
});

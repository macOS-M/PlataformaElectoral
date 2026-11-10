import { beforeEach,it,expect,vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { createElement } from "react";
const mocks=vi.hoisted(()=>({access:vi.fn(),detail:vi.fn(),read:vi.fn(),board:vi.fn(),assign:vi.fn(),person:vi.fn()}));
vi.mock("server-only",()=>({}));
vi.mock("@/server/authorization/context",()=>({getAccessContext:mocks.access}));
vi.mock("@/modules/voting-centers/area-service",()=>({getCenterDetail:mocks.detail}));
vi.mock("@/modules/fiscals/repository",()=>({readFiscals:mocks.read,createBoard:mocks.board,setFiscal:mocks.assign}));
vi.mock("@/modules/organization/repository",()=>({savePerson:mocks.person}));
vi.mock("@/modules/fiscals/actions",()=>({addBoardAction:vi.fn(),assignFiscalAction:vi.fn(),addFiscalPersonAction:vi.fn()}));
import { boardSchema,fiscalSchema } from "@/modules/fiscals/schemas";
import { getFiscals,assignFiscal,addBoard,addFiscalPerson } from "@/modules/fiscals/service";
import { FiscalWorkspace } from "@/modules/fiscals/workspace";
const id="808ac790-525c-7b7d-06a7-51834c10a805";
const fiscal={centerId:id,boardId:"",role:"general",expectedId:"",personId:id,accreditationScope:"",accreditationReference:"",reason:""};
beforeEach(()=>{vi.resetAllMocks();mocks.access.mockResolvedValue({role:"admin",editableModules:[]});mocks.detail.mockResolvedValue({scope:{role:"member",editableModules:[]},center:{id,name:"Escuela sintética",status:"pendiente"}});mocks.read.mockResolvedValue({boards:[],assignments:[],people:[]});});
it("acepta general/suplentes de centro y titular/suplente solo en JRV",()=>{
 expect(fiscalSchema.safeParse(fiscal).success).toBe(true);expect(fiscalSchema.safeParse({...fiscal,role:"general_suplente"}).success).toBe(true);
 for(const role of ["titular","suplente"]){expect(fiscalSchema.safeParse({...fiscal,role,boardId:id}).success).toBe(true);expect(fiscalSchema.safeParse({...fiscal,role}).success).toBe(false);}
 expect(fiscalSchema.safeParse({...fiscal,boardId:id}).success).toBe(false);
});
it("JRV requiere número positivo y fuente; cambios y retiros requieren motivo",()=>{
 expect(boardSchema.safeParse({centerId:id,number:"00123",sourceReference:"Listado de prueba"})).toMatchObject({success:true,data:{number:123}});
 for(const number of ["",0,-1,1.5,"mesa inventada"])expect(boardSchema.safeParse({centerId:id,number,sourceReference:"Listado"}).success).toBe(false);
 expect(fiscalSchema.safeParse({...fiscal,expectedId:id,personId:"",reason:""}).success).toBe(false);expect(fiscalSchema.safeParse({...fiscal,expectedId:id,personId:"",reason:"Retiro de prueba"}).success).toBe(true);
});
it.each([null,{role:"member",editableModules:[]},{role:"member",editableModules:["A05"]}])("cada escritura exige permiso electoral: %j",async scope=>{
 mocks.access.mockResolvedValue(scope);await expect(assignFiscal(fiscal)).rejects.toThrow();await expect(addBoard({centerId:id,number:123,sourceReference:"Listado"})).rejects.toThrow();await expect(addFiscalPerson({centerId:id,fullName:"Prueba",phone:"",email:""})).rejects.toThrow();expect(mocks.assign).not.toHaveBeenCalled();expect(mocks.board).not.toHaveBeenCalled();expect(mocks.person).not.toHaveBeenCalled();
});
it.each(["A04","district"])("%s usa ámbito servidor y no parámetros de organización",async module=>{
 const scope={role:"member",editableModules:[module]};mocks.access.mockResolvedValue(scope);await assignFiscal({...fiscal,organizationId:"ajena"});expect(mocks.assign).toHaveBeenCalledWith(scope,fiscal);
});
it("la lectura valida el centro antes de acceder y no ofrece escritura al lector",async()=>{
 expect(await getFiscals(id)).toMatchObject({canEdit:false,ready:true});expect(mocks.detail).toHaveBeenCalledWith(id);expect(mocks.read).toHaveBeenCalledWith({role:"member",editableModules:[]},id);
 mocks.detail.mockRejectedValue(new Error("Centro ajeno"));await expect(getFiscals(id)).rejects.toThrow();expect(mocks.read).toHaveBeenCalledOnce();
});
it("sin migración informa indisponibilidad en lugar de inventar JRV",async()=>{
 mocks.read.mockRejectedValue({cause:{code:"42P01"}});expect(await getFiscals(id)).toMatchObject({ready:false,canEdit:false,boards:[],assignments:[]});
});
it("una nueva persona se registra una sola vez y no concede cuentas ni asignación automática",async()=>{
 await addFiscalPerson({centerId:id,fullName:"Persona sintética",phone:"",email:"",role:"admin",id});
 expect(mocks.person).toHaveBeenCalledWith(expect.anything(),{id:"",version:"",fullName:"Persona sintética",phone:"",email:"",notes:""});expect(mocks.assign).not.toHaveBeenCalled();
});
it("el lector ve cobertura real y no recibe formularios de escritura",()=>{
 const html=renderToStaticMarkup(createElement(FiscalWorkspace,{centerId:id,boards:[],assignments:[],people:[],canEdit:false}));
 expect(html).toContain("Vacante");expect(html).toContain("no tiene JRV registradas");expect(html).not.toContain("<form");expect(html).toContain("La asignación es interna");
});

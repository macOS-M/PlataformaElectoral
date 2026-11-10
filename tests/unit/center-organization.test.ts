import { beforeEach,it,expect,vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
const mocks=vi.hoisted(()=>({detail:vi.fn(),centers:vi.fn()}));
vi.mock("@/modules/voting-centers/area-service",()=>({getCenterDetail:mocks.detail}));
vi.mock("@/modules/voting-centers/service",()=>({getCenters:mocks.centers}));
vi.mock("@/modules/inventory/center-summary",()=>({CenterInventory:()=>null}));
import { CenterOrganization } from "@/modules/organization/center-view";
import { CenterPicker } from "@/modules/organization/center-picker";
const center="10000000-0000-4000-8000-000000000001";
beforeEach(()=>{
 vi.resetAllMocks();
 mocks.detail.mockResolvedValue({center:{id:center,name:"Escuela sintética",district:"Distrito sintético"},scope:{role:"member",editableModules:[]},areas:[{id:"a",code:"A05",name:"Transporte",assignmentId:"current",responsible:"Responsable del centro"},{id:"b",code:"A01",name:"Signos externos",assignmentId:null,responsible:null},{id:"c",code:"A09",name:"Enlace TSE",assignmentId:null,responsible:null}]});
 mocks.centers.mockResolvedValue({rows:[{id:center,name:"Escuela sintética",district:"Distrito sintético"}],total:1,totalPages:2,page:1,invalid:false,filters:{q:"escuela",district:"",status:"",page:1}});
});
it("usa responsables del centro, muestra vacantes y oculta A09",async()=>{
 const html=renderToStaticMarkup(await CenterOrganization({centerId:center}));
 expect(mocks.detail).toHaveBeenCalledWith(center);expect(html).toContain("Responsable del centro");expect(html).toContain("Vacante");expect(html).toContain("1 de 2 áreas");expect(html).not.toContain("Enlace TSE");
});
it("los módulos reciben el mismo identificador de participación del centro",async()=>{
 const html=renderToStaticMarkup(await CenterOrganization({centerId:center}));
 expect(html).toContain(`/transporte?center=${center}`);expect(html).toContain(`/capacitacion?center=${center}`);expect(html).toContain(`/centros/${center}/areas/A05`);expect(html).not.toContain("Inventario del centro");
});
it("A01 explícito ve inventario sin conceder otros permisos",async()=>{
 const detail=await mocks.detail();mocks.detail.mockResolvedValue({...detail,scope:{role:"member",editableModules:["A01"]}});
 expect(renderToStaticMarkup(await CenterOrganization({centerId:center}))).toContain("Inventario del centro");
});
it("la entrada de organigramas busca y pagina centros sin abandonar su ámbito",async()=>{
 const html=renderToStaticMarkup(await CenterPicker({query:{q:"escuela"}}));
 expect(mocks.centers).toHaveBeenCalledWith({q:"escuela"});expect(html).toContain(`/centros/${center}/organigrama`);expect(html).toContain("/organigrama/cantonal");expect(html).toContain("/organigrama?q=escuela");
});
it("la entrada de capacitación abre el equipo del centro y separa el cantonal",async()=>{
 const html=renderToStaticMarkup(await CenterPicker({query:{},purpose:"training"}));
 expect(html).toContain(`/capacitacion?center=${center}`);expect(html).toContain("/capacitacion?scope=cantonal");expect(html).toContain('action="/capacitacion"');
});

import { beforeEach,expect,it,vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
const mocks=vi.hoisted(()=>({portal:vi.fn(),transport:vi.fn()}));
vi.mock("@/modules/public-portal/service",()=>({getPublicPortal:mocks.portal}));
vi.mock("@/modules/public-transport/service",()=>({getPublicTransport:mocks.transport}));
import ServicesPage from "@/app/servicios/page";
import Home from "@/app/page";
const province="10000000-0000-4000-8000-000000000001",canton="20000000-0000-4000-8000-000000000001",district="30000000-0000-4000-8000-000000000001",center="40000000-0000-4000-8000-000000000001";
const territory={id:canton,name:"Cantón de prueba",province:{id:province,name:"Provincia de prueba"},districts:[{id:district,name:"Distrito de prueba"}]};
const portal={territories:[territory],selection:{canton:territory,district:territory.districts[0]},unavailable:false,invalidSelection:false};
const transport={ready:true,canSubmit:true,invalidFilters:false,districts:[{id:district,name:"Distrito de prueba"}],centers:[{id:center,name:"Escuela de prueba",districtId:district}],services:[],district,center:""};
beforeEach(()=>{vi.resetAllMocks();mocks.portal.mockResolvedValue(portal);mocks.transport.mockResolvedValue(transport);});
it("el inicio dirige a servicios y no ofrece transporte antes de elegir distrito",async()=>{
 mocks.portal.mockResolvedValue({...portal,selection:null});
 const html=renderToStaticMarkup(await Home({searchParams:Promise.resolve({})}));
 expect(html).toContain('action="/servicios"');expect(html).not.toContain("/servicios/transporte");expect(mocks.transport).not.toHaveBeenCalled();
});
it("conserva enlaces de selección antiguos redirigiendo al resultado nuevo",async()=>{
 await expect(Home({searchParams:Promise.resolve({canton,district})})).rejects.toMatchObject({digest:expect.stringContaining("/servicios?")});
});
it("no consulta transporte si la selección territorial no es válida",async()=>{
 mocks.portal.mockResolvedValue({...portal,selection:null,invalidSelection:true});
 await expect(ServicesPage({searchParams:Promise.resolve({canton,district:"ajeno"})})).rejects.toMatchObject({digest:"NEXT_REDIRECT;replace;/;307;"});
 expect(mocks.transport).not.toHaveBeenCalled();
});
it("vincula transporte al distrito validado y conserva el contexto en acciones y filtros",async()=>{
 const html=renderToStaticMarkup(await ServicesPage({searchParams:Promise.resolve({canton,district,center})}));
 expect(mocks.transport).toHaveBeenCalledWith({district,center});expect(html).toContain("Servicios en Distrito de prueba");expect(html).toContain("Sin transporte publicado");expect(html).toContain(`/servicios/transporte/solicitar?district=${district}`);expect(html).toContain(`name="canton" value="${canton}"`);expect(html).toContain(`name="district" value="${district}"`);
});
it("no confunde indisponibilidad o zona sin cobertura con cero rutas",async()=>{
 mocks.transport.mockResolvedValue({...transport,ready:false});
 let html=renderToStaticMarkup(await ServicesPage({searchParams:Promise.resolve({canton,district})}));expect(html).toContain("La consulta de transporte aún no está disponible");expect(html).not.toContain("Sin transporte publicado");expect(html).not.toContain("/servicios/transporte/solicitar");
 mocks.transport.mockResolvedValue({...transport,invalidFilters:true,districts:[]});html=renderToStaticMarkup(await ServicesPage({searchParams:Promise.resolve({canton,district})}));expect(html).not.toContain("Sin transporte publicado");
});

import { beforeEach,expect,it,vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
const mocks=vi.hoisted(()=>({get:vi.fn()}));
vi.mock("@/modules/public-transport/service",()=>({getPublicTransport:mocks.get}));
vi.mock("@/modules/public-transport/actions",()=>({submitTransportAction:vi.fn()}));
import Page from "@/app/servicios/transporte/page";
const data={ready:true,canSubmit:true,invalidFilters:false,districts:[{id:"d",name:"Distrito de prueba"}],centers:[{id:"c",name:"Escuela de prueba",districtId:"d"}],services:[],district:"",center:""};
beforeEach(()=>{mocks.get.mockResolvedValue(data);});
it("distingue Sin transporte publicado de una conexión no disponible",async()=>{
 let html=renderToStaticMarkup(await Page({searchParams:Promise.resolve({})}));expect(html).toContain("Sin transporte publicado");expect(html).toContain("sin garantía de cupo");
 mocks.get.mockResolvedValue({...data,ready:false});html=renderToStaticMarkup(await Page({searchParams:Promise.resolve({})}));expect(html).toContain("aún no está disponible");expect(html).not.toContain("Sin transporte publicado");
});
it("renderiza solo el contenido público aunque reciba atributos adicionales",async()=>{
 mocks.get.mockResolvedValue({...data,services:[{id:"t",title:"Ruta autorizada",meeting_point:"Punto institucional",institutional_contact:"central@example.test",starts_at:"2099-11-08T09:00:00-06:00",ends_at:"2099-11-08T10:00:00-06:00",district_id:"d",center_id:"c",plate:"DATO-PRIVADO",driver_contact:"privado@example.test"}]});
 const html=renderToStaticMarkup(await Page({searchParams:Promise.resolve({})}));expect(html).toContain("Ruta autorizada");expect(html).toContain("central@example.test");expect(html).not.toContain("DATO-PRIVADO");expect(html).not.toContain("privado@example.test");
});

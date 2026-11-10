import { beforeEach, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
const mocks=vi.hoisted(()=>({getInventory:vi.fn()}));
vi.mock("@/modules/inventory/service",()=>({getInventory:mocks.getInventory}));
vi.mock("@/modules/inventory/actions",()=>({inventoryAction:vi.fn()}));
import InventoryPage from "@/app/(private)/inventario/page";
const id="10000000-0000-4000-8000-000000000001";
const data={allowed:true,configured:true,admin:true,userId:id,invalidFilters:false,filters:{},items:[{id,name:"Artículo de prueba",variant:"Pequeño",unit:"pieza",category:"Prueba",active:true,version:1}],locations:[{id,name:"Almacén de prueba",kind:"almacen",centerId:null}],people:[],districts:[],centers:[],stock:[{itemId:id,locationId:id,usable:"3.000",damaged:"2.000"}],needs:[],history:[],pending:[]};
beforeEach(()=>{mocks.getInventory.mockResolvedValue(data);});
it("presenta catálogo con acciones sin formularios de movimientos abiertos",async()=>{
 const html=renderToStaticMarkup(await InventoryPage({searchParams:Promise.resolve({})}));
 expect(html).toContain("Registrar movimiento");expect(html).toContain("Nuevo artículo");expect(html).toContain("Disponible para usar");expect(html).toContain("Material dañado");expect(html).toContain("Buscar artículos");expect(html).toContain("Exportar CSV restringido");expect(html).not.toContain("Revisar movimiento");
});
it("A01 no recibe controles de aprobación o exportación",async()=>{
 mocks.getInventory.mockResolvedValue({...data,admin:false});
 const html=renderToStaticMarkup(await InventoryPage({searchParams:Promise.resolve({})}));
 expect(html).toContain("Registrar movimiento");expect(html).not.toContain("Registrar decisión");expect(html).not.toContain("Exportar CSV restringido");
});
it("sin permiso no renderiza catálogo, stock ni formularios",async()=>{
 mocks.getInventory.mockResolvedValue({allowed:false,configured:true,unavailable:false});
 const html=renderToStaticMarkup(await InventoryPage({searchParams:Promise.resolve({})}));
 expect(html).toContain("requiere permiso de signos externos");expect(html).not.toContain("Artículo de prueba");expect(html).not.toContain("Registrar movimiento");
});

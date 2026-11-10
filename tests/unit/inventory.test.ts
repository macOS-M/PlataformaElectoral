import { beforeEach, expect, it, vi } from "vitest";
const mocks=vi.hoisted(()=>({access:vi.fn(),command:vi.fn(),readInventory:vi.fn(),readHistory:vi.fn(),recordExport:vi.fn()}));
vi.mock("server-only",()=>({}));vi.mock("@/server/authorization/context",()=>({getAccessContext:mocks.access}));
vi.mock("@/modules/inventory/repository",()=>({command:mocks.command,readInventory:mocks.readInventory,readHistory:mocks.readHistory,recordExport:mocks.recordExport}));
import { getInventory, updateInventory, exportInventory, csvCell } from "@/modules/inventory/service";
import { commandSchema, filterSchema } from "@/modules/inventory/schemas";
const item={operation:"item",name:"Artículo sintético",category:"Prueba",unit:"pieza",active:true};
beforeEach(()=>{vi.resetAllMocks();mocks.access.mockResolvedValue({role:"admin",editableModules:[]});mocks.readHistory.mockResolvedValue([]);mocks.readInventory.mockResolvedValue({});});
it.each([null,{role:"member",editableModules:[]},{role:"member",editableModules:["district"]},{role:"member",editableModules:["A05"]}])("rechaza acceso y acción antes del repositorio %j",async scope=>{mocks.access.mockResolvedValue(scope);expect((await getInventory()).allowed).toBe(false);await expect(updateInventory(item)).rejects.toThrow();expect(mocks.command).not.toHaveBeenCalled();expect(mocks.readInventory).not.toHaveBeenCalled();});
it("A01 registra, no aprueba ni exporta",async()=>{mocks.access.mockResolvedValue({role:"member",editableModules:["A01"]});await updateInventory(item);expect(mocks.command).toHaveBeenCalledOnce();await expect(updateInventory({operation:"decision",movementId:"10000000-0000-4000-8000-000000000001",approved:true,reason:"Verificado"})).rejects.toThrow();await expect(exportInventory({})).rejects.toThrow();expect(mocks.readHistory).not.toHaveBeenCalled();});
it("valida cantidades, UUIDs, fechas y filtros múltiples",()=>{expect(commandSchema.safeParse({...item,unit:"unidad inventada"}).success).toBe(false);expect(filterSchema.safeParse({item:["duplicado"]}).success).toBe(false);expect(filterSchema.safeParse({from:"2026-11-06",to:"2026-11-01"}).success).toBe(false);});
it.each(["=SUM(1)","+cmd","@func","-2","  =1"])("neutraliza fórmula CSV %s",value=>expect(csvCell(value)).toBe(`"'${value}"`));
it("escapa comillas, comas y saltos CSV",()=>expect(csvCell('a,"b"\nc')).toBe('"a,""b""\nc"'));
it("exportación administra límites y registra auditoría",async()=>{mocks.readHistory.mockResolvedValue(Array(10001).fill({}));await expect(exportInventory({})).rejects.toThrow();expect(mocks.recordExport).not.toHaveBeenCalled();mocks.readHistory.mockResolvedValue([]);expect(await exportInventory({})).toContain("Artículo");expect(mocks.recordExport).toHaveBeenCalledOnce();});

it("sin migración muestra indisponibilidad y otros errores no se silencian",async()=>{
 mocks.readInventory.mockRejectedValue({code:"42P01"});expect(await getInventory()).toMatchObject({allowed:false,unavailable:true});
 mocks.readInventory.mockRejectedValue(new Error("fallo distinto"));await expect(getInventory()).rejects.toThrow("fallo distinto");
});

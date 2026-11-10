import { beforeEach, expect, it, vi } from "vitest";
import { createHash } from "node:crypto";
import { resolveTerritorySelection } from "@/modules/territories/selection";
import { territoryMutationSchema } from "@/modules/territories/schemas";
const mocks = vi.hoisted(() => ({ access: vi.fn(), write: vi.fn(), provinces: vi.fn(), read: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("@/server/authorization/context", () => ({ getAccessContext: mocks.access }));
vi.mock("@/modules/territories/repository", () => ({ writeTerritory: mocks.write, readProvinces: mocks.provinces }));
vi.mock("@/modules/public-portal/repository", () => ({ readPublicTerritories: mocks.read }));
import { getTerritories, updateTerritory } from "@/modules/territories/service";
const province = "10000000-0000-4000-8000-000000000001";
const canton = "20000000-0000-4000-8000-000000000001";
const district = "30000000-0000-4000-8000-000000000001";
const other = "40000000-0000-4000-8000-000000000001";
const territories = [{ id: canton, name: "Cantón de prueba", province: { id: province, name: "Provincia de prueba" }, districts: [{ id: district, name: "Distrito de prueba" }] }, { id: other, name: "Cantón sin distritos", districts: [] }];
const input = { operation: "province", name: "Provincia de prueba", officialCode: "", sourceUrl: "https://example.test/catalogo", confirmed: "on" };
beforeEach(() => vi.resetAllMocks());
it("acepta identificadores estables del catálogo generados como md5::uuid sin omitir pertenencia", () => {
 const seededId=(key:string)=>createHash("md5").update(key).digest("hex").replace(/^(.{8})(.{4})(.{4})(.{4})(.{12})$/,"$1-$2-$3-$4-$5");
 const p=seededId("cr-province-7"),c=seededId("cr-canton-706"),d=seededId("demo-district-1");
 const catalog=[{id:c,name:"Cantón de prueba",province:{id:p,name:"Provincia de prueba"},districts:[{id:d,name:"Distrito de prueba"}]}];
 expect(resolveTerritorySelection(catalog,{province:p,canton:c,district:d})?.district.id).toBe(d);
 expect(resolveTerritorySelection(catalog,{province:p,canton:c,district:district})).toBeNull();
 expect(resolveTerritorySelection(catalog,{province:[p],canton:c,district:d})).toBeNull();
});
it("valida toda la cadena y conserva enlaces previos sin provincia", () => {
  expect(resolveTerritorySelection(territories, { province, canton, district })?.district.id).toBe(district);
  expect(resolveTerritorySelection(territories, { canton, district })?.canton.id).toBe(canton);
  expect(resolveTerritorySelection(territories, { province: other, canton, district })).toBeNull();
  expect(resolveTerritorySelection(territories, { canton: other, district })).toBeNull();
  expect(resolveTerritorySelection(territories, { province: [province], canton, district })).toBeNull();
  expect(territories[1].districts).toEqual([]);
});
it.each([null, { role: "member", editableModules: ["district"] }])("deniega cambios sin administración %j", async scope => {
  mocks.access.mockResolvedValue(scope);
  await expect(updateTerritory(input)).rejects.toThrow("Sin permiso");
  expect(mocks.write).not.toHaveBeenCalled();
});
it("usa el ámbito autenticado y requiere confirmación y fuente", async () => {
  const scope = { role: "admin", cantonId: canton, organizationId: other };
  mocks.access.mockResolvedValue(scope);
  await updateTerritory({ ...input, cantonId: district });
  expect(mocks.write).toHaveBeenCalledWith(scope, input);
  expect(territoryMutationSchema.safeParse({ ...input, confirmed: "" }).success).toBe(false);
  expect(territoryMutationSchema.safeParse({ ...input, sourceUrl: "javascript:alert(1)" }).success).toBe(false);
  expect(territoryMutationSchema.safeParse({ ...input, officialCode: "inventado" }).success).toBe(false);
});
it("sin configuración no consulta ni inventa catálogos", async () => {
  mocks.access.mockResolvedValue(null);
  expect(await getTerritories()).toMatchObject({ configured: false, provinces: [], territories: [] });
  expect(mocks.read).not.toHaveBeenCalled();
  expect(mocks.provinces).not.toHaveBeenCalled();
});

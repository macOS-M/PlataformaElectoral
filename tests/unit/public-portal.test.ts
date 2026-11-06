import { beforeEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ config: vi.fn(), read: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("@/server/config", () => ({ getConfiguration: mocks.config }));
vi.mock("@/modules/public-portal/repository", () => ({ readPublicTerritories: mocks.read }));
import { getPublicPortal } from "@/modules/public-portal/service";
const canton = "10000000-0000-4000-8000-000000000001";
const district = "20000000-0000-4000-8000-000000000001";
const other = "30000000-0000-4000-8000-000000000001";
beforeEach(() => {
  vi.resetAllMocks();
  mocks.config.mockReturnValue({ APP_ORGANIZATION_ID: other, APP_CANTON_ID: canton });
  mocks.read.mockResolvedValue([{ id: canton, name: "Cantón de prueba", districts: [{ id: district, name: "Distrito de prueba" }] }]);
});
it("lee únicamente el ámbito configurado sin sustituirlo por parámetros públicos", async () => {
  const portal = await getPublicPortal({ canton, district });
  expect(mocks.read).toHaveBeenCalledWith(other, canton);
  expect(portal.selection?.district.id).toBe(district);
  expect(portal.invalidSelection).toBe(false);
});
it.each([
  { canton: other, district }, { canton, district: other },
  { canton: [canton, other], district }, { canton: "incorrecto", district }, { canton },
])("rechaza selección ajena, incompleta o ambigua %j", async query => {
  const portal = await getPublicPortal(query);
  expect(portal.selection).toBeNull();
  expect(portal.invalidSelection).toBe(true);
  expect(mocks.read).toHaveBeenCalledWith(other, canton);
});
it("no selecciona una zona automáticamente", async () => {
  expect((await getPublicPortal({})).selection).toBeNull();
});
it("sin configuración no accede a datos ni inventa territorios", async () => {
  mocks.config.mockReturnValue(null);
  expect(await getPublicPortal({})).toMatchObject({ territories: [], unavailable: true, selection: null });
  expect(mocks.read).not.toHaveBeenCalled();
});
it("mantiene la portada utilizable si falla el catálogo", async () => {
  mocks.read.mockRejectedValue(new Error("Detalle privado del servidor"));
  expect(await getPublicPortal({ canton, district })).toEqual({ territories: [], unavailable: true, selection: null, invalidSelection: false });
});
it("no presenta servicios para un distrito retirado del catálogo", async () => {
  mocks.read.mockResolvedValue([{ id: canton, name: "Cantón de prueba", districts: [] }]);
  expect((await getPublicPortal({ canton, district })).selection).toBeNull();
});

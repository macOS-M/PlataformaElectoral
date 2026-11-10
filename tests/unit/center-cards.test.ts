import { beforeEach, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import CenterDetail from "@/app/(private)/centros/[id]/page";
const getCenterDetail = vi.hoisted(() => vi.fn());
vi.mock("@/modules/voting-centers/area-service", () => ({ getCenterDetail }));
vi.mock("@/modules/inventory/center-summary", () => ({ CenterInventory: () => null }));
const names = ["Signos externos", "Movimientos sectoriales", "Territoriales", "Electorales", "Transporte", "Alimentación", "Coordinación Día E", "Redes sociales", "Enlace TSE"];
beforeEach(() => getCenterDetail.mockResolvedValue({
  center: { name: "Escuela de prueba", address: "Dirección de prueba", district: "Distrito de prueba" },
  areas: names.map((name, i) => ({ id: String(i), code: `A0${i + 1}`, name, responsible: i === 4 ? "Encargado de prueba" : null })),
}));
it("muestra las áreas visibles y el organigrama propio sin enlace TSE", async () => {
  const html = renderToStaticMarkup(await CenterDetail({ params: Promise.resolve({ id: "centro-prueba" }) }));
  for (const [i, name] of names.slice(0,8).entries()) {
    expect(html).toContain(name);
    expect(html).toContain(`/centros/centro-prueba/areas/A0${i + 1}`);
  }
  expect(html).toContain("Encargado de prueba");
  expect(html).not.toContain("Enlace TSE");
  expect(html).toContain("/centros/centro-prueba/organigrama");
  expect(html).toContain("Sin encargado asignado");
});

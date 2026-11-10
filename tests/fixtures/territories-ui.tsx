import { createRoot } from "react-dom/client";
import { TerritorySelector } from "../../src/modules/public-portal/territory-selector";

const provinceA = { id: "10000000-0000-4000-8000-000000000001", name: "Provincia A de prueba" };
const provinceB = { id: "10000000-0000-4000-8000-000000000002", name: "Provincia B de prueba" };
createRoot(document.getElementById("root")!).render(<TerritorySelector provinces={[provinceA, provinceB]} territories={[
  { id: "20000000-0000-4000-8000-000000000001", name: "Cantón A de prueba", province: provinceA, districts: [{ id: "30000000-0000-4000-8000-000000000001", name: "Distrito A de prueba" }] },
  { id: "20000000-0000-4000-8000-000000000002", name: "Cantón B de prueba", province: provinceB, districts: [{ id: "30000000-0000-4000-8000-000000000002", name: "Distrito B de prueba" }] },
  { id: "20000000-0000-4000-8000-000000000003", name: "Cantón vacío de prueba", province: provinceA, districts: [] },
  { id: "20000000-0000-4000-8000-000000000004", name: "Cantón previo de prueba", districts: [] },
]} />);

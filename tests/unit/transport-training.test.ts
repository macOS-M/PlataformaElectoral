import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ access: vi.fn(), saveVehicle: vi.fn(), saveRequirement: vi.fn(), recordProgress: vi.fn(), readTransport: vi.fn(), readTraining: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("@/server/authorization/context", () => ({ getAccessContext: mocks.access }));
vi.mock("@/modules/transport/repository", () => ({ saveVehicle: mocks.saveVehicle, readTransport: mocks.readTransport }));
vi.mock("@/modules/training/repository", () => ({ saveRequirement: mocks.saveRequirement, recordProgress: mocks.recordProgress, readTraining: mocks.readTraining }));
import { getTransport, updateVehicle } from "@/modules/transport/service";
import { getTraining, updateProgress, updateRequirement } from "@/modules/training/service";
import { vehicleSchema } from "@/modules/transport/schemas";
import { progressSchema, requirementSchema } from "@/modules/training/schemas";
const id = "10000000-0000-4000-8000-000000000001";
const vehicle = { id: "", version: 0, plate: "test-01", description: "Vehículo sintético", personId: id, personVersion: "2020-01-01", fullName: "Persona de prueba", phone: "", email: "", active: true, districtIds: [id], centerIds: [id], reason: "" };
const requirement = { positionId: id, expectedId: "", required: true, scheduledOn: "2020-01-01" };
const progress = { requirementId: id, assignmentId: id, expectedId: "", status: "cumplido", statusOn: "2020-01-02" };
beforeEach(() => { vi.resetAllMocks(); mocks.access.mockResolvedValue({ role: "admin", editableModules: [] }); });
describe("Autorización de entradas de servicio", () => {
  it.each([null, { role: "member", editableModules: [] }, { role: "member", editableModules: ["A04"] }])("rechaza transporte sin permiso antes del repositorio %j", async scope => {
    mocks.access.mockResolvedValue(scope);
    await expect(updateVehicle(vehicle)).rejects.toThrow();
    expect(mocks.saveVehicle).not.toHaveBeenCalled();
  });
  it.each(["A05", "district"])("permite transporte con %s", async module => {
    mocks.access.mockResolvedValue({ role: "member", editableModules: [module] });
    await updateVehicle(vehicle);
    expect(mocks.saveVehicle).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ plate: "TEST-01" }));
  });
  it.each([null, { role: "member", editableModules: ["organigrama"] }, { role: "member", editableModules: ["district"] }, { role: "member", editableModules: ["A04"] }])("solo admins gestionan capacitación %j", async scope => {
    mocks.access.mockResolvedValue(scope);
    await expect(updateRequirement(requirement)).rejects.toThrow();
    await expect(updateProgress(progress)).rejects.toThrow();
    expect(mocks.saveRequirement).not.toHaveBeenCalled();
    expect(mocks.recordProgress).not.toHaveBeenCalled();
  });
  it("valida antes de escribir y permite administrador", async () => {
    await expect(updateVehicle({ ...vehicle, centerIds: ["ajeno"] })).rejects.toThrow();
    expect(mocks.saveVehicle).not.toHaveBeenCalled();
    await updateRequirement(requirement); await updateProgress(progress);
    expect(mocks.saveRequirement).toHaveBeenCalledOnce(); expect(mocks.recordProgress).toHaveBeenCalledOnce();
  });
  it("sin configuración no consulta repositorios ni ofrece edición", async () => {
    mocks.access.mockResolvedValue(null);
    expect((await getTransport()).canEdit).toBe(false);
    expect((await getTraining()).canEdit).toBe(false);
    expect(mocks.readTraining).not.toHaveBeenCalled(); expect(mocks.readTransport).not.toHaveBeenCalled();
  });
});
describe("Validación de vehículos y fechas", () => {
  it("exige motivo para cambiar vehículo y versión para contacto compartido", () => {
    expect(vehicleSchema.safeParse({ ...vehicle, id, version: 1 }).success).toBe(false);
    expect(vehicleSchema.safeParse({ ...vehicle, personVersion: "" }).success).toBe(false);
    expect(vehicleSchema.safeParse({ ...vehicle, email: "inválido" }).success).toBe(false);
  });
  it("rechaza fechas inexistentes y fecha en puesto no requerido", () => {
    expect(requirementSchema.safeParse({ ...requirement, scheduledOn: "2020-02-30" }).success).toBe(false);
    expect(requirementSchema.safeParse({ ...requirement, required: false }).success).toBe(false);
    expect(progressSchema.safeParse({ ...progress, statusOn: "ayer" }).success).toBe(false);
    expect(progressSchema.safeParse({ ...progress, status: "aprobado_por_tse" }).success).toBe(false);
  });
});

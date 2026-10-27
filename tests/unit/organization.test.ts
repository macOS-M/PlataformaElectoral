import { describe, expect, it, vi } from "vitest";
import { personSchema, assignmentSchema } from "@/modules/organization/schemas";
const mocks = vi.hoisted(() => ({
  scope: vi.fn(),
  save: vi.fn(),
  assign: vi.fn(),
}));
vi.mock("server-only", () => ({}));
vi.mock("@/server/authorization/context", () => ({
  getAccessContext: mocks.scope,
}));
vi.mock("@/modules/organization/repository", () => ({
  savePerson: mocks.save,
  setResponsible: mocks.assign,
}));
import {
  updatePerson,
  updateResponsible,
} from "@/modules/organization/service";
describe("Entradas de organización", () => {
  it("valida contacto opcional y límites sin aceptar nombres vacíos", () => {
    const data = {
      id: "",
      version: "",
      fullName: "Persona de prueba",
      email: "",
      phone: "",
      notes: "",
    };
    expect(personSchema.safeParse(data).success).toBe(true);
    expect(personSchema.safeParse({ ...data, fullName: " " }).success).toBe(
      false,
    );
    expect(
      personSchema.safeParse({ ...data, email: "incorrecto" }).success,
    ).toBe(false);
    expect(
      personSchema.safeParse({ ...data, notes: "x".repeat(1001) }).success,
    ).toBe(false);
  });
  it("exige motivo cuando sustituye o finaliza", () => {
    const data = {
      positionId: "40000000-0000-4000-8000-000000000001",
      personId: "",
      expectedId: "90000000-0000-4000-8000-000000000001",
      reason: "",
    };
    expect(assignmentSchema.safeParse(data).success).toBe(false);
    expect(
      assignmentSchema.safeParse({ ...data, reason: "Finalización" }).success,
    ).toBe(true);
  });
  it("rechaza escrituras sin contexto autorizado antes del repositorio", async () => {
    mocks.scope.mockResolvedValue(null);
    await expect(updatePerson({})).rejects.toThrow();
    await expect(updateResponsible({})).rejects.toThrow();
    expect(mocks.save).not.toHaveBeenCalled();
    expect(mocks.assign).not.toHaveBeenCalled();
  });
});

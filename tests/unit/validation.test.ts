import { describe, it, expect } from "vitest";
import { loginSchema } from "@/modules/auth/schemas";
import {
  centerFiltersSchema,
  escapeLike,
} from "@/modules/voting-centers/schemas";
import { canAccessMembership } from "@/server/authorization/policy";
describe("Filtros de centros", () => {
  it("normaliza filtros y limita la paginación", () => {
    expect(
      centerFiltersSchema.parse({ q: " Centro ", page: "2" }),
    ).toMatchObject({ q: "Centro", page: 2 });
  });
  it.each([
    { page: -1 },
    { page: "abc" },
    { district: "otro" },
    { status: "ratificado" },
    { q: "a".repeat(101) },
    { q: ["a", "b"] },
  ])("rechaza filtros inválidos %j", (value) => {
    expect(centerFiltersSchema.safeParse(value).success).toBe(false);
  });
  it("escapa comodines del usuario en búsquedas literales", () => {
    expect(escapeLike("50%_\\")).toBe("50\\%\\_\\\\");
  });
});
describe("Autorización", () => {
  it("solo permite membresías administrativas activas", () => {
    expect(canAccessMembership({ active: true, role: "admin" })).toBe(true);
  });
  it.each([
    null,
    undefined,
    { active: false, role: "admin" },
    { active: true, role: "reader" },
  ])("rechaza una membresía insuficiente %j", (member) => {
    expect(canAccessMembership(member)).toBe(false);
  });
  it("rechaza acceso sin correo válido o contraseña", () => {
    expect(
      loginSchema.safeParse({ email: "correo", password: "" }).success,
    ).toBe(false);
  });
});

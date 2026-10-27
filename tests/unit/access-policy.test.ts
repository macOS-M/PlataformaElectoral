import { describe, it, expect } from "vitest";
import {
  canEditModule,
  canEditPosition,
  canCreatePerson,
  canAccessMembership,
  isGlobalAdmin,
} from "@/server/authorization/policy";
import {
  registrationSchema,
  cedulaSchema,
  authorizationSchema,
} from "@/modules/access/schemas";
describe("Roles y áreas", () => {
  it("un lector ve, pero no edita", () => {
    const s = { role: "member", editableModules: [] };
    expect(canAccessMembership({ role: "member", active: true })).toBe(true);
    expect(canEditModule(s, "organigrama")).toBe(false);
    expect(canCreatePerson(s)).toBe(false);
  });
  it("un coordinador de área solo edita su área", () => {
    const s = { role: "member", editableModules: ["A05"] };
    expect(canEditPosition(s, "A05")).toBe(true);
    expect(canEditPosition(s, "A06")).toBe(false);
    expect(canEditPosition(s, null)).toBe(false);
    expect(canCreatePerson(s)).toBe(true);
  });
  it("coordinación distrital edita todo, pero solo admin gestiona accesos", () => {
    const s = { role: "member", editableModules: ["district"] };
    expect(canEditPosition(s, null)).toBe(true);
    expect(canEditModule(s, "A09")).toBe(true);
    expect(isGlobalAdmin(s)).toBe(false);
    expect(isGlobalAdmin({ role: "admin" })).toBe(true);
  });
  it("normaliza solo separadores y exige cédula nacional, código y contraseña coincidente", () => {
    expect(cedulaSchema.parse("1-0000-0000")).toBe("100000000");
    expect(cedulaSchema.safeParse("abc100000000").success).toBe(false);
    expect(
      registrationSchema.safeParse({
        cedula: "100000000",
        code: "",
        password: "corta",
        confirmPassword: "otra",
      }).success,
    ).toBe(false);
    expect(
      authorizationSchema.safeParse({
        cedula: "100000000",
        role: "admin",
        modules: [],
        useCode: false,
      }).success,
    ).toBe(false);
  });
});

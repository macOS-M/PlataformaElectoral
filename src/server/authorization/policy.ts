export const modules = [
  { id: "district", label: "Coordinación distrital · todos los módulos" },
  { id: "organigrama", label: "Organigrama y directorio" },
  { id: "centros", label: "Centros de votación" },
  { id: "A01", label: "Signos externos" },
  { id: "A02", label: "Movimientos sectoriales" },
  { id: "A03", label: "Territoriales" },
  { id: "A04", label: "Electorales" },
  { id: "A05", label: "Transporte" },
  { id: "A06", label: "Alimentación" },
  { id: "A07", label: "Coordinación Día E" },
  { id: "A08", label: "Redes sociales" },
  { id: "A09", label: "Enlace TSE" },
] as const;
export type ModuleId = (typeof modules)[number]["id"];
export function canAccessMembership(
  membership: { active: boolean; role: string } | null | undefined,
) {
  return (
    membership?.active === true && ["admin", "member"].includes(membership.role)
  );
}
export function canEditModule(
  scope: { role: string; editableModules: readonly string[] } | null,
  module: string,
) {
  return (
    !!scope &&
    (scope.role === "admin" ||
      scope.editableModules.includes("district") ||
      scope.editableModules.includes(module))
  );
}
export function isGlobalAdmin(scope: { role: string } | null) {
  return scope?.role === "admin";
}

export function canEditPosition(
  scope: { role: string; editableModules: readonly string[] } | null,
  areaCode: string | null,
) {
  return (
    canEditModule(scope, "organigrama") ||
    (!!areaCode && canEditModule(scope, areaCode))
  );
}
export function canCreatePerson(
  scope: { role: string; editableModules: readonly string[] } | null,
) {
  return (
    canEditModule(scope, "organigrama") ||
    !!scope?.editableModules.some((m) => /^A0[1-9]$/.test(m))
  );
}

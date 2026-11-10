export function canUseInventory(scope: { role: string; editableModules: readonly string[] } | null) {
  return !!scope && (scope.role === "admin" || scope.editableModules.includes("A01"));
}

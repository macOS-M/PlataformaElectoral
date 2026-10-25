export function canAccessMembership(
  membership: { active: boolean; role: string } | null | undefined,
) {
  return membership?.active === true && membership.role === "admin";
}

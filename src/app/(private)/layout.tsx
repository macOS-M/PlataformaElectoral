import { getAccessContext } from "@/server/authorization/context";
import { AppShell } from "@/components/layout/app-shell";
export const dynamic = "force-dynamic";
export default async function PrivateLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const scope = await getAccessContext();
  return <AppShell scope={scope}>{children}</AppShell>;
}

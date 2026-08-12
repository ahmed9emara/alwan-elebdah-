import { redirect } from "next/navigation";
import { getServerSession } from "@/lib/auth";
import { canCreateOrder, canManageUsers } from "@/lib/permissions";
import Navbar from "@/components/Navbar";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getServerSession({} as any);
  if (!session) redirect("/login");

  return (
    <div>
      <Navbar
        userName={session.name}
        role={session.role}
        canCreateOrder={canCreateOrder(session.role)}
        isAdmin={canManageUsers(session.role)}
      />
      <main>{children}</main>
    </div>
  );
}

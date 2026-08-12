import { NextRequest } from "next/server";
import { Role } from "@prisma/client";
import { getServerSession as nextAuthGetServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";

export interface AppSession {
  userId: string;
  name: string;
  role: Role;
  branchId: string | null;
}

/**
 * Thin wrapper around NextAuth's getServerSession so API routes have a
 * single, typed entry point. Swap the implementation here if the auth
 * provider ever changes (e.g. moving to a separate auth service at scale —
 * see SCALABILITY_PLAN.md, "Authentication").
 */
export async function getServerSession(_req: NextRequest): Promise<AppSession | null> {
  const session = await nextAuthGetServerSession(authOptions);
  if (!session?.user) return null;
  return {
    userId: (session.user as any).id,
    name: session.user.name ?? "",
    role: (session.user as any).role,
    branchId: (session.user as any).branchId ?? null,
  };
}

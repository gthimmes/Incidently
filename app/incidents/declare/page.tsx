import { prisma } from "@/lib/db";
import DeclareForm from "./DeclareForm";

export const dynamic = "force-dynamic";

export default async function DeclarePage() {
  const [services, users] = await Promise.all([
    prisma.service.findMany({ orderBy: { tier: "asc" } }),
    prisma.user.findMany({ orderBy: { name: "asc" } }),
  ]);
  return (
    <div className="max-w-2xl mx-auto animate-in">
      <h1 className="text-2xl font-bold tracking-tight mb-1">Declare an incident</h1>
      <p className="text-dim text-sm mb-6">
        Declaring pages the on-call responder immediately and opens a dedicated incident channel.
      </p>
      <DeclareForm services={services} users={users} />
    </div>
  );
}

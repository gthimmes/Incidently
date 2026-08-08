import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import RunbookEditor from "../RunbookEditor";

export const dynamic = "force-dynamic";

export default async function RunbookPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const services = await prisma.service.findMany({ orderBy: { name: "asc" } });

  if (id === "new") {
    return (
      <RunbookEditor
        runbook={{ id: null, title: "", content: "", serviceId: "" }}
        services={services}
      />
    );
  }

  const rb = await prisma.runbook.findUnique({ where: { id } });
  if (!rb) notFound();
  return (
    <RunbookEditor
      runbook={{ id: rb.id, title: rb.title, content: rb.content, serviceId: rb.serviceId ?? "" }}
      services={services}
    />
  );
}

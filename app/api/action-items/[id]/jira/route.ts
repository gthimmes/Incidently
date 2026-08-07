import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { createJiraIssue } from "@/lib/jira";

export async function POST(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const item = await prisma.actionItem.findUniqueOrThrow({
    where: { id },
    include: { incident: true },
  });
  try {
    const issue = await createJiraIssue({
      summary: `[INC-${item.incident.number}] ${item.title}`,
      description: `${item.description ?? item.title}\n\nRemediation from incident INC-${item.incident.number}: ${item.incident.title}\nPriority: ${item.priority}`,
    });
    const link = await prisma.jiraLink.create({
      data: {
        issueKey: issue.key,
        issueUrl: issue.url,
        issueSummary: issue.summary,
        issueStatus: issue.status,
        actionItemId: item.id,
        incidentId: item.incidentId,
      },
    });
    await prisma.incidentEvent.create({
      data: { incidentId: item.incidentId, kind: "jira_linked", message: `Jira issue ${issue.key} created for "${item.title}"` },
    });
    return NextResponse.json(link, { status: 201 });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 502 });
  }
}

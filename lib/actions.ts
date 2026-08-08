// Core domain operations shared by API routes.
import { prisma } from "./db";
import { fireLevel } from "./escalation";
import { broadcastToSlack } from "./slack";
import { INCIDENT_STATUSES, SEVERITIES } from "./constants";

async function nextIncidentNumber(): Promise<number> {
  const row = await prisma.setting.findUnique({ where: { key: "incident_counter" } });
  const n = row ? parseInt(row.value, 10) + 1 : 1001;
  await prisma.setting.upsert({
    where: { key: "incident_counter" },
    create: { key: "incident_counter", value: String(n) },
    update: { value: String(n) },
  });
  return n;
}

export async function getDefaultActor() {
  return prisma.user.findFirstOrThrow({ where: { role: "admin" } });
}

export async function declareIncident(opts: {
  title: string;
  summary?: string;
  severity: string;
  serviceId?: string;
  actorId?: string;
}) {
  const actor = opts.actorId
    ? await prisma.user.findUniqueOrThrow({ where: { id: opts.actorId } })
    : await getDefaultActor();
  const number = await nextIncidentNumber();
  const slug = opts.title.toLowerCase().split(/\s+/).slice(0, 3).join("-").replace(/[^a-z0-9-]/g, "");

  const incident = await prisma.incident.create({
    data: {
      number,
      title: opts.title,
      summary: opts.summary,
      severity: opts.severity,
      serviceId: opts.serviceId || null,
      slackChannel: `#inc-${number}-${slug}`,
    },
  });

  await prisma.incidentRole.create({
    data: { incidentId: incident.id, role: "commander", userId: actor.id },
  });

  const sev = SEVERITIES[opts.severity as keyof typeof SEVERITIES];
  await prisma.incidentEvent.create({
    data: {
      incidentId: incident.id,
      kind: "declared",
      message: `Incident declared (${sev?.label ?? opts.severity}) by ${actor.name}`,
      userId: actor.id,
    },
  });
  await prisma.incidentEvent.create({
    data: {
      incidentId: incident.id,
      kind: "role_assigned",
      message: `${actor.name} assumed Incident Commander`,
      userId: actor.id,
    },
  });

  // degrade the service on the status page for high-sev incidents
  if (opts.serviceId && (opts.severity === "sev1" || opts.severity === "sev2")) {
    await prisma.service.update({
      where: { id: opts.serviceId },
      data: { status: opts.severity === "sev1" ? "major_outage" : "degraded" },
    });
  }

  // page level 1 of the service's escalation policy
  await fireLevel(incident.id, 1);

  const service = opts.serviceId
    ? await prisma.service.findUnique({ where: { id: opts.serviceId } })
    : null;
  await broadcastToSlack({
    incidentId: incident.id,
    text: `:rotating_light: *${sev?.label ?? opts.severity} declared* — INC-${number}: ${opts.title}${service ? ` (${service.name})` : ""}. Channel: ${incident.slackChannel}`,
  });

  return incident;
}

export async function changeIncidentStatus(incidentId: string, status: string, actorId?: string) {
  const actor = actorId
    ? await prisma.user.findUniqueOrThrow({ where: { id: actorId } })
    : await getDefaultActor();
  const incident = await prisma.incident.findUniqueOrThrow({ where: { id: incidentId } });
  if (incident.status === status) return incident;

  const patch: Record<string, unknown> = { status };
  if (status === "monitoring" && !incident.mitigatedAt) patch.mitigatedAt = new Date();
  if (status === "resolved") {
    patch.resolvedAt = new Date();
    if (!incident.mitigatedAt) patch.mitigatedAt = new Date();
  }

  const updated = await prisma.incident.update({ where: { id: incidentId }, data: patch });

  const from = INCIDENT_STATUSES[incident.status as keyof typeof INCIDENT_STATUSES]?.label ?? incident.status;
  const to = INCIDENT_STATUSES[status as keyof typeof INCIDENT_STATUSES]?.label ?? status;
  await prisma.incidentEvent.create({
    data: {
      incidentId,
      kind: status === "resolved" ? "resolved" : "status_change",
      message: status === "resolved" ? "Incident resolved" : `Status changed: ${from} → ${to}`,
      userId: actor.id,
    },
  });

  await broadcastToSlack({
    incidentId,
    text:
      status === "resolved"
        ? `:white_check_mark: *INC-${incident.number} resolved* — ${incident.title}`
        : `:arrows_counterclockwise: INC-${incident.number} status: ${from} → *${to}*`,
  });

  if (status === "resolved") {
    // settle open pages, restore service status, scaffold a postmortem for sev1/2
    await prisma.page.updateMany({
      where: { incidentId, status: "pending" },
      data: { status: "resolved" },
    });
    if (incident.serviceId) {
      const openOthers = await prisma.incident.count({
        where: { serviceId: incident.serviceId, status: { not: "resolved" }, id: { not: incidentId } },
      });
      if (openOthers === 0) {
        await prisma.service.update({ where: { id: incident.serviceId }, data: { status: "operational" } });
      }
    }
    if (incident.severity === "sev1" || incident.severity === "sev2") {
      await prisma.postmortem.upsert({
        where: { incidentId },
        create: { incidentId, status: "draft", summary: incident.summary ?? incident.title },
        update: {},
      });
      await prisma.incidentEvent.create({
        data: { incidentId, kind: "note", message: "Postmortem draft created automatically (required for SEV1/SEV2)" },
      });
    }
  }

  return updated;
}

export async function acknowledgePage(pageId: string) {
  const page = await prisma.page.findUniqueOrThrow({
    where: { id: pageId },
    include: { user: true, incident: true },
  });
  if (page.status !== "pending") return page;
  const updated = await prisma.page.update({
    where: { id: pageId },
    data: { status: "acknowledged", ackedAt: new Date() },
  });
  await prisma.incidentEvent.create({
    data: {
      incidentId: page.incidentId,
      kind: "page_acked",
      message: `${page.user.name} acknowledged the page`,
      userId: page.userId,
    },
  });
  if (!page.incident.acknowledgedAt) {
    await prisma.incident.update({
      where: { id: page.incidentId },
      data: { acknowledgedAt: new Date() },
    });
  }
  return updated;
}

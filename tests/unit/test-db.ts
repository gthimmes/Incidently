/**
 * Isolated-database harness for unit tests.
 *
 * Clones the schema from prisma/dev.db into a per-suite SQLite file and
 * points lib/db at it via DATABASE_URL *before* the lib modules load.
 * Call from beforeAll; every suite gets its own file so Windows file
 * locks from a previous suite can't collide.
 */
import fs from "fs";
import path from "path";

export function testDbPath(suite: string): string {
  return path.resolve(__dirname, `../../prisma/test-${suite}-${process.pid}.db`);
}

export function initTestDb(suite: string): string {
  const src = path.resolve(__dirname, "../../prisma/dev.db");
  const dest = testDbPath(suite);
  fs.copyFileSync(src, dest);
  process.env.DATABASE_URL = `file:${dest.replace(/\\/g, "/")}`;
  return dest;
}

export function cleanupTestDb(dest: string): void {
  try {
    fs.unlinkSync(dest);
  } catch {
    /* windows may still hold the handle; test dbs are gitignored */
  }
}

/* eslint-disable @typescript-eslint/no-explicit-any */
export async function wipeAll(prisma: any): Promise<void> {
  await prisma.webhookDelivery.deleteMany();
  await prisma.webhookSubscription.deleteMany();
  await prisma.checklistItem.deleteMany();
  await prisma.checklistTemplateItem.deleteMany();
  await prisma.checklistTemplate.deleteMany();
  await prisma.notification.deleteMany();
  await prisma.page.deleteMany();
  await prisma.jiraLink.deleteMany();
  await prisma.actionItem.deleteMany();
  await prisma.postmortem.deleteMany();
  await prisma.statusUpdate.deleteMany();
  await prisma.incidentEvent.deleteMany();
  await prisma.incidentRole.deleteMany();
  await prisma.alert.deleteMany();
  await prisma.incident.deleteMany();
  await prisma.escalationTarget.deleteMany();
  await prisma.escalationLevel.deleteMany();
  await prisma.shift.deleteMany();
  await prisma.schedule.deleteMany();
  await prisma.runbook.deleteMany();
  await prisma.maintenanceWindow.deleteMany();
  await prisma.service.deleteMany();
  await prisma.escalationPolicy.deleteMany();
  await prisma.user.deleteMany();
  await prisma.setting.deleteMany();
}

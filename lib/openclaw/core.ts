import { prisma } from '../db';

export async function processCommand(commandOrObj: string | Record<string, unknown>, context?: Record<string, unknown>): Promise<{ success: boolean; message: string; data?: unknown }> {
  const command = typeof commandOrObj === 'string' ? commandOrObj : (commandOrObj as Record<string, unknown>).command as string || '';
  const lower = command.toLowerCase().trim();

  if (lower.startsWith('status')) {
    const stats = await getQuickStats();
    return { success: true, message: `Status do sistema:\n${JSON.stringify(stats, null, 2)}`, data: stats };
  }

  if (lower.startsWith('listar apps') || lower.startsWith('apps')) {
    const apps = await prisma.app.findMany({ include: { _count: { select: { codes: true, orders: true } } } });
    return { success: true, message: `${apps.length} apps encontrados`, data: apps };
  }

  return { success: true, message: `Comando recebido: ${command}` };
}

export async function quickCommand(cmd: string): Promise<string> {
  const result = await processCommand(cmd);
  return result.message;
}

export async function loadAdminNumbers(): Promise<string[]> {
  const config = await prisma.config.findUnique({ where: { key: 'admin_numbers' } });
  if (!config?.value) return [];
  try { return JSON.parse(config.value); } catch { return []; }
}

export async function saveAdminNumbers(numbers: string[]): Promise<void> {
  await prisma.config.upsert({
    where: { key: 'admin_numbers' },
    update: { value: JSON.stringify(numbers) },
    create: { key: 'admin_numbers', value: JSON.stringify(numbers) },
  });
}

async function getQuickStats() {
  const [apps, orders, codes, users] = await Promise.all([
    prisma.app.count(),
    prisma.order.count(),
    prisma.code.count({ where: { status: 'available' } }),
    prisma.user.count(),
  ]);
  return { apps, orders, codesAvailable: codes, users };
}

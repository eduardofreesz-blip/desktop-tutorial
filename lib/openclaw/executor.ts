import os from 'os';
import { prisma } from '../db';

export async function getSystemStats() {
  const [apps, orders, codes, users, conversations] = await Promise.all([
    prisma.app.count(),
    prisma.order.count(),
    prisma.code.count(),
    prisma.user.count(),
    prisma.conversation.count(),
  ]);

  return {
    system: {
      platform: os.platform(),
      uptime: Math.floor(os.uptime()),
      memory: {
        total: Math.round(os.totalmem() / 1024 / 1024),
        free: Math.round(os.freemem() / 1024 / 1024),
        used: Math.round((os.totalmem() - os.freemem()) / 1024 / 1024),
      },
      cpus: os.cpus().length,
    },
    database: {
      apps,
      orders,
      codes,
      users,
      conversations,
    },
    timestamp: new Date().toISOString(),
  };
}

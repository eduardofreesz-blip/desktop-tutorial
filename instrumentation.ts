/**
 * Next.js instrumentation - executa na inicialização do servidor.
 * Inicia o bot Telegram automaticamente se estiver configurado.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    try {
      const { startTelegramPolling, loadTelegramConfig } = await import('./lib/telegram-bot');
      const config = await loadTelegramConfig();
      if (config?.botToken && config?.isActive) {
        await startTelegramPolling();
        console.log('[Startup] Bot Telegram iniciado automaticamente');
      }
    } catch (e) {
      console.warn('[Startup] Telegram auto-start:', (e as Error)?.message || e);
    }
  }
}

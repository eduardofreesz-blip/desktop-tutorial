import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

// Função auxiliar para gerar código aleatório de 16 dígitos
function generateRandomCode(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let code = '';
  for (let i = 0; i < 16; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

async function main() {
  console.log('🌱 Iniciando seed do banco de dados...');

  // 1. Criar usuários administradores
  console.log('👤 Criando usuários administradores...');
  
  const hashedPassword1 = await bcrypt.hash('johndoe123', 10);
  const hashedPassword2 = await bcrypt.hash('admin123', 10);

  await prisma.user.upsert({
    where: { email: 'john@doe.com' },
    update: {},
    create: {
      email: 'john@doe.com',
      password: hashedPassword1,
      name: 'John Doe',
      role: 'admin',
    },
  });

  await prisma.user.upsert({
    where: { email: 'admin@universalrecargas.com' },
    update: { password: hashedPassword2 },
    create: {
      email: 'admin@universalrecargas.com',
      password: hashedPassword2,
      name: 'Administrador',
      role: 'admin',
    },
  });

  console.log('✅ Usuários criados!');

  // 2. Criar Apps (Unitv, Xprime)
  console.log('📱 Criando apps de exemplo...');

  const unitv = await prisma.app.upsert({
    where: { id: 'unitv' },
    update: {},
    create: {
      id: 'unitv',
      name: 'Unitv',
      description: 'Serviço de streaming de TV e canais ao vivo',
      logoUrl: null,
      isActive: true,
    },
  });

  const xprime = await prisma.app.upsert({
    where: { id: 'xprime' },
    update: {},
    create: {
      id: 'xprime',
      name: 'Xprime',
      description: 'Plataforma de conteúdo premium e séries',
      logoUrl: null,
      isActive: true,
    },
  });

  console.log('✅ Apps criados!');

  // 3. Criar Planos para cada app
  console.log('💳 Criando planos...');

  // Planos Unitv
  const unitvMonthly = await prisma.plan.upsert({
    where: { appId_type: { appId: unitv.id, type: 'monthly' } },
    update: {},
    create: {
      appId: unitv.id,
      type: 'monthly',
      price: 29.90,
      isActive: true,
    },
  });

  const unitvQuarterly = await prisma.plan.upsert({
    where: { appId_type: { appId: unitv.id, type: 'quarterly' } },
    update: {},
    create: {
      appId: unitv.id,
      type: 'quarterly',
      price: 79.90,
      isActive: true,
    },
  });

  const unitvAnnual = await prisma.plan.upsert({
    where: { appId_type: { appId: unitv.id, type: 'annual' } },
    update: {},
    create: {
      appId: unitv.id,
      type: 'annual',
      price: 249.90,
      isActive: true,
    },
  });

  // Planos Xprime
  const xprimeMonthly = await prisma.plan.upsert({
    where: { appId_type: { appId: xprime.id, type: 'monthly' } },
    update: {},
    create: {
      appId: xprime.id,
      type: 'monthly',
      price: 34.90,
      isActive: true,
    },
  });

  const xprimeQuarterly = await prisma.plan.upsert({
    where: { appId_type: { appId: xprime.id, type: 'quarterly' } },
    update: {},
    create: {
      appId: xprime.id,
      type: 'quarterly',
      price: 89.90,
      isActive: true,
    },
  });

  const xprimeAnnual = await prisma.plan.upsert({
    where: { appId_type: { appId: xprime.id, type: 'annual' } },
    update: {},
    create: {
      appId: xprime.id,
      type: 'annual',
      price: 279.90,
      isActive: true,
    },
  });

  console.log('✅ Planos criados!');

  // 4. Criar códigos de teste para cada plano
  console.log('🔑 Criando códigos de teste...');

  const plansWithCodes = [
    { plan: unitvMonthly, count: 10 },
    { plan: unitvQuarterly, count: 5 },
    { plan: unitvAnnual, count: 3 },
    { plan: xprimeMonthly, count: 10 },
    { plan: xprimeQuarterly, count: 5 },
    { plan: xprimeAnnual, count: 3 },
  ];

  for (const { plan, count } of plansWithCodes) {
    for (let i = 0; i < count; i++) {
      const code = generateRandomCode();
      
      // Verifica se o código já existe
      const existing = await prisma.code.findUnique({ where: { code } });
      
      if (!existing) {
        await prisma.code.create({
          data: {
            code,
            appId: plan.appId,
            planId: plan.id,
            status: 'available',
          },
        });
      }
    }
  }

  console.log('✅ Códigos criados!');

  // 5. Criar configurações iniciais
  console.log('⚙️ Criando configurações iniciais...');

  await prisma.config.upsert({
    where: { key: 'pix_key' },
    update: {},
    create: {
      key: 'pix_key',
      value: '',
    },
  });

  await prisma.config.upsert({
    where: { key: 'pix_name' },
    update: {},
    create: {
      key: 'pix_name',
      value: '',
    },
  });

  await prisma.config.upsert({
    where: { key: 'welcome_message' },
    update: {},
    create: {
      key: 'welcome_message',
      value: '👋 Olá! Bem-vindo à *Universal Recargas*!\n\nSomos especializados em códigos de recarga para apps de streaming.\n\n📱 Selecione o app desejado:',
    },
  });

  await prisma.config.upsert({
    where: { key: 'payment_instructions' },
    update: {},
    create: {
      key: 'payment_instructions',
      value: '💰 *Instruções de Pagamento*\n\nRealize o pagamento via PIX:\n\n🔑 Chave PIX: {PIX_KEY}\n👤 Nome: {PIX_NAME}\n💵 Valor: R$ {AMOUNT}\n\n⏱️ Após realizar o pagamento, aguarde a confirmação. Você receberá seu código em breve!',
    },
  });

  await prisma.config.upsert({
    where: { key: 'instructions_unitv' },
    update: {},
    create: {
      key: 'instructions_unitv',
      value: '📺 *Como ativar seu código Unitv:*\n\n1. Abra o app Unitv\n2. Vá em "Configurações" ou "Minha Conta"\n3. Selecione "Ativar Código"\n4. Digite o código recebido\n5. Pronto! Aproveite seu conteúdo!',
    },
  });

  await prisma.config.upsert({
    where: { key: 'instructions_xprime' },
    update: {},
    create: {
      key: 'instructions_xprime',
      value: '🎬 *Como ativar seu código Xprime:*\n\n1. Acesse o app Xprime\n2. Entre em "Menu" > "Ativar Assinatura"\n3. Insira o código fornecido\n4. Confirme a ativação\n5. Aproveite o conteúdo premium!',
    },
  });

  console.log('✅ Configurações criadas!');

  console.log('\n✨ Seed concluído com sucesso!');
  console.log('\n📊 Resumo:');
  console.log('- 2 usuários administradores');
  console.log('- 2 apps (Unitv, Xprime)');
  console.log('- 6 planos (3 por app)');
  console.log('- 36 códigos de teste');
  console.log('- 6 configurações');
}

main()
  .catch((e) => {
    console.error('❌ Erro durante o seed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

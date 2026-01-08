const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const users = [
    { keycloakId: 'user-001', email: 'alice@example.com', name: 'Alice Smith' },
    { keycloakId: 'user-002', email: 'bob@example.com', name: 'Bob Johnson' },
    { keycloakId: 'user-003', email: 'charlie@example.com', name: 'Charlie Brown' },
    { keycloakId: 'user-004', email: 'david@example.com', name: 'David Wilson' },
    { keycloakId: 'user-005', email: 'eve@example.com', name: 'Eve Davis' },
    { keycloakId: 'user-006', email: 'frank@example.com', name: 'Frank Miller' },
    { keycloakId: 'user-007', email: 'grace@example.com', name: 'Grace Taylor' },
    { keycloakId: 'user-008', email: 'henry@example.com', name: 'Henry Anderson' },
    { keycloakId: 'user-009', email: 'ivy@example.com', name: 'Ivy Thomas' },
    { keycloakId: 'user-010', email: 'jack@example.com', name: 'Jack Moore' },
  ];

  console.log('Seeding users...');
  
  for (const u of users) {
    await prisma.user.upsert({
      where: { keycloakId: u.keycloakId },
      update: {},
      create: u,
    });
  }

  console.log('Seeding finished.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

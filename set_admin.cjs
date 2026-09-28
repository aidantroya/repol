const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const email = 'aidtroya@espol.edu.ec';
  const user = await prisma.user.upsert({
    where: { email },
    update: { role: 'ADMIN' },
    create: {
      email,
      name: 'Aidan Troya',
      role: 'ADMIN',
      approvedContributions: 12,
      image: 'https://api.dicebear.com/7.x/bottts/svg?seed=aidtroya'
    }
  });
  console.log('SUCCESS: Usuario configurado como ADMIN en la base de datos:');
  console.log(JSON.stringify(user, null, 2));
}

main()
  .catch((e) => {
    console.error('Error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

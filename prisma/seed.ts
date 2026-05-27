import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  await prisma.escrow.create({
    data: {
      itemName: 'Mock Item 1',
      amount: 100,
      currency: 'USDC',
      buyerAddress: '0xBuyerAddress123',
      vendorAddress: '0xVendorAddress456',
      state: 'FUNDED',
    },
  });

  console.log('Seeding completed!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

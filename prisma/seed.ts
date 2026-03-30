import { PrismaClient, Role, UserLevel, SubscriptionPlan } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    console.log(`Start seeding ...`);

    // Create Admin User
    const adminEmail = 'admin@g-pulse.com';
    const adminUser = await prisma.user.upsert({
        where: { email: adminEmail },
        update: {
            role: Role.ADMIN,
        },
        create: {
            email: adminEmail,
            name: 'G-Pulse Admin',
            role: Role.ADMIN,
            level: UserLevel.ADVANCED,
            plan: SubscriptionPlan.EXPERT,
        },
    });

    console.log(`Created admin user with id: ${adminUser.id} and email: ${adminUser.email}`);
    console.log(`Seeding finished.`);
}

main()
    .then(async () => {
        await prisma.$disconnect();
    })
    .catch(async (e) => {
        console.error(e);
        await prisma.$disconnect();
        process.exit(1);
    });

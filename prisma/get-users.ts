
import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';

const prisma = new PrismaClient();

async function main() {
    const users = await prisma.user.findMany({
        select: { id: true, email: true, plan: true }
    });
    const lines = users.map(u => `User: ${u.email} | Plan: ${u.plan} | ID: ${u.id}`).join('\n');
    fs.writeFileSync('users.txt', lines);
    console.log('Users written to users.txt');
}

main()
    .catch(e => console.error(e))
    .finally(async () => await prisma.$disconnect());

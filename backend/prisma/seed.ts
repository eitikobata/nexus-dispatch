import { PrismaClient, OperativeStatus } from '@prisma/client';

const SKILLS = ['recon', 'infiltration', 'sabotage', 'extraction', 'hacking'] as const;
const OPERATIVE_NAMES = ['Ash', 'Vega', 'Rook', 'Fen', 'Talon', 'Nyx', 'Cobalt', 'Sable', 'Quill', 'Iris', 'Marlow', 'Dune'];

const prisma = new PrismaClient();

async function main() {
  for (const name of SKILLS) {
    await prisma.skill.upsert({ where: { name }, update: {}, create: { name } });
  }
  const skills = await prisma.skill.findMany();

  for (let i = 0; i < OPERATIVE_NAMES.length; i++) {
    const assignedSkills = skills.filter(() => Math.random() < 0.4).slice(0, 3);
    const guaranteed = skills[i % skills.length];
    const skillSet = assignedSkills.some((s) => s.id === guaranteed.id) ? assignedSkills : [...assignedSkills, guaranteed];

    await prisma.operative.create({
      data: {
        codename: OPERATIVE_NAMES[i],
        status: Math.random() < 0.15 ? OperativeStatus.OFF_DUTY : OperativeStatus.AVAILABLE,
        skills: { connect: skillSet.map((s) => ({ id: s.id })) },
      },
    });
  }
  console.log(`Seeded ${skills.length} skills and ${OPERATIVE_NAMES.length} operatives`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());

import { PrismaClient } from '@prisma/client';
import { DIAGNOSIS_DB } from './data';

const prisma = new PrismaClient();

async function main() {
  console.log('Starting clinical data seed...');
  
  // Clear existing data (optional, but good for idempotency)
  await prisma.clinicalDiagnosis.deleteMany();
  console.log('Cleared existing clinical data.');
  
  let count = 0;
  for (const dx of DIAGNOSIS_DB) {
    try {
      await prisma.clinicalDiagnosis.create({
        data: {
          slug: dx.id,
          name: dx.name,
          icd10: dx.icd10,
          system: dx.system,
          severity: dx.severity,
          prevalence: dx.prevalence,
          notes: dx.notes,
          symptoms: dx.symptoms,
          redFlags: dx.redFlags,
          
          medications: {
            create: dx.medications.map(m => ({
              drug: m.drug,
              dose: m.dose,
              route: m.route,
              frequency: m.frequency,
              duration: m.duration,
              notes: m.notes
            }))
          },
          labTests: {
            create: dx.labTests.map(l => ({
              name: l.name,
              code: l.code || '',
              urgency: l.urgency,
              reason: l.reason
            }))
          },
          imaging: {
            create: dx.imaging.map(i => ({
              type: i.type,
              region: i.region,
              urgency: i.urgency,
              reason: i.reason
            }))
          },
          referrals: {
            create: dx.referrals.map(r => ({
              specialty: r.specialty,
              urgency: r.urgency,
              reason: r.reason
            }))
          }
        }
      });
    } catch (e: any) {
      console.error(`Failed to insert ${dx.name}: `, e.message);
    }
  }
  
  console.log(`Successfully seeded ${count} diagnoses into the database.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

const fs = require('fs');

// 1. Restore the clean schema from node_modules
const cleanSchema = fs.readFileSync('node_modules/.prisma/client/schema.prisma', 'utf8');

// 2. Append the target Clinical models
const customModels = `
// ─── Clinical Data Models ──────────────────────────────────────────────────
model ClinicalDiagnosis {
  id          String   @id @default(cuid())
  slug        String   @unique
  name        String
  icd10       String
  system      String
  severity    String
  prevalence  String
  notes       String?  @db.Text

  symptoms    String[]
  redFlags    String[]

  medications ClinicalMedication[]
  labTests    ClinicalLabTest[]
  imaging     ClinicalImaging[]
  referrals   ClinicalReferral[]

  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  @@index([system])
  @@index([severity])
}

model ClinicalMedication {
  id            String             @id @default(cuid())
  drug          String
  dose          String
  route         String
  frequency     String
  duration      String
  notes         String?
  diagnosisId   String
  diagnosis     ClinicalDiagnosis  @relation(fields: [diagnosisId], references: [id], onDelete: Cascade)
}

model ClinicalLabTest {
  id            String             @id @default(cuid())
  name          String
  code          String
  urgency       String
  reason        String
  diagnosisId   String
  diagnosis     ClinicalDiagnosis  @relation(fields: [diagnosisId], references: [id], onDelete: Cascade)
}

model ClinicalImaging {
  id            String             @id @default(cuid())
  type          String
  region        String
  urgency       String
  reason        String
  diagnosisId   String
  diagnosis     ClinicalDiagnosis  @relation(fields: [diagnosisId], references: [id], onDelete: Cascade)
}

model ClinicalReferral {
  id            String             @id @default(cuid())
  specialty     String
  urgency       String
  reason        String
  diagnosisId   String
  diagnosis     ClinicalDiagnosis  @relation(fields: [diagnosisId], references: [id], onDelete: Cascade)
}
`;

fs.writeFileSync('prisma/schema.prisma', cleanSchema + '\n' + customModels);
console.log('Restored clean schema and appended new models successfully!');

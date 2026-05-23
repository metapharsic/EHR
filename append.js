const fs = require('fs');
const schemaPath = 'prisma/schema.prisma';
let schema = fs.readFileSync(schemaPath, 'utf8');

const append = `
model ClinicalDiagnosis {
  id          String   @id @default(uuid())
  slug        String   @unique
  name        String
  icd10       String
  system      String
  severity    String
  prevalence  String
  notes       String?
  symptoms    String[]
  redFlags    String[]

  medications ClinicalMedication[]
  labTests    ClinicalLabTest[]
  imaging     ClinicalImaging[]
  referrals   ClinicalReferral[]

  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
}

model ClinicalMedication {
  id          String   @id @default(uuid())
  drug        String
  dose        String
  route       String
  frequency   String
  duration    String
  notes       String?
  
  diagnosisId String
  diagnosis   ClinicalDiagnosis @relation(fields: [diagnosisId], references: [id], onDelete: Cascade)
}

model ClinicalLabTest {
  id          String   @id @default(uuid())
  name        String
  code        String
  urgency     String
  reason      String
  
  diagnosisId String
  diagnosis   ClinicalDiagnosis @relation(fields: [diagnosisId], references: [id], onDelete: Cascade)
}

model ClinicalImaging {
  id          String   @id @default(uuid())
  type        String
  region      String
  urgency     String
  reason      String
  
  diagnosisId String
  diagnosis   ClinicalDiagnosis @relation(fields: [diagnosisId], references: [id], onDelete: Cascade)
}

model ClinicalReferral {
  id          String   @id @default(uuid())
  specialty   String
  urgency     String
  reason      String
  
  diagnosisId String
  diagnosis   ClinicalDiagnosis @relation(fields: [diagnosisId], references: [id], onDelete: Cascade)
}
`;

if (!schema.includes('model ClinicalDiagnosis')) {
  fs.writeFileSync(schemaPath, schema + append);
  console.log('Appended models');
} else {
  console.log('Already appended');
}

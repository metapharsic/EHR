const fs = require('fs');
let content = fs.readFileSync('prisma/schema.prisma', 'utf8');

// Fix any missing newlines before closing braces (like `@@index([patientId])}`)
content = content.replace(/@@index\(\[(.*?)\]\)\}/g, '@@index([$1])\n}');
content = content.replace(/@@unique\(\[(.*?)\]\)\}/g, '@@unique([$1])\n}');

// Strip out everything from ClinicalDiagnosis onwards to perfectly rebuild it
const idxDiag = content.indexOf('model ClinicalDiagnosis {');
if (idxDiag > -1) {
  content = content.substring(0, idxDiag);
}

const customModels = `model ClinicalDiagnosis {
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

fs.writeFileSync('prisma/schema.prisma', content.trimEnd() + '\n\n' + customModels);
console.log('Fixed final schema structure.');

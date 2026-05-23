const fs = require('fs');
let s = fs.readFileSync('prisma/schema.prisma', 'utf8');

const fakeBlockStart = s.indexOf('// Update Encounter model');
if (fakeBlockStart > -1) {
   const fakeBlockEnd = s.indexOf('}', fakeBlockStart);
   s = s.substring(0, fakeBlockStart) + s.substring(fakeBlockEnd + 1);
}

const insertion = `
  // Voice Features
  voiceChartEntries     VoiceChartEntry[]
  dictatedNotes         DictatedNote[]
  scribeSessions        ScribeSession[]
  
  // Dashboard Metrics Relations
  patientSessions       PatientSession[]
  aiPredictions         AIPrediction[]
  riskAlerts            RiskAlert[]
  autoDocumentLogs      AutoDocumentLog[]
  autoDocuments         AutoDocument[]
`;

s = s.replace(/  observations      Observation\[\]\r?\n\r?\n  @@index/, `  observations      Observation[]\n${insertion}\n  @@index`);

fs.writeFileSync('prisma/schema.prisma', s);
console.log('Schema fixed');

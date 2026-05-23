const fs = require('fs');
let s = fs.readFileSync('prisma/schema.prisma', 'utf8');

s = s.replace(/Cascade\)\)/g, 'Cascade)');

const lines = s.split('\n');
const newLines = [];
let inUser = false;
let inVoiceSession = false;
let userScribeSeen = false;
let voiceTranscriptSeen = false;

for (let i = 0; i < lines.length; i++) {
  let line = lines[i];
  
  if (line.match(/^model User\s*\{/)) inUser = true;
  else if (line.match(/^model VoiceCommandSession\s*\{/)) inVoiceSession = true;
  else if (line.match(/^\}/)) {
    inUser = false;
    inVoiceSession = false;
  }
  
  if (inUser && line.includes('scribeSessions')) {
    if (userScribeSeen) continue;
    userScribeSeen = true;
  }
  
  if (inVoiceSession && line.includes('transcript        String')) {
    if (voiceTranscriptSeen) continue;
    voiceTranscriptSeen = true;
  }

  if (line.trim().startsWith('@@') && line.trim().endsWith('}')) {
     newLines.push(line.replace('}', ''));
     newLines.push('}');
     continue;
  }
  
  newLines.push(line);
}

fs.writeFileSync('prisma/schema.prisma', newLines.join('\n'));
console.log('Rescue complete');

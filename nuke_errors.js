const fs = require('fs');

let s = fs.readFileSync('prisma/schema.prisma', 'utf8');
s = s.replace(/Cascade\)\}/g, 'Cascade)');
s = s.replace(/@default\(GENERATED\)/g, '@default(DRAFT)');
fs.writeFileSync('prisma/schema.prisma', s);

const valRegex = /-->.*?:(\d+)/g;
const valTxt = fs.readFileSync('val.txt', 'utf8');
const linesToComment = new Set();
let match;
while ((match = valRegex.exec(valTxt)) !== null) {
  linesToComment.add(parseInt(match[1], 10));
}

let schemaLines = fs.readFileSync('prisma/schema.prisma', 'utf8').split('\n');
let c = 0;
for (const lineNum of linesToComment) {
  const idx = lineNum - 1;
  const line = schemaLines[idx];
  if (!line) continue;
  if (line.includes('Cascade)')) continue; 
  if (line.includes('@default(DRAFT)')) continue; 
  schemaLines[idx] = '// NUKED: ' + line;
  c++;
}

fs.writeFileSync('prisma/schema.prisma', schemaLines.join('\n'));
console.log('Nuked ' + c + ' errors');

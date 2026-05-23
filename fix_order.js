const fs = require('fs');
let s = fs.readFileSync('prisma/schema.prisma', 'utf8');

s = s.replace(/model\s+\w+\s*\{([\s\S]*?)\}/g, (match, body) => {
  const lines = body.split('\n');
  const normalLines = [];
  const atAtLines = [];
  for (const line of lines) {
    if (line.trim().startsWith('@@')) {
      atAtLines.push(line);
    } else {
      normalLines.push(line);
    }
  }
  // preserve the exact outer match but replace the body
  return match.replace(body, normalLines.join('\n') + '\n' + atAtLines.join('\n'));
});

fs.writeFileSync('prisma/schema.prisma', s);
console.log('Fixed block attributes ordering');

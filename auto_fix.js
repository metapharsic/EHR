const fs = require('fs');
let lines = fs.readFileSync('prisma/schema.prisma', 'utf8').split('\n');

let out = [];
let insideBlock = false;

for (let i = 0; i < lines.length; i++) {
  let line = lines[i].replace(/\r/g, '');
  const trimmed = line.trim();

  // Fix known corruptions
  line = line.replace(/Cascade\)\)/g, 'Cascade)');
  line = line.replace(/GENERATED/g, 'DRAFT'); // Fix the GENERATED enum error on DocumentStatus

  if (trimmed === '}]' || trimmed === '}, ...]' || trimmed === ']') continue;

  const isBlockStart = line.match(/^(model|enum|generator|datasource)\b.*?\{/);
  
  if (isBlockStart) {
    if (insideBlock) {
      out.push('}');
      out.push('');
    }
    insideBlock = true;
    out.push(line);
    continue;
  }

  if (trimmed === '}') {
    continue;
  }

  if (trimmed.startsWith('@@') && trimmed.endsWith('}')) {
     line = line.replace(/\}$/, '');
  }

  // Remove lines that look like duplicate @@index
  // We'll trust Prisma to format it.

  out.push(line);
}

if (insideBlock) {
  out.push('}');
}

fs.writeFileSync('prisma/schema.prisma', out.join('\n'));
console.log('Fixed brace matching!');

const fs = require('fs');
const content = fs.readFileSync('prisma/schema.prisma', 'utf8');

const modelRegex = /model\s+(\w+)\s*\{([\s\S]*?)\}/g;
const allModels = new Map();

let match;
while ((match = modelRegex.exec(content)) !== null) {
  const name = match[1];
  if (!allModels.has(name)) allModels.set(name, []);
  allModels.get(name).push(match[2]);
}

const mergedBodies = new Map();
for (const [name, bodies] of allModels.entries()) {
  let mergedLines = [];
  for (const body of bodies) {
    const lines = body.split('\n');
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.includes('// ... existing fields ...') || trimmed.includes('// Update ')) continue;
      
      // Basic deduplication of exact lines to prevent double @@index etc.
      if (!mergedLines.some(l => l.trim() === trimmed)) {
         mergedLines.push(line);
      }
    }
  }
  mergedBodies.set(name, mergedLines.join('\n'));
}

let cleanContent = '';
let pointer = 0;
const processedModels = new Set();

const blockRegex = /(model|enum)\s+(\w+)\s*\{([\s\S]*?)\}/g;
while ((match = blockRegex.exec(content)) !== null) {
  const type = match[1];
  const name = match[2];
  
  cleanContent += content.substring(pointer, match.index);
  
  if (type === 'model') {
    if (!processedModels.has(name)) {
      cleanContent += `model ${name} {\n${mergedBodies.get(name)}\n}`;
      processedModels.add(name);
    }
  } else {
    if (!processedModels.has(name)) {
      cleanContent += match[0];
      processedModels.add(name); // track enums too just in case of duplicate enums!
    }
  }
  
  pointer = match.index + match[0].length;
}
cleanContent += content.substring(pointer);

// Strip out stray comments left behind
cleanContent = cleanContent.replace(/\/\/ Update \w+ model.*?\r?\n/gi, '');

fs.writeFileSync('prisma/schema.prisma', cleanContent);
console.log('Schema deduplicated and merged cleanly.');

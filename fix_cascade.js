const fs = require('fs');
let s = fs.readFileSync('prisma/schema.prisma', 'utf8');

// Replace any mangled cascade statements like `onDelete: Cascade)[id]...`
s = s.replace(/onDelete:\s*Cascade\)(.*?)(onDelete:\s*Cascade)?/g, 'onDelete: Cascade');
// Also fix cases where references: [id] got duplicated or mangled
s = s.replace(/references:\s*\[id\],\s*onDelete:\s*Cascade\)(.*?)(onDelete:\s*Cascade)?/g, 'references: [id], onDelete: Cascade');

// Standardize the relation statements
s = s.replace(/@relation\(([^)]*?)onDelete:\s*Cascade[^)]*\)/g, '@relation($1onDelete: Cascade)');

fs.writeFileSync('prisma/schema.prisma', s);
console.log('Fixed Cascade relations');

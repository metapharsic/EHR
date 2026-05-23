const { execSync } = require('child_process');
const fs = require('fs');

try {
  const out = execSync('npx vitest run --reporter=basic', { encoding: 'utf-8' });
  fs.writeFileSync('test.log', out);
} catch (err) {
  const out = err.stdout || err.message;
  fs.writeFileSync('test.log', out);
}

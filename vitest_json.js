const { execSync } = require('child_process');
const fs = require('fs');

try {
  const out = execSync('npx vitest run --reporter=json', { stdio: 'pipe' });
  fs.writeFileSync('vitest_results.json', out);
} catch (e) {
  if (e.stdout) {
     fs.writeFileSync('vitest_results.json', e.stdout.toString());
  } else {
     fs.writeFileSync('vitest_results.json', e.message);
  }
}

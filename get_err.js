const { execSync } = require('child_process');
const fs = require('fs');
try {
  execSync('npx prisma validate', { stdio: 'pipe' });
  fs.writeFileSync('val.txt', 'OK');
} catch (err) {
  let msg = err.stderr ? err.stderr.toString() : err.message;
  msg = msg.replace(/\u001b\[.*?m/g, ''); 
  fs.writeFileSync('val.txt', msg);
}

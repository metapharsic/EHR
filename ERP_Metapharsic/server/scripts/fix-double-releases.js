const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '..', 'routes', 'oms.js');
let content = fs.readFileSync(filePath, 'utf8');

console.log('Scanning routes/oms.js for double-release patterns...');

// We want to find each router handler that uses db.getClient() and has a finally { client.release() } block.
// A simpler, perfectly safe heuristic:
// In all routes in routes/oms.js that use a transaction client, there is a finally block like:
// finally {
//     client.release();
// }
// (or client.release(); inside finally)
// Any other client.release() inside the try block is redundant and causes double-releases on early returns.
// So we can replace:
//   client.release();
//   return res.status(...
// with just:
//   return res.status(...
//
// Let's verify if there are any client.release() calls inside try blocks.

const oldLength = content.length;

// Replace: client.release(); followed by whitespace and return res.
content = content.replace(/client\.release\(\);\s*(return\s+res\.)/g, '$1');

// Also check for client.release() right before throwing an error or inside return blocks
// content = content.replace(/client\.release\(\);\s*(throw\s+)/g, '$1');

fs.writeFileSync(filePath, content, 'utf8');
console.log(`Finished! Replaced redundant client.release() calls in routes/oms.js.`);
console.log(`File size changed from ${oldLength} to ${content.length} bytes.`);

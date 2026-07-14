require('dotenv').config();
const accountingSync = require('./services/accountingSync');
accountingSync.syncAll(1)
  .then(r => { console.log(JSON.stringify(r, null, 2)); process.exit(0); })
  .catch(e => { console.error(e.message); process.exit(1); });

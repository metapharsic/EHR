
const db = require('./server/db');
db.query("INSERT INTO salary_slips (employee_id, month, year, overtime_amount) VALUES ('a660bda3-f632-433c-8095-4931f8516437', '6', 2026, 0)")
  .then(() => console.log('success'))
  .catch(e => console.log(e.message))
  .finally(() => process.exit(0));

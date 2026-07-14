require('dotenv').config({ path: '/u01/apps/Metapharsic_ERP/metapharsic-lifesciences_ERP-master/server/.env' });
const db = require('/u01/apps/Metapharsic_ERP/metapharsic-lifesciences_ERP-master/server/db');
async function seed() {
  const p = await db.query("SELECT id,name FROM pcd_partners ORDER BY name");
  const partners = {}; p.rows.forEach(r => { partners[r.name] = r.id; });
  const p1 = partners['Sunrise Pharma Distributors'];
  const p2 = partners['Bharat Medical Agencies'];
  const p3 = partners['Delhi Pharma Network'];
  const p4 = partners['Nair Healthcare Solutions'];
  console.log('Partners:', {p1,p2,p3,p4});
  if (!p1||!p2||!p3||!p4) { console.error('Partners missing!'); process.exit(1); }
  await db.query(`INSERT INTO pcd_targets (partner_id,period,period_start,period_end,target_amount,achieved_amount,incentive_percentage,status) VALUES ($1,'Q1-2026','2026-01-01','2026-03-31',500000,387000,3.5,'IN_PROGRESS'),($2,'Q1-2026','2026-01-01','2026-03-31',300000,312000,4.0,'ACHIEVED'),($3,'Q1-2026','2026-01-01','2026-03-31',700000,820000,5.0,'EXCEEDED'),($4,'Q1-2026','2026-01-01','2026-03-31',400000,195000,3.0,'IN_PROGRESS') ON CONFLICT DO NOTHING`,[p1,p2,p3,p4]);
  console.log('Targets OK');
  await db.query(`INSERT INTO pcd_transactions (partner_id,order_date,order_amount,product_name,quantity,order_status,payment_status,discount_given) VALUES ($1,'2026-01-10',85000,'MetaMol 500mg',200,'DELIVERED','PAID',8.5),($1,'2026-02-14',125000,'MetaCard 10mg',300,'DELIVERED','PAID',8.5),($1,'2026-03-05',177000,'MetaMol+MetaCard',450,'DELIVERED','PARTIAL',8.5),($2,'2026-01-20',95000,'MetaCard 10mg',180,'DELIVERED','PAID',7.0),($2,'2026-02-28',217000,'MetaVir 400mg',500,'DELIVERED','PAID',7.0),($3,'2026-01-08',220000,'MetaMol 500mg',600,'DELIVERED','PAID',10.0),($3,'2026-02-22',310000,'MetaCard+MetaVir',700,'DELIVERED','PAID',10.0),($3,'2026-03-18',290000,'MetaCard 10mg',650,'DELIVERED','UNPAID',10.0),($4,'2026-01-15',95000,'MetaVir 400mg',220,'DELIVERED','PAID',9.0),($4,'2026-03-22',100000,'MetaMol 500mg',250,'PROCESSING','UNPAID',9.0)`,[p1,p2,p3,p4]);
  console.log('Transactions OK');
  await db.query(`INSERT INTO pcd_commissions (partner_id,period,period_start,period_end,base_commission,scheme_bonus,net_commission,payment_status) VALUES ($1,'Q4-2025','2025-10-01','2025-12-31',34000,5000,39000,'PAID'),($2,'Q4-2025','2025-10-01','2025-12-31',22000,3000,25000,'PAID'),($3,'Q4-2025','2025-10-01','2025-12-31',58000,12000,70000,'PAID'),($4,'Q4-2025','2025-10-01','2025-12-31',28000,4000,32000,'PENDING')`,[p1,p2,p3,p4]);
  console.log('Commissions OK');
  await db.query(`INSERT INTO pcd_receivables (partner_id,invoice_id,invoice_date,invoice_amount,paid_amount,outstanding_amount,due_date,days_overdue,status) VALUES ($1,'INV-2026-001','2026-03-05',177000,80000,97000,'2026-04-05',55,'PARTIAL'),($3,'INV-2026-003','2026-03-18',290000,0,290000,'2026-04-18',42,'OPEN'),($4,'INV-2026-004','2026-03-22',100000,0,100000,'2026-04-22',38,'OPEN')`,[p1,p3,p4]);
  console.log('Receivables OK');
  const c = await db.query(`SELECT (SELECT COUNT(*) FROM pcd_partners) partners,(SELECT COUNT(*) FROM pcd_targets) targets,(SELECT COUNT(*) FROM pcd_transactions) txns,(SELECT COUNT(*) FROM pcd_commissions) comms,(SELECT COUNT(*) FROM pcd_receivables) recv`);
  console.log('Counts:', c.rows[0]);
  process.exit(0);
}
seed().catch(e=>{console.error(e.message);process.exit(1);});

const db = require('../server/db');

async function main() {
  try {
    // Simulate what the allocate route does
    const companyId = 1;
    const employee_id = '62ac0201-a043-4196-ab71-911db3bceca2'; // sample UUID
    const productId = null;
    const assetCategoryName = 'IT';
    const assetName = 'Test Laptop';
    const serialNo = null;
    const allocationDate = new Date();
    const notes = 'Test allocation';

    console.log('Step 1: Inserting into hr_asset_allocations...');
    const allocResult = await db.query(
      `INSERT INTO hr_asset_allocations 
       (company_id, employee_id, product_id, asset_type, asset_name, serial_number, allocated_on, notes, inventory_decremented)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, true) RETURNING *`,
      [companyId, employee_id, productId, assetCategoryName, assetName, serialNo, allocationDate, notes]
    );
    console.log('Success! Allocation ID:', allocResult.rows[0].id);

    // Cleanup
    await db.query('DELETE FROM hr_asset_allocations WHERE id = $1', [allocResult.rows[0].id]);
    console.log('Cleanup done');

  } catch (e) {
    console.error('Error at INSERT:', e.message);
    console.error('Detail:', e.detail);
  } finally {
    process.exit();
  }
}
main();

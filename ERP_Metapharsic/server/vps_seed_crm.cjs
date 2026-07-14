const db = require('./db.js');

async function seed() {
    const client = await db.getClient();
    try {
        await client.query('BEGIN');
        console.log('Seeding CRM leads...');

        const leads = [
            { name: 'Dr. John Doe', company_name: 'City Hospital', email: 'john@example.com', contact: '9876543210', location: 'Mumbai', status: 'New', priority: 'High', industry_type: 'Hospital', value: 150000 },
            { name: 'Jane Smith', company_name: 'Smith Pharma', email: 'jane@smith.com', contact: '8765432109', location: 'Delhi', status: 'In Progress', priority: 'Medium', industry_type: 'Distributor', value: 75000 },
            { name: 'PCD Network Alpha', company_name: 'Alpha Care PCD', email: 'alpha@pcd.com', contact: '7654321098', location: 'Pune', status: 'Converted', priority: 'High', industry_type: 'PCD Partner', value: 250000 },
            { name: 'Mega Meds', company_name: 'Mega Meds LLC', email: 'contact@megameds.com', contact: '6543210987', location: 'Bangalore', status: 'New', priority: 'Low', industry_type: 'Pharmacy', value: 20000 }
        ];

        for (const l of leads) {
            const res = await client.query(`
                INSERT INTO leads (name, company_name, email, contact, location, status, priority, industry_type, estimated_value, company_id)
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 1) RETURNING id;
            `, [l.name, l.company_name, l.email, l.contact, l.location, l.status, l.priority, l.industry_type, l.value]);

            const leadId = res.rows[0].id;

            if (l.status === 'Converted') {
                const partyRes = await client.query(`
                    INSERT INTO parties (name, type, email, mobile, address, city, territory, status, company_id)
                    VALUES ($1, 'Debtor', $2, $3, $4, $5, $6, 'Active', 1) RETURNING id;
                `, [l.name, l.email, l.contact, l.location, l.location, l.location]);

                const partyId = partyRes.rows[0].id;

                if (l.industry_type === 'PCD Partner') {
                    await client.query(`
                        INSERT INTO pcd_partners (name, territory, contact_number, email, status, partner_grade, company_id, converted_party_id, address)
                        VALUES ($1, $2, $3, $4, 'ACTIVE', 'GOLD', 1, $5, $6);
                    `, [l.name, l.location, l.contact, l.email, partyId, l.location]);
                }

                await client.query(`UPDATE leads SET converted_party_id = $1 WHERE id = $2;`, [partyId, leadId]);
            }

            await client.query(`
                INSERT INTO lead_activities (lead_id, type, description, outcome, performed_by)
                VALUES ($1, 'CALL', 'Initial contact', 'Positive', 1);
            `, [leadId]);
        }

        await client.query('COMMIT');
        console.log('Seeded CRM and PCD sync successfully.');
    } catch (e) {
        await client.query('ROLLBACK');
        console.error('Seeding failed:', e);
    } finally {
        client.release();
    }
}

seed().then(() => process.exit(0));

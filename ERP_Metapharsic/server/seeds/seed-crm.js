const db = require('./db');

async function seedCRM() {
  try {
    console.log('🌱 Seeding CRM data...');

    // 1. Get some users to assign to
    const usersResult = await db.query('SELECT id FROM users LIMIT 2');
    const users = usersResult.rows;

    if (users.length === 0) {
      console.log('❌ No users found. Cannot seed CRM.');
      return;
    }

    // 2. Create Leads
    const leads = [
      {
        name: 'John Smith',
        company: 'MediLife Pharma',
        email: 'john@medilife.com',
        phone: '+91 9876543210',
        source: 'Trade Show',
        status: 'Qualified',
        priority: 'High',
        assigned_to: users[0].id
      },
      {
        name: 'Sarah Jane',
        company: 'Aura Healthcare',
        email: 'sarah@aura.in',
        phone: '+91 9123456789',
        source: 'Web',
        status: 'New',
        priority: 'Medium',
        assigned_to: users[users.length - 1].id
      }
    ];

    for (const lead of leads) {
      const res = await db.query(
        `INSERT INTO leads (name, company, email, phone, source, status, priority, assigned_to)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING id`,
        [lead.name, lead.company, lead.email, lead.phone, lead.source, lead.status, lead.priority, lead.assigned_to]
      );
      
      const leadId = res.rows[0].id;

      // 3. Create Interactions
      const interactions = [
        {
          type: 'Call',
          summary: 'Initial discovery call. Client interested in bulk supply of paracetamol.',
          date: '2024-04-10'
        },
        {
          type: 'Email',
          summary: 'Sent company brochure and price list.',
          date: '2024-04-12'
        }
      ];

      for (const int of interactions) {
        await db.query(
          `INSERT INTO lead_interactions (lead_id, type, summary, interaction_date, created_by)
           VALUES ($1, $2, $3, $4, $5)`,
          [leadId, int.type, int.summary, int.date, lead.assigned_to]
        );
      }
    }

    console.log('✅ CRM Seeding complete!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Seeding failed:', error);
    process.exit(1);
  }
}

seedCRM();

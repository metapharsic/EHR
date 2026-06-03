const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  user: process.env.DB_USER || 'postgres',
  host: process.env.DB_HOST || 'localhost',
  database: process.env.DB_NAME || 'metapharsic_erp',
  password: process.env.DB_PASSWORD || 'password',
  port: process.env.DB_PORT || 5432,
});

const MOCK_DISPATCHES = [
  {
    invoice_no: 'INV-001',
    customer_name: 'Wellness Distributors',
    customer_address: '123 Main Street',
    customer_city: 'Pune',
    customer_state: 'Maharashtra',
    customer_pincode: '411001',
    dispatch_date: '2023-10-26',
    expected_delivery_date: '2023-10-28',
    transporter: 'VRL Logistics',
    transporter_id: 'VRL001',
    lr_number: 'VRL-12345678',
    eway_bill_no: '121212121212',
    eway_bill_date: '2023-10-26',
    boxes: 5,
    weight: '45 Kg',
    volume: '0.5 m³',
    package_type: 'Box',
    fragile: false,
    temperature_controlled: false,
    insurance_value: 0,
    insurance_company: '',
    cod_amount: 0,
    shipping_cost: 1200,
    handling_charges: 150,
    total_charges: 1350,
    payment_mode: 'Prepaid',
    status: 'Shipped',
    delivery_attempts: 0,
    tracking_updates: JSON.stringify([
      { timestamp: '2023-10-26 09:00', location: 'Pune Hub', status: 'Packed', remarks: 'Package packed and ready' },
      { timestamp: '2023-10-26 15:30', location: 'Pune Hub', status: 'Shipped', remarks: 'Dispatched to destination' }
    ]),
    vehicle_number: 'MH12AB1234',
    driver_name: 'Raj Kumar',
    driver_contact: '9876543210',
    route_details: 'Pune → Mumbai → Nashik',
    distance_covered: 180,
    created_by: 'Admin',
    last_updated_by: 'System'
  },
  {
    invoice_no: 'INV-002',
    customer_name: 'City Care Medicos',
    customer_address: '456 Medical Road',
    customer_city: 'Mumbai',
    customer_state: 'Maharashtra',
    customer_pincode: '400001',
    dispatch_date: '2023-10-26',
    expected_delivery_date: '2023-10-27',
    actual_delivery_date: '2023-10-27',
    transporter: 'Local Courier',
    transporter_id: 'LC001',
    lr_number: 'DTDC-99887766',
    eway_bill_no: '131313131313',
    eway_bill_date: '2023-10-26',
    boxes: 1,
    weight: '2 Kg',
    volume: '0.02 m³',
    package_type: 'Box',
    fragile: true,
    temperature_controlled: true,
    insurance_value: 5000,
    insurance_company: 'ICICI Lombard',
    shipping_cost: 150,
    handling_charges: 50,
    total_charges: 200,
    payment_mode: 'COD',
    cod_amount: 2500,
    status: 'Delivered',
    delivery_attempts: 1,
    delivery_person: 'Amit Sharma',
    delivery_remarks: 'Delivered successfully with signature',
    tracking_updates: JSON.stringify([
      { timestamp: '2023-10-26 10:00', location: 'Mumbai Hub', status: 'Packed', remarks: 'Package packed' },
      { timestamp: '2023-10-26 14:00', location: 'Mumbai Hub', status: 'Shipped', remarks: 'Out for delivery' },
      { timestamp: '2023-10-27 11:30', location: 'Mumbai', status: 'Delivered', remarks: 'Successfully delivered' }
    ]),
    vehicle_number: 'MH01CD5678',
    driver_name: 'Suresh Patil',
    driver_contact: '9876543211',
    route_details: 'Mumbai Local',
    distance_covered: 25,
    fuel_consumed: 3.2,
    created_by: 'Admin',
    last_updated_by: 'Delivery Executive'
  }
];

async function seed() {
  const client = await pool.connect();
  try {
    console.log('🌱 Seeding logistics data...');
    
    // Clear existing data
    await client.query('DELETE FROM dispatches');
    
    for (const d of MOCK_DISPATCHES) {
      const query = `
        INSERT INTO dispatches (
          invoice_no, customer_name, customer_address, customer_city, customer_state, customer_pincode,
          dispatch_date, expected_delivery_date, actual_delivery_date, transporter, transporter_id,
          lr_number, eway_bill_no, eway_bill_date, boxes, weight, volume, package_type, fragile,
          temperature_controlled, insurance_value, insurance_company, cod_amount, shipping_cost,
          handling_charges, total_charges, payment_mode, status, delivery_attempts, delivery_person,
          delivery_remarks, vehicle_number, driver_name, driver_contact, route_details, distance_covered,
          fuel_consumed, tracking_updates, created_by, last_updated_by
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, $26, $27, $28, $29, $30, $31, $32, $33, $34, $35, $36, $37, $38, $39, $40)
      `;
      
      await client.query(query, [
        d.invoice_no, d.customer_name, d.customer_address, d.customer_city, d.customer_state, d.customer_pincode,
        d.dispatch_date, d.expected_delivery_date, d.actual_delivery_date || null, d.transporter, d.transporter_id,
        d.lr_number, d.eway_bill_no, d.eway_bill_date, d.boxes, d.weight, d.volume, d.package_type, d.fragile,
        d.temperature_controlled, d.insurance_value, d.insurance_company, d.cod_amount, d.shipping_cost,
        d.handling_charges, d.total_charges, d.payment_mode, d.status, d.delivery_attempts, d.delivery_person || null,
        d.delivery_remarks || null, d.vehicle_number, d.driver_name, d.driver_contact, d.route_details, d.distance_covered || 0,
        d.fuel_consumed || 0, d.tracking_updates, d.created_by, d.last_updated_by
      ]);
    }
    
    console.log('✅ Logistics data seeded successfully!');
  } catch (error) {
    console.error('❌ Seeding failed:', error);
  } finally {
    client.release();
    await pool.end();
  }
}

seed();

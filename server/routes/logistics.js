const express = require('express');
const router = express.Router();
const db = require('../db');
const { verifyTokenMiddleware } = require('../utils/jwt');

// Verify authentication on all routes
router.use(verifyTokenMiddleware);

/**
 * GET /api/logistics
 * Fetch all dispatches with filters
 */
router.get('/', async (req, res) => {
  try {
    const {
      search = '',
      status = 'ALL',
      page = 1,
      limit = 20,
      sortBy = 'created_at',
      sortOrder = 'DESC',
    } = req.query;

    const offset = (page - 1) * limit;
    const allowedSortFields = ['invoice_no', 'customer_name', 'dispatch_date', 'status', 'created_at'];
    const sort = allowedSortFields.includes(sortBy) ? sortBy : 'created_at';

    let whereClause = 'WHERE 1=1';
    let params = [];

    if (search) {
      whereClause += ' AND (invoice_no ILIKE $' + (params.length + 1) + 
                     ' OR customer_name ILIKE $' + (params.length + 1) + 
                     ' OR lr_number ILIKE $' + (params.length + 1) + ')';
      params.push(`%${search}%`);
    }

    if (status !== 'ALL') {
      whereClause += ' AND status = $' + (params.length + 1);
      params.push(status);
    }

    const countQuery = `SELECT COUNT(*) FROM dispatches ${whereClause}`;
    const countResult = await db.query(countQuery, params);
    const total = parseInt(countResult.rows[0].count);

    const query = `
      SELECT 
        id,
        invoice_no as "invoiceNo",
        customer_name as "customerName",
        customer_address as "customerAddress",
        customer_city as "customerCity",
        customer_state as "customerState",
        customer_pincode as "customerPincode",
        dispatch_date as "dispatchDate",
        expected_delivery_date as "expectedDeliveryDate",
        actual_delivery_date as "actualDeliveryDate",
        transporter,
        transporter_id as "transporterId",
        lr_number as "lrNumber",
        eway_bill_no as "ewayBillNo",
        eway_bill_date as "ewayBillDate",
        boxes,
        weight,
        volume,
        package_type as "packageType",
        fragile,
        temperature_controlled as "temperatureControlled",
        insurance_value as "insuranceValue",
        insurance_company as "insuranceCompany",
        cod_amount as "codAmount",
        shipping_cost as "shippingCost",
        handling_charges as "handlingCharges",
        total_charges as "totalCharges",
        payment_mode as "paymentMode",
        status,
        delivery_attempts as "deliveryAttempts",
        delivery_person as "deliveryPerson",
        delivery_signature as "deliverySignature",
        delivery_remarks as "deliveryRemarks",
        vehicle_number as "vehicleNumber",
        driver_name as "driverName",
        driver_contact as "driverContact",
        route_details as "routeDetails",
        distance_covered as "distanceCovered",
        fuel_consumed as "fuelConsumed",
        tracking_updates as "trackingUpdates",
        created_at as "createdAt",
        updated_at as "updatedAt"
      FROM dispatches
      ${whereClause}
      ORDER BY ${sort} ${sortOrder}
      LIMIT $${params.length + 1} OFFSET $${params.length + 2}
    `;

    const result = await db.query(query, [...params, limit, offset]);

    res.json({
      success: true,
      data: result.rows,
      total,
      page: parseInt(page),
      pageSize: parseInt(limit),
      totalPages: Math.ceil(total / limit),
    });
  } catch (error) {
    console.error('Error fetching logistics:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/logistics/dropdown
 */
router.get('/dropdown', async (req, res) => {
  try {
    const transportersQuery = "SELECT DISTINCT transporter as label, transporter as value FROM dispatches WHERE transporter IS NOT NULL";
    const transportersResult = await db.query(transportersQuery);

    res.json({
      success: true,
      data: {
        transporters: transportersResult.rows,
        statuses: [
          { value: 'ALL', label: 'All Statuses' },
          { value: 'Packed', label: 'Packed' },
          { value: 'Shipped', label: 'Shipped' },
          { value: 'In Transit', label: 'In Transit' },
          { value: 'Out for Delivery', label: 'Out for Delivery' },
          { value: 'Delivered', label: 'Delivered' },
          { value: 'Returned', label: 'Returned' },
          { value: 'Cancelled', label: 'Cancelled' },
        ],
        packageTypes: [
          { value: 'Box', label: 'Box' },
          { value: 'Carton', label: 'Carton' },
          { value: 'Pallet', label: 'Pallet' },
          { value: 'Drum', label: 'Drum' },
        ],
        paymentModes: [
          { value: 'Prepaid', label: 'Prepaid' },
          { value: 'COD', label: 'Cash on Delivery' },
          { value: 'ToPay', label: 'To Pay' },
        ]
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/logistics/stats
 * Fetch aggregate statistics for dispatches
 */
router.get('/stats', async (req, res) => {
  try {
    const totalQuery = 'SELECT COUNT(*) as "totalDispatches", SUM(shipping_cost) as "totalRevenue" FROM dispatches';
    const deliveredQuery = "SELECT COUNT(*) as count FROM dispatches WHERE status = 'Delivered'";
    const pendingQuery = "SELECT COUNT(*) as count FROM dispatches WHERE status NOT IN ('Delivered', 'Cancelled', 'Returned')";
    
    const [totalRes, deliveredRes, pendingRes] = await Promise.all([
      db.query(totalQuery),
      db.query(deliveredQuery),
      db.query(pendingQuery)
    ]);
    
    res.json({
      success: true,
      data: {
        totalDispatches: parseInt(totalRes.rows[0].totalDispatches || 0),
        deliveredCount: parseInt(deliveredRes.rows[0].count || 0),
        pendingCount: parseInt(pendingRes.rows[0].count || 0),
        totalRevenue: parseFloat(totalRes.rows[0].totalRevenue || 0)
      }
    });
  } catch (error) {
    console.error('Error fetching logistics stats:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/logistics/:id
 */
router.get('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    const isUUID = (str) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str);
    if (!isUUID(id)) {
      return next();
    }
    const query = 'SELECT * FROM dispatches WHERE id = $1';
    const result = await db.query(query, [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Dispatch not found' });
    }

    res.json({ success: true, data: result.rows[0] });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/logistics
 */
router.post('/', async (req, res) => {
  try {
    const data = req.body;
    if (!(data.invoice_no || data.invoiceNo) || !(data.customer_name || data.customerName)) {
      return res.status(400).json({ success: false, error: 'Required fields missing: invoice_no and customer_name' });
    }
    const totalCharges = (Number(data.shipping_cost || data.shippingCost) || 0) + (Number(data.handling_charges || data.handlingCharges) || 0);

    const query = `
      INSERT INTO dispatches (
        invoice_no, customer_name, customer_address, customer_city, customer_state, customer_pincode,
        dispatch_date, expected_delivery_date, transporter, transporter_id, lr_number,
        eway_bill_no, eway_bill_date, boxes, weight, volume, package_type,
        fragile, temperature_controlled, insurance_value, insurance_company,
        cod_amount, shipping_cost, handling_charges, total_charges, payment_mode,
        status, vehicle_number, driver_name, driver_contact, route_details,
        created_by, last_updated_by
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, $26, $27, $28, $29, $30, $31, $32, $33)
      RETURNING id
    `;

    const result = await db.query(query, [
      data.invoice_no || data.invoiceNo,
      data.customer_name || data.customerName,
      data.customer_address || data.customerAddress,
      data.customer_city || data.customerCity,
      data.customer_state || data.customerState,
      data.customer_pincode || data.customerPincode,
      data.dispatch_date || data.dispatchDate || new Date(),
      data.expected_delivery_date || data.expectedDeliveryDate,
      data.transporter,
      data.transporter_id || data.transporterId,
      data.lr_number || data.lrNumber,
      data.eway_bill_no || data.ewayBillNo,
      data.eway_bill_date || data.ewayBillDate,
      data.boxes || 1,
      data.weight,
      data.volume,
      data.package_type || data.packageType || 'Box',
      data.fragile || false,
      data.temperature_controlled || data.temperatureControlled || false,
      data.insurance_value || data.insuranceValue || 0,
      data.insurance_company || data.insuranceCompany,
      data.cod_amount || data.codAmount || 0,
      data.shipping_cost || data.shippingCost || 0,
      data.handling_charges || data.handlingCharges || 0,
      totalCharges,
      data.payment_mode || data.paymentMode || 'Prepaid',
      data.status || 'Packed',
      data.vehicle_number || data.vehicleNumber,
      data.driver_name || data.driverName,
      data.driver_contact || data.driverContact,
      data.route_details || data.routeDetails,
      req.user.username, req.user.username
    ]);

    res.status(201).json({ success: true, data: result.rows[0], message: 'Dispatch created successfully' });
  } catch (error) {
    console.error('Error creating dispatch:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * PUT /api/logistics/:id
 */
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const data = req.body;
    
    // Simple implementation for update
    let updateFields = [];
    let params = [];
    
    const fields = [
      'status', 'actual_delivery_date', 'delivery_attempts', 'delivery_person', 
      'delivery_signature', 'delivery_remarks', 'tracking_updates', 
      'vehicle_number', 'driver_name', 'driver_contact', 'route_details'
    ];
    
    fields.forEach(field => {
      if (data[field] !== undefined) {
        params.push(data[field]);
        updateFields.push(`${field} = $${params.length}`);
      }
    });
    
    if (updateFields.length === 0) {
      return res.status(400).json({ success: false, error: 'No fields to update' });
    }
    
    params.push(req.user.username);
    updateFields.push(`last_updated_by = $${params.length}`);
    
    params.push(new Date());
    updateFields.push(`updated_at = $${params.length}`);
    
    params.push(id);
    const query = `UPDATE dispatches SET ${updateFields.join(', ')} WHERE id = $${params.length} RETURNING id`;
    
    const result = await db.query(query, params);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Dispatch not found' });
    }
    
    res.json({ success: true, data: result.rows[0], message: 'Dispatch updated successfully' });
  } catch (error) {
    console.error('Error updating dispatch:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * DELETE /api/logistics/:id
 */
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const query = 'DELETE FROM dispatches WHERE id = $1 RETURNING id';
    const result = await db.query(query, [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Dispatch not found' });
    }

    res.json({ success: true, message: 'Dispatch deleted successfully' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;

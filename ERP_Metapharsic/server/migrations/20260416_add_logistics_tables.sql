-- Migration: Add Logistics & Dispatch Tables

-- Dispatches Table
CREATE TABLE IF NOT EXISTS dispatches (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    invoice_no VARCHAR(50) NOT NULL,
    customer_name VARCHAR(255) NOT NULL,
    customer_address TEXT,
    customer_city VARCHAR(100),
    customer_state VARCHAR(100),
    customer_pincode VARCHAR(20),
    dispatch_date DATE DEFAULT CURRENT_DATE,
    expected_delivery_date DATE,
    actual_delivery_date DATE,
    transporter VARCHAR(255),
    transporter_id VARCHAR(50),
    lr_number VARCHAR(50),
    eway_bill_no VARCHAR(50),
    eway_bill_date DATE,
    boxes INTEGER DEFAULT 1,
    weight VARCHAR(50),
    volume VARCHAR(50),
    package_type VARCHAR(20) DEFAULT 'Box', -- Box, Carton, Pallet, Drum
    fragile BOOLEAN DEFAULT FALSE,
    temperature_controlled BOOLEAN DEFAULT FALSE,
    insurance_value NUMERIC(15, 2) DEFAULT 0,
    insurance_company VARCHAR(255),
    cod_amount NUMERIC(15, 2) DEFAULT 0,
    shipping_cost NUMERIC(15, 2) DEFAULT 0,
    handling_charges NUMERIC(15, 2) DEFAULT 0,
    total_charges NUMERIC(15, 2) DEFAULT 0,
    payment_mode VARCHAR(20) DEFAULT 'Prepaid', -- Prepaid, COD, ToPay
    status VARCHAR(50) DEFAULT 'Packed', -- Packed, Shipped, In Transit, Out for Delivery, Delivered, Returned, Cancelled
    delivery_attempts INTEGER DEFAULT 0,
    delivery_person VARCHAR(255),
    delivery_signature TEXT,
    delivery_remarks TEXT,
    vehicle_number VARCHAR(50),
    driver_name VARCHAR(255),
    driver_contact VARCHAR(20),
    route_details TEXT,
    distance_covered NUMERIC(10, 2), -- in km
    fuel_consumed NUMERIC(10, 2), -- in liters
    tracking_updates JSONB DEFAULT '[]'::jsonb,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_by VARCHAR(255),
    last_updated_by VARCHAR(255)
);

-- Indexes
CREATE INDEX idx_dispatches_invoice ON dispatches(invoice_no);
CREATE INDEX idx_dispatches_status ON dispatches(status);
CREATE INDEX idx_dispatches_date ON dispatches(dispatch_date);
CREATE INDEX idx_dispatches_lr ON dispatches(lr_number);
CREATE INDEX idx_dispatches_customer ON dispatches(customer_name);

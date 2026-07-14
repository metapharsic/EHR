-- Migration: Add Order Management System (OMS) Tables

-- Orders Table
CREATE TABLE IF NOT EXISTS orders (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    distributor_id UUID REFERENCES parties(id) ON DELETE CASCADE,
    distributor_name VARCHAR(255), -- Denormalized for fast display
    order_date DATE DEFAULT CURRENT_DATE,
    total_amount NUMERIC(15, 2) DEFAULT 0,
    status VARCHAR(50) DEFAULT 'Pending Approval', -- Pending Approval, Approved, Processing, Shipped, Delivered, Rejected
    priority VARCHAR(20) DEFAULT 'Normal', -- Normal, High, Urgent
    credit_status VARCHAR(50) DEFAULT 'Clear', -- Clear, Limit Exceeded, Overdue
    packing_specs TEXT,
    labeling_specs TEXT,
    remarks TEXT,
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Order Items Table
CREATE TABLE IF NOT EXISTS order_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    order_id UUID REFERENCES orders(id) ON DELETE CASCADE,
    product_id UUID REFERENCES products(id),
    product_name VARCHAR(255), -- Denormalized
    quantity INTEGER NOT NULL,
    approved_quantity INTEGER,
    rate NUMERIC(15, 2) NOT NULL,
    amount NUMERIC(15, 2) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes
CREATE INDEX idx_orders_distributor ON orders(distributor_id);
CREATE INDEX idx_orders_status ON orders(status);
CREATE INDEX idx_orders_date ON orders(order_date);
CREATE INDEX idx_order_items_order ON order_items(order_id);

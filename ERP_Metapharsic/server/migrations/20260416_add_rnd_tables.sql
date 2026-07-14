-- Migration: Add R&D Tables

-- R&D Formulations Table
CREATE TABLE IF NOT EXISTS rnd_formulations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    product_name VARCHAR(255) NOT NULL,
    dosage_form VARCHAR(50),
    version VARCHAR(20) DEFAULT '1.0',
    stage VARCHAR(50) DEFAULT 'Ideation', -- Ideation, Lab Scale, Pilot, Stability, Ready for Mfg
    start_date DATE DEFAULT CURRENT_DATE,
    ingredients JSONB DEFAULT '[]'::jsonb,
    target_cost NUMERIC(15, 4) DEFAULT 0,
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- R&D Experiments Table
CREATE TABLE IF NOT EXISTS rnd_experiments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    formulation_id UUID REFERENCES rnd_formulations(id) ON DELETE CASCADE,
    test_name VARCHAR(255) NOT NULL,
    start_date DATE DEFAULT CURRENT_DATE,
    end_date DATE,
    assigned_to VARCHAR(255),
    status VARCHAR(50) DEFAULT 'Scheduled', -- Scheduled, In Progress, Completed, Failed
    result_data TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes
CREATE INDEX idx_rnd_formulations_product ON rnd_formulations(product_name);
CREATE INDEX idx_rnd_formulations_stage ON rnd_formulations(stage);
CREATE INDEX idx_rnd_experiments_formulation ON rnd_experiments(formulation_id);
CREATE INDEX idx_rnd_experiments_status ON rnd_experiments(status);

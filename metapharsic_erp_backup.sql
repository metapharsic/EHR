--
-- PostgreSQL database dump
--

\restrict ZiUFcoa7Dw3ay4dCYKdnUHduBQ7a3wg5FvzP2fjvlOHBKiGanJEBSF8guLQthTN

-- Dumped from database version 16.14 (Ubuntu 16.14-0ubuntu0.24.04.1)
-- Dumped by pg_dump version 16.14 (Ubuntu 16.14-0ubuntu0.24.04.1)

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: accounts_staging; Type: SCHEMA; Schema: -; Owner: postgres
--

CREATE SCHEMA accounts_staging;


ALTER SCHEMA accounts_staging OWNER TO postgres;

--
-- Name: pg_trgm; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS pg_trgm WITH SCHEMA public;


--
-- Name: EXTENSION pg_trgm; Type: COMMENT; Schema: -; Owner: 
--

COMMENT ON EXTENSION pg_trgm IS 'text similarity measurement and index searching based on trigrams';


--
-- Name: uuid-ossp; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA public;


--
-- Name: EXTENSION "uuid-ossp"; Type: COMMENT; Schema: -; Owner: 
--

COMMENT ON EXTENSION "uuid-ossp" IS 'generate universally unique identifiers (UUIDs)';


--
-- Name: vector; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS vector WITH SCHEMA public;


--
-- Name: EXTENSION vector; Type: COMMENT; Schema: -; Owner: 
--

COMMENT ON EXTENSION vector IS 'vector data type and ivfflat and hnsw access methods';


--
-- Name: fn_check_period_open(date); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.fn_check_period_open(voucher_dt date) RETURNS text
    LANGUAGE plpgsql
    AS $$
DECLARE
  period_status TEXT;
BEGIN
  SELECT p.status INTO period_status
  FROM acc_periods p
  WHERE p.start_date <= voucher_dt AND p.end_date >= voucher_dt
  LIMIT 1;

  IF period_status IS NULL THEN
    RETURN 'NO_PERIOD';  -- No period configured — allow
  END IF;

  RETURN period_status;  -- OPEN, CLOSED, LOCKED
END;
$$;


ALTER FUNCTION public.fn_check_period_open(voucher_dt date) OWNER TO postgres;

--
-- Name: fn_create_periods_for_year(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.fn_create_periods_for_year() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
DECLARE
  m INTEGER;
  p_start DATE;
  p_end DATE;
  p_name TEXT;
BEGIN
  FOR m IN 1..12 LOOP
    p_start := (NEW.start_date + ((m-1) * INTERVAL '1 month'))::DATE;
    p_end   := (p_start + INTERVAL '1 month' - INTERVAL '1 day')::DATE;
    p_name  := TO_CHAR(p_start, 'Month YYYY');
    INSERT INTO acc_periods (financial_year_id, period_name, period_number, start_date, end_date)
    VALUES (NEW.id, p_name, m, p_start, p_end)
    ON CONFLICT (financial_year_id, period_number) DO NOTHING;
  END LOOP;
  RETURN NEW;
END;
$$;


ALTER FUNCTION public.fn_create_periods_for_year() OWNER TO postgres;

--
-- Name: fn_seed_checklist_for_period(uuid); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.fn_seed_checklist_for_period(p_period_id uuid) RETURNS void
    LANGUAGE plpgsql
    AS $$
BEGIN
  INSERT INTO acc_close_checklist (period_id, checklist_item, sort_order)
  VALUES
    (p_period_id, 'All bank accounts reconciled with statements', 1),
    (p_period_id, 'All pending journal vouchers posted or discarded', 2),
    (p_period_id, 'Monthly depreciation entry booked', 3),
    (p_period_id, 'TDS deducted and payable entry created', 4),
    (p_period_id, 'GST payable/receivable reconciled with GSTR-2B', 5),
    (p_period_id, 'Accruals and prepayments booked', 6),
    (p_period_id, 'Outstanding receivables reviewed and provisioned', 7),
    (p_period_id, 'Inter-company balances settled', 8),
    (p_period_id, 'Trial balance reviewed and signed off', 9),
    (p_period_id, 'MD / Finance Head final sign-off obtained', 10)
  ON CONFLICT DO NOTHING;
END;
$$;


ALTER FUNCTION public.fn_seed_checklist_for_period(p_period_id uuid) OWNER TO postgres;

--
-- Name: fn_update_account_balance(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.fn_update_account_balance() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  UPDATE chart_of_accounts
  SET current_balance = (
        SELECT COALESCE(c2.opening_balance, 0) + COALESCE(SUM(g2.debit - g2.credit), 0)
        FROM chart_of_accounts c2
        LEFT JOIN general_ledger g2 ON g2.account_id = c2.id
        WHERE c2.id = NEW.account_id
        GROUP BY c2.opening_balance
      ),
      updated_at = NOW()
  WHERE id = NEW.account_id;
  RETURN NEW;
END;
$$;


ALTER FUNCTION public.fn_update_account_balance() OWNER TO postgres;

--
-- Name: generate_reconciliation_number(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.generate_reconciliation_number() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    IF NEW.reconciliation_number IS NULL THEN
        NEW.reconciliation_number := 'SR-' || TO_CHAR(NEW.created_at, 'YYYYMM') || '-' || LPAD(CAST(NEXTVAL('reconciliation_seq') AS TEXT), 5, '0');
    END IF;
    RETURN NEW;
END;
$$;


ALTER FUNCTION public.generate_reconciliation_number() OWNER TO postgres;

--
-- Name: set_updated_at(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.set_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  NEW.updated_at := CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$;


ALTER FUNCTION public.set_updated_at() OWNER TO postgres;

--
-- Name: sync_company_doc_status(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.sync_company_doc_status() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  IF NEW.is_permanent THEN
    NEW.status := 'Active';
  ELSIF NEW.expiry_date IS NULL THEN
    NEW.status := COALESCE(NEW.status, 'Active');
  ELSIF NEW.expiry_date < CURRENT_DATE THEN
    NEW.status := 'Expired';
  ELSIF NEW.expiry_date <= CURRENT_DATE + INTERVAL '30 days' THEN
    NEW.status := 'Expiring Soon';
  ELSE
    NEW.status := 'Active';
  END IF;
  NEW.updated_at := CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$;


ALTER FUNCTION public.sync_company_doc_status() OWNER TO postgres;

--
-- Name: sync_dms_status(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.sync_dms_status() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  IF NEW.is_permanent THEN NEW.status := CASE WHEN NEW.status='Archived' THEN 'Archived' ELSE 'Active' END;
  ELSIF NEW.expiry_date IS NOT NULL AND NEW.expiry_date < CURRENT_DATE THEN NEW.status := 'Expired';
  ELSIF NEW.expiry_date IS NOT NULL AND NEW.expiry_date <= CURRENT_DATE + INTERVAL '30 days' THEN
    IF NEW.status NOT IN ('Draft','Archived','Under Review','Approved') THEN NEW.status := 'Active'; END IF;
  END IF;
  NEW.updated_at := NOW();
  RETURN NEW;
END; $$;


ALTER FUNCTION public.sync_dms_status() OWNER TO postgres;

--
-- Name: sync_license_expiry_status(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.sync_license_expiry_status() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  IF NEW.expiry_date IS NOT NULL THEN
    IF NEW.expiry_date < CURRENT_DATE THEN
      NEW.status := 'Expired';
    ELSIF NEW.expiry_date <= CURRENT_DATE + INTERVAL '30 days' THEN
      NEW.status := 'Expiring Soon';
    ELSIF NEW.status NOT IN ('Suspended') THEN
      NEW.status := 'Valid';
    END IF;
  END IF;
  NEW.updated_at := CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$;


ALTER FUNCTION public.sync_license_expiry_status() OWNER TO postgres;

--
-- Name: update_godowns_timestamp(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.update_godowns_timestamp() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$;


ALTER FUNCTION public.update_godowns_timestamp() OWNER TO postgres;

SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: stg_chart_of_accounts; Type: TABLE; Schema: accounts_staging; Owner: postgres
--

CREATE TABLE accounts_staging.stg_chart_of_accounts (
    staging_id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    batch_id uuid NOT NULL,
    import_status character varying(50) DEFAULT 'PENDING'::character varying,
    error_message text,
    raw_data jsonb,
    company_id character varying(50),
    account_code character varying(100),
    account_name character varying(255),
    account_type character varying(100),
    account_group character varying(100),
    opening_balance character varying(50),
    current_balance character varying(50),
    currency character varying(20),
    status character varying(50),
    gst_applicable character varying(20),
    tds_applicable character varying(20),
    is_bank_or_cash character varying(20),
    parent_account_code character varying(100),
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    processed_at timestamp without time zone
);


ALTER TABLE accounts_staging.stg_chart_of_accounts OWNER TO postgres;

--
-- Name: stg_parties; Type: TABLE; Schema: accounts_staging; Owner: postgres
--

CREATE TABLE accounts_staging.stg_parties (
    staging_id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    batch_id uuid NOT NULL,
    import_status character varying(50) DEFAULT 'PENDING'::character varying,
    error_message text,
    raw_data jsonb,
    company_id character varying(50),
    party_type character varying(100),
    name character varying(255),
    gstin character varying(50),
    pan character varying(50),
    email character varying(255),
    mobile character varying(50),
    address text,
    state_code character varying(20),
    account_code character varying(100),
    credit_limit character varying(50),
    credit_days character varying(50),
    opening_balance character varying(50),
    current_balance character varying(50),
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    processed_at timestamp without time zone
);


ALTER TABLE accounts_staging.stg_parties OWNER TO postgres;

--
-- Name: stg_voucher_entries; Type: TABLE; Schema: accounts_staging; Owner: postgres
--

CREATE TABLE accounts_staging.stg_voucher_entries (
    staging_id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    batch_id uuid NOT NULL,
    import_status character varying(50) DEFAULT 'PENDING'::character varying,
    error_message text,
    raw_data jsonb,
    voucher_no character varying(100),
    account_code character varying(100),
    party_gstin character varying(50),
    debit character varying(50),
    credit character varying(50),
    narration text,
    cost_center character varying(100),
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    processed_at timestamp without time zone
);


ALTER TABLE accounts_staging.stg_voucher_entries OWNER TO postgres;

--
-- Name: stg_vouchers; Type: TABLE; Schema: accounts_staging; Owner: postgres
--

CREATE TABLE accounts_staging.stg_vouchers (
    staging_id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    batch_id uuid NOT NULL,
    import_status character varying(50) DEFAULT 'PENDING'::character varying,
    error_message text,
    raw_data jsonb,
    company_id character varying(50),
    voucher_no character varying(100),
    voucher_date character varying(50),
    voucher_type character varying(100),
    narration text,
    total_debit character varying(50),
    total_credit character varying(50),
    status character varying(50),
    reference_number character varying(100),
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    processed_at timestamp without time zone
);


ALTER TABLE accounts_staging.stg_vouchers OWNER TO postgres;

--
-- Name: abc_analysis; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.abc_analysis (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    company_id uuid,
    analysis_period_start date NOT NULL,
    analysis_period_end date NOT NULL,
    analysis_run_date timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    analysis_method character varying(50) DEFAULT 'PAV'::character varying,
    abc_threshold_a numeric(5,2) DEFAULT 80,
    abc_threshold_b numeric(5,2) DEFAULT 95,
    total_products integer,
    total_inventory_value numeric(20,2),
    total_annual_turns numeric(15,2),
    class_a_count integer,
    class_a_value numeric(20,2),
    class_b_count integer,
    class_b_value numeric(20,2),
    class_c_count integer,
    class_c_value numeric(20,2),
    status character varying(50) DEFAULT 'COMPLETED'::character varying,
    created_by uuid,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.abc_analysis OWNER TO postgres;

--
-- Name: abc_classification; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.abc_classification (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    abc_analysis_id uuid NOT NULL,
    product_id uuid NOT NULL,
    class character varying(1) NOT NULL,
    classification_date date DEFAULT CURRENT_DATE,
    annual_consumption integer,
    annual_consumption_value numeric(20,2),
    avg_unit_cost numeric(18,6),
    consumption_percentage numeric(8,4),
    cumulative_percentage numeric(8,4),
    reorder_point integer,
    reorder_quantity integer,
    safety_stock integer,
    review_frequency character varying(50),
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.abc_classification OWNER TO postgres;

--
-- Name: acc_anomalies; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.acc_anomalies (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    anomaly_type character varying(50) NOT NULL,
    severity character varying(20) DEFAULT 'MEDIUM'::character varying,
    voucher_id uuid,
    gl_id uuid,
    user_id uuid,
    description text,
    amount numeric(15,2),
    confidence_score numeric(5,2) DEFAULT 0,
    status character varying(30) DEFAULT 'OPEN'::character varying,
    reviewed_by uuid,
    reviewed_at timestamp without time zone,
    review_notes text,
    detected_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT acc_anomalies_anomaly_type_check CHECK (((anomaly_type)::text = ANY ((ARRAY['ROUND_NUMBER'::character varying, 'AFTER_HOURS'::character varying, 'REVERSED_ACCOUNTS'::character varying, 'VELOCITY_SPIKE'::character varying, 'DUPLICATE'::character varying, 'SOD_VIOLATION'::character varying])::text[]))),
    CONSTRAINT acc_anomalies_severity_check CHECK (((severity)::text = ANY ((ARRAY['LOW'::character varying, 'MEDIUM'::character varying, 'HIGH'::character varying, 'CRITICAL'::character varying])::text[]))),
    CONSTRAINT acc_anomalies_status_check CHECK (((status)::text = ANY ((ARRAY['OPEN'::character varying, 'REVIEWED'::character varying, 'DISMISSED'::character varying, 'ESCALATED'::character varying])::text[])))
);


ALTER TABLE public.acc_anomalies OWNER TO postgres;

--
-- Name: acc_bank_statement_lines; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.acc_bank_statement_lines (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    statement_id uuid NOT NULL,
    transaction_date date NOT NULL,
    value_date date,
    description text,
    reference_no character varying(100),
    debit numeric(15,2) DEFAULT 0,
    credit numeric(15,2) DEFAULT 0,
    balance numeric(15,2),
    match_status character varying(30) DEFAULT 'UNMATCHED'::character varying,
    match_confidence numeric(5,2) DEFAULT 0,
    matched_gl_id uuid,
    matched_voucher_id uuid,
    matched_by uuid,
    matched_at timestamp without time zone,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT acc_bank_statement_lines_match_status_check CHECK (((match_status)::text = ANY ((ARRAY['UNMATCHED'::character varying, 'AUTO_MATCHED'::character varying, 'MANUAL_MATCHED'::character varying, 'IGNORED'::character varying])::text[])))
);


ALTER TABLE public.acc_bank_statement_lines OWNER TO postgres;

--
-- Name: acc_bank_statements; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.acc_bank_statements (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    account_id uuid NOT NULL,
    bank_name character varying(100),
    account_number character varying(50),
    statement_date date NOT NULL,
    opening_balance numeric(15,2) DEFAULT 0,
    closing_balance numeric(15,2) DEFAULT 0,
    total_credits numeric(15,2) DEFAULT 0,
    total_debits numeric(15,2) DEFAULT 0,
    import_source character varying(30) DEFAULT 'CSV'::character varying,
    file_url text,
    imported_by uuid,
    imported_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    status character varying(30) DEFAULT 'IMPORTED'::character varying,
    CONSTRAINT acc_bank_statements_import_source_check CHECK (((import_source)::text = ANY ((ARRAY['CSV'::character varying, 'PDF'::character varying, 'MANUAL'::character varying])::text[]))),
    CONSTRAINT acc_bank_statements_status_check CHECK (((status)::text = ANY ((ARRAY['IMPORTED'::character varying, 'RECONCILING'::character varying, 'RECONCILED'::character varying])::text[])))
);


ALTER TABLE public.acc_bank_statements OWNER TO postgres;

--
-- Name: acc_cash_flow_forecast; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.acc_cash_flow_forecast (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    forecast_date date NOT NULL,
    week_number integer NOT NULL,
    forecast_type character varying(30) DEFAULT 'COMPUTED'::character varying,
    description text,
    expected_inflow numeric(15,2) DEFAULT 0,
    expected_outflow numeric(15,2) DEFAULT 0,
    net_cash_flow numeric(15,2) DEFAULT 0,
    opening_balance numeric(15,2) DEFAULT 0,
    closing_balance numeric(15,2) DEFAULT 0,
    actual_inflow numeric(15,2),
    actual_outflow numeric(15,2),
    variance numeric(15,2),
    generated_by uuid,
    generated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT acc_cash_flow_forecast_week_number_check CHECK (((week_number >= 1) AND (week_number <= 13)))
);


ALTER TABLE public.acc_cash_flow_forecast OWNER TO postgres;

--
-- Name: acc_close_checklist; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.acc_close_checklist (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    period_id uuid NOT NULL,
    checklist_item character varying(255) NOT NULL,
    sort_order integer DEFAULT 0,
    is_completed boolean DEFAULT false,
    completed_by uuid,
    completed_at timestamp without time zone,
    notes text,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.acc_close_checklist OWNER TO postgres;

--
-- Name: acc_dunning_log; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.acc_dunning_log (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    party_id uuid,
    party_name character varying(255),
    rule_id uuid,
    invoice_ref character varying(100),
    outstanding_amount numeric(15,2),
    days_overdue integer,
    action_taken character varying(50),
    message_sent text,
    sent_to character varying(255),
    status character varying(30) DEFAULT 'SENT'::character varying,
    response_notes text,
    executed_by uuid,
    executed_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT acc_dunning_log_status_check CHECK (((status)::text = ANY ((ARRAY['SENT'::character varying, 'DELIVERED'::character varying, 'FAILED'::character varying, 'RESPONDED'::character varying])::text[])))
);


ALTER TABLE public.acc_dunning_log OWNER TO postgres;

--
-- Name: acc_dunning_rules; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.acc_dunning_rules (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    rule_name character varying(100) NOT NULL,
    days_overdue_from integer NOT NULL,
    days_overdue_to integer,
    action_type character varying(50) NOT NULL,
    message_template text,
    escalate_to_role character varying(50),
    is_active boolean DEFAULT true,
    created_by uuid,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT acc_dunning_rules_action_type_check CHECK (((action_type)::text = ANY ((ARRAY['EMAIL'::character varying, 'SMS'::character varying, 'WHATSAPP'::character varying, 'HOLD_ORDERS'::character varying, 'LEGAL_NOTICE'::character varying])::text[])))
);


ALTER TABLE public.acc_dunning_rules OWNER TO postgres;

--
-- Name: acc_fx_revaluation_log; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.acc_fx_revaluation_log (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    revaluation_date date NOT NULL,
    account_id uuid NOT NULL,
    currency_code character varying(10) NOT NULL,
    original_balance numeric(15,2) DEFAULT 0,
    fx_rate_used numeric(15,6) DEFAULT 1,
    revalued_balance_inr numeric(15,2) DEFAULT 0,
    gain_loss numeric(15,2) DEFAULT 0,
    voucher_id uuid,
    created_by uuid,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.acc_fx_revaluation_log OWNER TO postgres;

--
-- Name: acc_payment_run_items; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.acc_payment_run_items (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    run_id uuid NOT NULL,
    vendor_id uuid,
    vendor_name character varying(255),
    invoice_ref character varying(100),
    invoice_date date,
    invoice_amount numeric(15,2) DEFAULT 0,
    tds_rate numeric(5,2) DEFAULT 0,
    tds_amount numeric(15,2) DEFAULT 0,
    net_payment numeric(15,2) DEFAULT 0,
    bank_account_no character varying(50),
    ifsc_code character varying(20),
    beneficiary_name character varying(255),
    payment_ref character varying(100),
    status character varying(30) DEFAULT 'PENDING'::character varying,
    voucher_id uuid,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT acc_payment_run_items_status_check CHECK (((status)::text = ANY ((ARRAY['PENDING'::character varying, 'PAID'::character varying, 'FAILED'::character varying])::text[])))
);


ALTER TABLE public.acc_payment_run_items OWNER TO postgres;

--
-- Name: acc_payment_runs; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.acc_payment_runs (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    run_name character varying(100) NOT NULL,
    payment_date date NOT NULL,
    payment_mode character varying(30) NOT NULL,
    bank_account_id uuid,
    total_amount numeric(15,2) DEFAULT 0,
    total_invoices integer DEFAULT 0,
    tds_deducted numeric(15,2) DEFAULT 0,
    net_payable numeric(15,2) DEFAULT 0,
    status character varying(30) DEFAULT 'DRAFT'::character varying,
    file_generated boolean DEFAULT false,
    file_url text,
    approved_by uuid,
    approved_at timestamp without time zone,
    processed_by uuid,
    processed_at timestamp without time zone,
    created_by uuid,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT acc_payment_runs_payment_mode_check CHECK (((payment_mode)::text = ANY ((ARRAY['NEFT'::character varying, 'RTGS'::character varying, 'IMPS'::character varying, 'CHEQUE'::character varying, 'CASH'::character varying])::text[]))),
    CONSTRAINT acc_payment_runs_status_check CHECK (((status)::text = ANY ((ARRAY['DRAFT'::character varying, 'APPROVED'::character varying, 'PROCESSED'::character varying, 'FAILED'::character varying])::text[])))
);


ALTER TABLE public.acc_payment_runs OWNER TO postgres;

--
-- Name: acc_periods; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.acc_periods (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    financial_year_id uuid NOT NULL,
    period_name character varying(50) NOT NULL,
    period_number integer NOT NULL,
    start_date date NOT NULL,
    end_date date NOT NULL,
    status character varying(20) DEFAULT 'OPEN'::character varying,
    closed_by uuid,
    closed_at timestamp without time zone,
    locked_by uuid,
    locked_at timestamp without time zone,
    checklist_completed boolean DEFAULT false,
    notes text,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT acc_periods_period_number_check CHECK (((period_number >= 1) AND (period_number <= 12))),
    CONSTRAINT acc_periods_status_check CHECK (((status)::text = ANY ((ARRAY['OPEN'::character varying, 'CLOSED'::character varying, 'LOCKED'::character varying])::text[])))
);


ALTER TABLE public.acc_periods OWNER TO postgres;

--
-- Name: acc_ratios_cache; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.acc_ratios_cache (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    as_of_date date NOT NULL,
    current_ratio numeric(10,4) DEFAULT 0,
    quick_ratio numeric(10,4) DEFAULT 0,
    debt_equity_ratio numeric(10,4) DEFAULT 0,
    gross_profit_margin numeric(10,4) DEFAULT 0,
    net_profit_margin numeric(10,4) DEFAULT 0,
    return_on_equity numeric(10,4) DEFAULT 0,
    return_on_capital_employed numeric(10,4) DEFAULT 0,
    debtor_days numeric(10,2) DEFAULT 0,
    creditor_days numeric(10,2) DEFAULT 0,
    inventory_turnover numeric(10,4) DEFAULT 0,
    interest_coverage_ratio numeric(10,4) DEFAULT 0,
    working_capital numeric(15,2) DEFAULT 0,
    computed_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.acc_ratios_cache OWNER TO postgres;

--
-- Name: acc_tally_sync_log; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.acc_tally_sync_log (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    sync_direction character varying(10) NOT NULL,
    sync_type character varying(50),
    file_name character varying(255),
    file_url text,
    total_records integer DEFAULT 0,
    success_count integer DEFAULT 0,
    error_count integer DEFAULT 0,
    errors jsonb,
    status character varying(30) DEFAULT 'PENDING'::character varying,
    started_at timestamp without time zone,
    completed_at timestamp without time zone,
    created_by uuid,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT acc_tally_sync_log_status_check CHECK (((status)::text = ANY ((ARRAY['PENDING'::character varying, 'PROCESSING'::character varying, 'COMPLETED'::character varying, 'FAILED'::character varying])::text[]))),
    CONSTRAINT acc_tally_sync_log_sync_direction_check CHECK (((sync_direction)::text = ANY ((ARRAY['IMPORT'::character varying, 'EXPORT'::character varying])::text[])))
);


ALTER TABLE public.acc_tally_sync_log OWNER TO postgres;

--
-- Name: api_keys; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.api_keys (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    user_id uuid NOT NULL,
    name character varying(100) NOT NULL,
    key_hash character varying(255) NOT NULL,
    permissions text[],
    rate_limit integer,
    active boolean DEFAULT true,
    last_used timestamp without time zone,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    expires_at timestamp without time zone
);


ALTER TABLE public.api_keys OWNER TO postgres;

--
-- Name: approval_workflows; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.approval_workflows (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    document_type character varying(20) NOT NULL,
    document_id uuid NOT NULL,
    current_level integer DEFAULT 1,
    total_levels integer DEFAULT 2,
    status character varying(20) DEFAULT 'Pending'::character varying,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.approval_workflows OWNER TO postgres;

--
-- Name: asset_alerts; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.asset_alerts (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    asset_id uuid,
    type character varying(50) NOT NULL,
    priority character varying(20) DEFAULT 'Medium'::character varying,
    message text NOT NULL,
    due_date date,
    status character varying(20) DEFAULT 'Active'::character varying,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.asset_alerts OWNER TO postgres;

--
-- Name: asset_categories; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.asset_categories (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    name character varying(100) NOT NULL,
    description text,
    icon character varying(50),
    useful_life_years integer,
    depreciation_rate numeric(5,2),
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.asset_categories OWNER TO postgres;

--
-- Name: asset_insurance_policies; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.asset_insurance_policies (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    asset_id uuid,
    policy_number character varying(100) NOT NULL,
    insurance_company character varying(255) NOT NULL,
    coverage_amount numeric(15,2) NOT NULL,
    premium_amount numeric(15,2) NOT NULL,
    issue_date date NOT NULL,
    expiry_date date NOT NULL,
    status character varying(50) DEFAULT 'Active'::character varying,
    documents_url text,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.asset_insurance_policies OWNER TO postgres;

--
-- Name: asset_maintenance_logs; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.asset_maintenance_logs (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    asset_id uuid,
    maintenance_date date NOT NULL,
    type character varying(50) NOT NULL,
    description text,
    cost numeric(15,2) DEFAULT 0,
    performed_by character varying(255),
    vendor_id uuid,
    status character varying(50) DEFAULT 'Completed'::character varying,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.asset_maintenance_logs OWNER TO postgres;

--
-- Name: asset_transfers; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.asset_transfers (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    asset_id uuid,
    from_location character varying(255),
    to_location character varying(255) NOT NULL,
    transfer_date date NOT NULL,
    reason text,
    approved_by uuid,
    status character varying(50) DEFAULT 'Completed'::character varying,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.asset_transfers OWNER TO postgres;

--
-- Name: audit_log_accounting; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.audit_log_accounting (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    company_id integer DEFAULT 1,
    table_name character varying(100),
    record_id uuid,
    action character varying(50),
    old_value text,
    new_value text,
    user_id uuid,
    ip_address character varying(50),
    "timestamp" timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.audit_log_accounting OWNER TO postgres;

--
-- Name: audit_logs; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.audit_logs (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    user_id uuid,
    action character varying(100) NOT NULL,
    module character varying(50),
    table_name character varying(50),
    record_id character varying(255),
    changes jsonb,
    status character varying(20),
    error_message text,
    ip_address character varying(45),
    user_agent character varying(255),
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.audit_logs OWNER TO postgres;

--
-- Name: bank_reconciliation; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.bank_reconciliation (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    company_id integer DEFAULT 1,
    bank_account_id uuid,
    bank_statement_date date,
    bank_balance numeric(15,2),
    gl_balance numeric(15,2),
    variance numeric(15,2),
    status character varying(50) DEFAULT 'Pending'::character varying,
    created_by uuid,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.bank_reconciliation OWNER TO postgres;

--
-- Name: bank_reconciliations; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.bank_reconciliations (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    company_id integer DEFAULT 1,
    account_id uuid NOT NULL,
    statement_date date NOT NULL,
    closing_balance_per_bank numeric(15,2) NOT NULL,
    closing_balance_per_books numeric(15,2) NOT NULL,
    unreconciled_difference numeric(15,2) NOT NULL,
    reconciliation_status character varying(50) DEFAULT 'Pending'::character varying,
    created_by uuid,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.bank_reconciliations OWNER TO postgres;

--
-- Name: batch_valuation_history; Type: TABLE; Schema: public; Owner: erp_user
--

CREATE TABLE public.batch_valuation_history (
    id bigint NOT NULL,
    batch_id uuid NOT NULL,
    valuation_date date NOT NULL,
    valuation_method character varying(20) NOT NULL,
    previous_cost numeric(18,6),
    current_cost numeric(18,6),
    cost_change numeric(18,6),
    cost_change_reason character varying(200),
    quantity_on_hand numeric(15,4),
    inventory_value numeric(20,2),
    changed_by uuid,
    reason_code character varying(50),
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.batch_valuation_history OWNER TO erp_user;

--
-- Name: batch_valuation_history_id_seq; Type: SEQUENCE; Schema: public; Owner: erp_user
--

CREATE SEQUENCE public.batch_valuation_history_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.batch_valuation_history_id_seq OWNER TO erp_user;

--
-- Name: batch_valuation_history_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: erp_user
--

ALTER SEQUENCE public.batch_valuation_history_id_seq OWNED BY public.batch_valuation_history.id;


--
-- Name: batches; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.batches (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    product_id uuid,
    batch_number character varying(50) NOT NULL,
    expiry_date date NOT NULL,
    manufacturing_date date,
    stock integer DEFAULT 0,
    mrp numeric(10,2) NOT NULL,
    purchase_rate numeric(10,2) NOT NULL,
    selling_rate numeric(10,2) NOT NULL,
    location character varying(50),
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    godown_id uuid,
    status character varying(50) DEFAULT 'In Stock'::character varying,
    reserved_qty integer DEFAULT 0,
    damaged_qty integer DEFAULT 0,
    ptr_rate numeric(10,2),
    margin_percent numeric(5,2) GENERATED ALWAYS AS (
CASE
    WHEN (ptr_rate > (0)::numeric) THEN round((((mrp - ptr_rate) / ptr_rate) * (100)::numeric), 2)
    ELSE (0)::numeric
END) STORED,
    landed_cost numeric(10,2),
    shelf_location character varying(100),
    available_qty integer GENERATED ALWAYS AS (((stock - COALESCE(reserved_qty, 0)) - COALESCE(damaged_qty, 0))) STORED,
    cumulative_valuation_cost numeric(18,6),
    compliance_status character varying(50) DEFAULT 'COMPLIANT'::character varying,
    compliance_remarks text
);


ALTER TABLE public.batches OWNER TO postgres;

--
-- Name: boms; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.boms (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    product_id uuid,
    version character varying(20) DEFAULT '1.0'::character varying,
    status character varying(20) DEFAULT 'Active'::character varying,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.boms OWNER TO postgres;

--
-- Name: branches; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.branches (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    name character varying(255) NOT NULL,
    type character varying(50) DEFAULT 'Warehouse'::character varying,
    location text,
    city character varying(100),
    state character varying(100),
    manager character varying(100),
    contact character varying(20),
    is_hq boolean DEFAULT false,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.branches OWNER TO postgres;

--
-- Name: budgets; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.budgets (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    company_id integer DEFAULT 1,
    cost_center_id uuid,
    account_id uuid,
    budget_amount numeric(15,2),
    period_from date,
    period_to date,
    actual_amount numeric(15,2) DEFAULT 0,
    variance numeric(15,2),
    created_by uuid,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.budgets OWNER TO postgres;

--
-- Name: chart_of_accounts; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.chart_of_accounts (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    company_id integer DEFAULT 1,
    account_code character varying(50) NOT NULL,
    account_name character varying(255) NOT NULL,
    account_type character varying(50) NOT NULL,
    account_group character varying(100),
    opening_balance numeric(15,2) DEFAULT 0,
    current_balance numeric(15,2) DEFAULT 0,
    description text,
    status character varying(50) DEFAULT 'Active'::character varying,
    gst_applicable boolean DEFAULT false,
    tds_applicable boolean DEFAULT false,
    is_bank_or_cash boolean DEFAULT false,
    account_format character varying(20) DEFAULT 'debit'::character varying,
    reconciliation_status character varying(50) DEFAULT 'Pending'::character varying,
    cost_center_id uuid,
    parent_account_id uuid,
    created_by uuid,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    alias character varying(255),
    inventory_affected boolean DEFAULT false,
    ledger_type character varying(50),
    activate_interest boolean DEFAULT false,
    mailing_name character varying(255),
    mailing_address text,
    mailing_country character varying(100) DEFAULT 'India'::character varying,
    mailing_state character varying(100),
    provide_bank_details boolean DEFAULT false,
    pan_it_no character varying(20),
    currency_code character varying(10) DEFAULT 'INR'::character varying,
    foreign_balance numeric(15,2) DEFAULT 0,
    gstin character varying(20)
);


ALTER TABLE public.chart_of_accounts OWNER TO postgres;

--
-- Name: company_document_history; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.company_document_history (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    document_id uuid NOT NULL,
    version_number integer NOT NULL,
    document_number character varying(150),
    issue_date date,
    expiry_date date,
    document_url text,
    renewed_by character varying(255),
    notes text,
    archived_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE public.company_document_history OWNER TO postgres;

--
-- Name: company_documents; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.company_documents (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    document_name character varying(255) NOT NULL,
    document_type character varying(100) DEFAULT 'Registration'::character varying NOT NULL,
    document_number character varying(150),
    issuing_authority character varying(255),
    issue_date date,
    expiry_date date,
    is_permanent boolean DEFAULT false NOT NULL,
    status character varying(50) DEFAULT 'Active'::character varying NOT NULL,
    document_url text,
    version_number integer DEFAULT 1 NOT NULL,
    notes text,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    license_number character varying(100),
    start_date date,
    file_name character varying(500),
    notified_at timestamp without time zone,
    CONSTRAINT chk_doc_status CHECK (((status)::text = ANY ((ARRAY['Active'::character varying, 'Expiring Soon'::character varying, 'Expired'::character varying, 'Renewal Pending'::character varying, 'Inactive'::character varying])::text[])))
);


ALTER TABLE public.company_documents OWNER TO postgres;

--
-- Name: compliance_audits; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.compliance_audits (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    audit_date date DEFAULT CURRENT_DATE NOT NULL,
    auditor_name character varying(255),
    score_percentage numeric(5,2),
    status character varying(50) DEFAULT 'Draft'::character varying,
    notes text,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.compliance_audits OWNER TO postgres;

--
-- Name: compliance_checklist_items; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.compliance_checklist_items (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    audit_id uuid,
    requirement_text text NOT NULL,
    is_compliant boolean DEFAULT false,
    observation text,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.compliance_checklist_items OWNER TO postgres;

--
-- Name: compliance_checklist_templates; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.compliance_checklist_templates (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    task_text text NOT NULL,
    category character varying(100),
    is_active boolean DEFAULT true
);


ALTER TABLE public.compliance_checklist_templates OWNER TO postgres;

--
-- Name: compliance_checklists; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.compliance_checklists (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    checklist_date date DEFAULT CURRENT_DATE,
    items jsonb DEFAULT '[]'::jsonb NOT NULL,
    score_percentage numeric(5,2),
    performed_by character varying(255),
    status character varying(50) DEFAULT 'Completed'::character varying,
    remarks text,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.compliance_checklists OWNER TO postgres;

--
-- Name: compliance_notification_log; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.compliance_notification_log (
    id integer NOT NULL,
    license_id uuid,
    channel character varying(20) NOT NULL,
    message text,
    status character varying(20) DEFAULT 'sent'::character varying,
    sent_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.compliance_notification_log OWNER TO postgres;

--
-- Name: compliance_notification_log_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.compliance_notification_log_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.compliance_notification_log_id_seq OWNER TO postgres;

--
-- Name: compliance_notification_log_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.compliance_notification_log_id_seq OWNED BY public.compliance_notification_log.id;


--
-- Name: compliance_notification_settings; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.compliance_notification_settings (
    id integer NOT NULL,
    email_enabled boolean DEFAULT true,
    email_address character varying(255),
    whatsapp_enabled boolean DEFAULT false,
    whatsapp_number character varying(50),
    whatsapp_apikey character varying(100),
    alert_days_30 boolean DEFAULT true,
    alert_days_15 boolean DEFAULT true,
    alert_days_7 boolean DEFAULT true,
    alert_days_1 boolean DEFAULT true,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.compliance_notification_settings OWNER TO postgres;

--
-- Name: compliance_notification_settings_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.compliance_notification_settings_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.compliance_notification_settings_id_seq OWNER TO postgres;

--
-- Name: compliance_notification_settings_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.compliance_notification_settings_id_seq OWNED BY public.compliance_notification_settings.id;


--
-- Name: cost_centers; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.cost_centers (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    company_id integer DEFAULT 1,
    name character varying(255) NOT NULL,
    type character varying(50),
    manager_id uuid,
    created_by uuid,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.cost_centers OWNER TO postgres;

--
-- Name: crm_accounts; Type: TABLE; Schema: public; Owner: erp_user
--

CREATE TABLE public.crm_accounts (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    name character varying(255) NOT NULL,
    account_type character varying(50) DEFAULT 'PROSPECT'::character varying,
    industry character varying(100),
    territory character varying(100),
    state character varying(50),
    district character varying(100),
    city character varying(100),
    pincode character varying(10),
    address text,
    phone character varying(20),
    email character varying(150),
    website character varying(255),
    annual_revenue numeric(15,2),
    bed_count integer,
    status character varying(50) DEFAULT 'PROSPECT'::character varying,
    pcd_partner_id uuid,
    assigned_owner_id uuid,
    parent_account_id uuid,
    tags text[] DEFAULT '{}'::text[],
    custom_fields jsonb DEFAULT '{}'::jsonb,
    deleted_at timestamp without time zone,
    created_by uuid,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now()
);


ALTER TABLE public.crm_accounts OWNER TO erp_user;

--
-- Name: crm_activities; Type: TABLE; Schema: public; Owner: erp_user
--

CREATE TABLE public.crm_activities (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    activity_type character varying(50) NOT NULL,
    subject character varying(255),
    description text,
    account_id uuid,
    contact_id uuid,
    opportunity_id uuid,
    performed_by uuid,
    scheduled_at timestamp without time zone,
    completed_at timestamp without time zone,
    outcome character varying(100),
    duration_minutes integer,
    location_lat numeric(10,7),
    location_lng numeric(10,7),
    attachments jsonb DEFAULT '[]'::jsonb,
    created_by uuid,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now()
);


ALTER TABLE public.crm_activities OWNER TO erp_user;

--
-- Name: crm_audit_log; Type: TABLE; Schema: public; Owner: erp_user
--

CREATE TABLE public.crm_audit_log (
    id bigint NOT NULL,
    occurred_at timestamp without time zone DEFAULT now() NOT NULL,
    actor_id uuid,
    actor_email character varying(150),
    action character varying(30),
    entity_type character varying(50),
    entity_id uuid,
    before_state jsonb,
    after_state jsonb,
    ip_address text
);


ALTER TABLE public.crm_audit_log OWNER TO erp_user;

--
-- Name: crm_audit_log_id_seq; Type: SEQUENCE; Schema: public; Owner: erp_user
--

CREATE SEQUENCE public.crm_audit_log_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.crm_audit_log_id_seq OWNER TO erp_user;

--
-- Name: crm_audit_log_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: erp_user
--

ALTER SEQUENCE public.crm_audit_log_id_seq OWNED BY public.crm_audit_log.id;


--
-- Name: crm_badges; Type: TABLE; Schema: public; Owner: erp_user
--

CREATE TABLE public.crm_badges (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    user_id uuid NOT NULL,
    badge_key character varying(100) NOT NULL,
    badge_name character varying(100),
    earned_at timestamp without time zone DEFAULT now()
);


ALTER TABLE public.crm_badges OWNER TO erp_user;

--
-- Name: crm_campaign_recipients; Type: TABLE; Schema: public; Owner: erp_user
--

CREATE TABLE public.crm_campaign_recipients (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    campaign_id uuid NOT NULL,
    contact_id uuid,
    phone character varying(20),
    email character varying(150),
    variant character(1) DEFAULT 'A'::bpchar,
    status character varying(30) DEFAULT 'PENDING'::character varying,
    sent_at timestamp without time zone,
    delivered_at timestamp without time zone,
    opened_at timestamp without time zone,
    clicked_at timestamp without time zone,
    replied_at timestamp without time zone,
    unsubscribed_at timestamp without time zone
);


ALTER TABLE public.crm_campaign_recipients OWNER TO erp_user;

--
-- Name: crm_campaigns; Type: TABLE; Schema: public; Owner: erp_user
--

CREATE TABLE public.crm_campaigns (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    name character varying(255) NOT NULL,
    campaign_type character varying(50) DEFAULT 'BROADCAST'::character varying,
    channel character varying(50) DEFAULT 'WHATSAPP'::character varying,
    status character varying(50) DEFAULT 'DRAFT'::character varying,
    segment_id uuid,
    template_id uuid,
    scheduled_at timestamp without time zone,
    sent_at timestamp without time zone,
    total_recipients integer DEFAULT 0,
    sent_count integer DEFAULT 0,
    delivered_count integer DEFAULT 0,
    opened_count integer DEFAULT 0,
    replied_count integer DEFAULT 0,
    ab_enabled boolean DEFAULT false,
    ab_split_pct integer DEFAULT 50,
    ab_winner_metric character varying(50),
    created_by uuid,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now()
);


ALTER TABLE public.crm_campaigns OWNER TO erp_user;

--
-- Name: crm_comments; Type: TABLE; Schema: public; Owner: erp_user
--

CREATE TABLE public.crm_comments (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    entity_type character varying(50),
    entity_id uuid,
    parent_comment_id uuid,
    content text NOT NULL,
    created_by uuid,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now()
);


ALTER TABLE public.crm_comments OWNER TO erp_user;

--
-- Name: crm_consents; Type: TABLE; Schema: public; Owner: erp_user
--

CREATE TABLE public.crm_consents (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    contact_id uuid NOT NULL,
    channel character varying(20) NOT NULL,
    purpose character varying(50) NOT NULL,
    status character varying(20) DEFAULT 'PENDING'::character varying,
    granted_at timestamp without time zone,
    withdrawn_at timestamp without time zone,
    source character varying(100),
    legal_basis character varying(50)
);


ALTER TABLE public.crm_consents OWNER TO erp_user;

--
-- Name: crm_contacts; Type: TABLE; Schema: public; Owner: erp_user
--

CREATE TABLE public.crm_contacts (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    account_id uuid,
    first_name character varying(100) NOT NULL,
    last_name character varying(100),
    designation character varying(100),
    department character varying(100),
    email character varying(150),
    phone character varying(20),
    whatsapp character varying(20),
    address text,
    preferred_channel character varying(20) DEFAULT 'WHATSAPP'::character varying,
    do_not_contact boolean DEFAULT false,
    is_decision_maker boolean DEFAULT false,
    birthday date,
    anniversary date,
    custom_fields jsonb DEFAULT '{}'::jsonb,
    deleted_at timestamp without time zone,
    created_by uuid,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now()
);


ALTER TABLE public.crm_contacts OWNER TO erp_user;

--
-- Name: crm_copilot_threads; Type: TABLE; Schema: public; Owner: erp_user
--

CREATE TABLE public.crm_copilot_threads (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    user_id uuid NOT NULL,
    messages jsonb DEFAULT '[]'::jsonb,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now()
);


ALTER TABLE public.crm_copilot_threads OWNER TO erp_user;

--
-- Name: crm_custom_fields; Type: TABLE; Schema: public; Owner: erp_user
--

CREATE TABLE public.crm_custom_fields (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    object_type character varying(50) NOT NULL,
    api_name character varying(50) NOT NULL,
    display_name character varying(100) NOT NULL,
    field_type character varying(30) NOT NULL,
    options jsonb DEFAULT '{}'::jsonb,
    required boolean DEFAULT false,
    sort_order integer DEFAULT 0,
    created_at timestamp without time zone DEFAULT now()
);


ALTER TABLE public.crm_custom_fields OWNER TO erp_user;

--
-- Name: crm_custom_objects; Type: TABLE; Schema: public; Owner: erp_user
--

CREATE TABLE public.crm_custom_objects (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    api_name character varying(50) NOT NULL,
    display_name character varying(100) NOT NULL,
    description text,
    enabled boolean DEFAULT true,
    created_at timestamp without time zone DEFAULT now()
);


ALTER TABLE public.crm_custom_objects OWNER TO erp_user;

--
-- Name: crm_embeddings; Type: TABLE; Schema: public; Owner: erp_user
--

CREATE TABLE public.crm_embeddings (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    entity_type character varying(50),
    entity_id uuid,
    content_text text,
    embedding public.vector(1536),
    model character varying(50) DEFAULT 'text-embedding-3-small'::character varying,
    created_at timestamp without time zone DEFAULT now()
);


ALTER TABLE public.crm_embeddings OWNER TO erp_user;

--
-- Name: crm_forecasts; Type: TABLE; Schema: public; Owner: erp_user
--

CREATE TABLE public.crm_forecasts (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    user_id uuid,
    period_start date,
    period_end date,
    quota numeric(15,2),
    closed_won numeric(15,2) DEFAULT 0,
    commit_amount numeric(15,2) DEFAULT 0,
    best_case numeric(15,2) DEFAULT 0,
    pipeline_total numeric(15,2) DEFAULT 0,
    snapshot_date date DEFAULT CURRENT_DATE
);


ALTER TABLE public.crm_forecasts OWNER TO erp_user;

--
-- Name: crm_gamification_points; Type: TABLE; Schema: public; Owner: erp_user
--

CREATE TABLE public.crm_gamification_points (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    user_id uuid NOT NULL,
    event_type character varying(100),
    points integer NOT NULL,
    metadata jsonb DEFAULT '{}'::jsonb,
    earned_at timestamp without time zone DEFAULT now()
);


ALTER TABLE public.crm_gamification_points OWNER TO erp_user;

--
-- Name: crm_hcps; Type: TABLE; Schema: public; Owner: erp_user
--

CREATE TABLE public.crm_hcps (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    contact_id uuid NOT NULL,
    specialty character varying(100),
    qualification character varying(100),
    mci_registration_no character varying(50),
    experience_years integer,
    typical_rx_volume integer,
    preferred_brands text[] DEFAULT '{}'::text[],
    rating integer,
    notes text,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now(),
    CONSTRAINT crm_hcps_rating_check CHECK (((rating >= 1) AND (rating <= 5)))
);


ALTER TABLE public.crm_hcps OWNER TO erp_user;

--
-- Name: crm_kb_articles; Type: TABLE; Schema: public; Owner: erp_user
--

CREATE TABLE public.crm_kb_articles (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    title character varying(255) NOT NULL,
    category character varying(100),
    content text,
    article_type character varying(30) DEFAULT 'ARTICLE'::character varying,
    status character varying(20) DEFAULT 'PUBLISHED'::character varying,
    view_count integer DEFAULT 0,
    created_by uuid,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now()
);


ALTER TABLE public.crm_kb_articles OWNER TO erp_user;

--
-- Name: crm_layouts; Type: TABLE; Schema: public; Owner: erp_user
--

CREATE TABLE public.crm_layouts (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    object_type character varying(50),
    role character varying(50),
    layout_config jsonb DEFAULT '{}'::jsonb,
    updated_at timestamp without time zone DEFAULT now()
);


ALTER TABLE public.crm_layouts OWNER TO erp_user;

--
-- Name: crm_leads; Type: TABLE; Schema: public; Owner: erp_user
--

CREATE TABLE public.crm_leads (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    first_name character varying(100),
    last_name character varying(100),
    company character varying(255),
    email character varying(150),
    phone character varying(20),
    territory character varying(100),
    lead_source character varying(100),
    status character varying(50) DEFAULT 'NEW'::character varying,
    score integer DEFAULT 0,
    owner_id uuid,
    converted boolean DEFAULT false,
    converted_account_id uuid,
    converted_contact_id uuid,
    notes text,
    deleted_at timestamp without time zone,
    created_by uuid,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now()
);


ALTER TABLE public.crm_leads OWNER TO erp_user;

--
-- Name: crm_mentions; Type: TABLE; Schema: public; Owner: erp_user
--

CREATE TABLE public.crm_mentions (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    mentioned_user_id uuid NOT NULL,
    mentioned_by uuid NOT NULL,
    entity_type character varying(50),
    entity_id uuid,
    context text,
    read boolean DEFAULT false,
    created_at timestamp without time zone DEFAULT now()
);


ALTER TABLE public.crm_mentions OWNER TO erp_user;

--
-- Name: crm_notes; Type: TABLE; Schema: public; Owner: erp_user
--

CREATE TABLE public.crm_notes (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    entity_type character varying(50),
    entity_id uuid,
    content text NOT NULL,
    created_by uuid,
    created_at timestamp without time zone DEFAULT now()
);


ALTER TABLE public.crm_notes OWNER TO erp_user;

--
-- Name: crm_oauth_tokens; Type: TABLE; Schema: public; Owner: erp_user
--

CREATE TABLE public.crm_oauth_tokens (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    user_id uuid NOT NULL,
    provider character varying(50) NOT NULL,
    access_token text,
    refresh_token text,
    expires_at timestamp without time zone,
    scope text
);


ALTER TABLE public.crm_oauth_tokens OWNER TO erp_user;

--
-- Name: crm_opportunities; Type: TABLE; Schema: public; Owner: erp_user
--

CREATE TABLE public.crm_opportunities (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    name character varying(255) NOT NULL,
    account_id uuid,
    contact_id uuid,
    pipeline_id uuid,
    stage character varying(50) DEFAULT 'DISCOVERY'::character varying,
    value numeric(15,2),
    probability numeric(5,2),
    expected_close_date date,
    actual_close_date date,
    source character varying(100),
    loss_reason character varying(255),
    owner_id uuid,
    product_interest text[] DEFAULT '{}'::text[],
    next_action text,
    next_action_date date,
    deleted_at timestamp without time zone,
    created_by uuid,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now()
);


ALTER TABLE public.crm_opportunities OWNER TO erp_user;

--
-- Name: crm_permissions; Type: TABLE; Schema: public; Owner: erp_user
--

CREATE TABLE public.crm_permissions (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    entity_type character varying(50),
    entity_id uuid,
    grantee_type character varying(20),
    grantee_id uuid,
    access_level character varying(20),
    granted_by uuid,
    granted_at timestamp without time zone DEFAULT now()
);


ALTER TABLE public.crm_permissions OWNER TO erp_user;

--
-- Name: crm_pipeline_stages; Type: TABLE; Schema: public; Owner: erp_user
--

CREATE TABLE public.crm_pipeline_stages (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    pipeline_id uuid,
    name character varying(100) NOT NULL,
    stage_order integer,
    win_probability numeric(5,2) DEFAULT 0,
    is_won boolean DEFAULT false,
    is_lost boolean DEFAULT false
);


ALTER TABLE public.crm_pipeline_stages OWNER TO erp_user;

--
-- Name: crm_pipelines; Type: TABLE; Schema: public; Owner: erp_user
--

CREATE TABLE public.crm_pipelines (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    name character varying(100) NOT NULL,
    is_default boolean DEFAULT false,
    created_at timestamp without time zone DEFAULT now()
);


ALTER TABLE public.crm_pipelines OWNER TO erp_user;

--
-- Name: crm_playbooks; Type: TABLE; Schema: public; Owner: erp_user
--

CREATE TABLE public.crm_playbooks (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    name character varying(255) NOT NULL,
    description text,
    steps jsonb DEFAULT '[]'::jsonb,
    status character varying(20) DEFAULT 'ACTIVE'::character varying,
    created_by uuid,
    created_at timestamp without time zone DEFAULT now()
);


ALTER TABLE public.crm_playbooks OWNER TO erp_user;

--
-- Name: crm_predictions; Type: TABLE; Schema: public; Owner: erp_user
--

CREATE TABLE public.crm_predictions (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    prediction_type character varying(50),
    entity_type character varying(30),
    entity_id uuid,
    value numeric(10,4),
    confidence numeric(5,4),
    factors jsonb DEFAULT '{}'::jsonb,
    model_version character varying(50),
    predicted_at timestamp without time zone DEFAULT now()
);


ALTER TABLE public.crm_predictions OWNER TO erp_user;

--
-- Name: crm_push_subscriptions; Type: TABLE; Schema: public; Owner: erp_user
--

CREATE TABLE public.crm_push_subscriptions (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    user_id uuid NOT NULL,
    endpoint text NOT NULL,
    p256dh text,
    auth text,
    created_at timestamp without time zone DEFAULT now()
);


ALTER TABLE public.crm_push_subscriptions OWNER TO erp_user;

--
-- Name: crm_quotas; Type: TABLE; Schema: public; Owner: erp_user
--

CREATE TABLE public.crm_quotas (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    user_id uuid NOT NULL,
    period_type character varying(20),
    period_start date,
    period_end date,
    quota_amount numeric(15,2),
    created_at timestamp without time zone DEFAULT now()
);


ALTER TABLE public.crm_quotas OWNER TO erp_user;

--
-- Name: crm_quote_lines; Type: TABLE; Schema: public; Owner: erp_user
--

CREATE TABLE public.crm_quote_lines (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    quote_id uuid NOT NULL,
    product_name character varying(255),
    product_id uuid,
    quantity integer,
    unit_price numeric(15,2),
    discount_pct numeric(5,2) DEFAULT 0,
    line_total numeric(15,2),
    sort_order integer
);


ALTER TABLE public.crm_quote_lines OWNER TO erp_user;

--
-- Name: crm_quotes; Type: TABLE; Schema: public; Owner: erp_user
--

CREATE TABLE public.crm_quotes (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    quote_number character varying(50),
    opportunity_id uuid,
    account_id uuid,
    contact_id uuid,
    status character varying(50) DEFAULT 'DRAFT'::character varying,
    valid_until date,
    subtotal numeric(15,2),
    tax_amount numeric(15,2),
    discount_amount numeric(15,2),
    total numeric(15,2),
    notes text,
    terms text,
    signed_at timestamp without time zone,
    deleted_at timestamp without time zone,
    created_by uuid,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now()
);


ALTER TABLE public.crm_quotes OWNER TO erp_user;

--
-- Name: crm_samples; Type: TABLE; Schema: public; Owner: erp_user
--

CREATE TABLE public.crm_samples (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    contact_id uuid,
    account_id uuid,
    product_name character varying(255) NOT NULL,
    quantity integer NOT NULL,
    batch_number character varying(100),
    given_by uuid,
    given_date date NOT NULL,
    purpose text,
    recipient_signature text,
    created_at timestamp without time zone DEFAULT now()
);


ALTER TABLE public.crm_samples OWNER TO erp_user;

--
-- Name: crm_scores; Type: TABLE; Schema: public; Owner: erp_user
--

CREATE TABLE public.crm_scores (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    entity_type character varying(30),
    entity_id uuid,
    lead_score integer,
    churn_risk numeric(5,2),
    health_score integer,
    engagement_score integer,
    factors jsonb DEFAULT '{}'::jsonb,
    computed_at timestamp without time zone DEFAULT now()
);


ALTER TABLE public.crm_scores OWNER TO erp_user;

--
-- Name: crm_segments; Type: TABLE; Schema: public; Owner: erp_user
--

CREATE TABLE public.crm_segments (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    name character varying(255) NOT NULL,
    description text,
    rules jsonb DEFAULT '{}'::jsonb NOT NULL,
    is_dynamic boolean DEFAULT true,
    last_count integer DEFAULT 0,
    last_evaluated timestamp without time zone,
    created_by uuid,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now()
);


ALTER TABLE public.crm_segments OWNER TO erp_user;

--
-- Name: crm_sequence_enrolments; Type: TABLE; Schema: public; Owner: erp_user
--

CREATE TABLE public.crm_sequence_enrolments (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    sequence_id uuid NOT NULL,
    contact_id uuid NOT NULL,
    current_step integer DEFAULT 1,
    status character varying(20) DEFAULT 'ACTIVE'::character varying,
    enrolled_at timestamp without time zone DEFAULT now(),
    exited_at timestamp without time zone,
    exit_reason character varying(100)
);


ALTER TABLE public.crm_sequence_enrolments OWNER TO erp_user;

--
-- Name: crm_sequence_steps; Type: TABLE; Schema: public; Owner: erp_user
--

CREATE TABLE public.crm_sequence_steps (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    sequence_id uuid NOT NULL,
    step_order integer NOT NULL,
    step_type character varying(30) NOT NULL,
    template_id uuid,
    delay_hours integer DEFAULT 0,
    conditions jsonb DEFAULT '{}'::jsonb,
    variant character(1) DEFAULT 'A'::bpchar
);


ALTER TABLE public.crm_sequence_steps OWNER TO erp_user;

--
-- Name: crm_sequences; Type: TABLE; Schema: public; Owner: erp_user
--

CREATE TABLE public.crm_sequences (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    name character varying(255) NOT NULL,
    description text,
    status character varying(20) DEFAULT 'DRAFT'::character varying,
    ab_test_enabled boolean DEFAULT false,
    exit_on_reply boolean DEFAULT true,
    exit_on_meeting boolean DEFAULT true,
    exit_on_won boolean DEFAULT true,
    created_by uuid,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now()
);


ALTER TABLE public.crm_sequences OWNER TO erp_user;

--
-- Name: crm_tasks; Type: TABLE; Schema: public; Owner: erp_user
--

CREATE TABLE public.crm_tasks (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    title character varying(255) NOT NULL,
    task_type character varying(50) DEFAULT 'FOLLOW_UP'::character varying,
    priority character varying(20) DEFAULT 'MEDIUM'::character varying,
    status character varying(20) DEFAULT 'OPEN'::character varying,
    due_date timestamp without time zone,
    completed_at timestamp without time zone,
    snoozed_until timestamp without time zone,
    account_id uuid,
    contact_id uuid,
    opportunity_id uuid,
    assigned_to uuid,
    is_recurring boolean DEFAULT false,
    recurrence_rule character varying(50),
    notes text,
    deleted_at timestamp without time zone,
    created_by uuid,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now()
);


ALTER TABLE public.crm_tasks OWNER TO erp_user;

--
-- Name: crm_templates; Type: TABLE; Schema: public; Owner: erp_user
--

CREATE TABLE public.crm_templates (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    name character varying(255) NOT NULL,
    channel character varying(20) NOT NULL,
    category character varying(50),
    subject character varying(255),
    body text NOT NULL,
    merge_tokens text[] DEFAULT '{}'::text[],
    whatsapp_approved boolean DEFAULT false,
    created_by uuid,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now()
);


ALTER TABLE public.crm_templates OWNER TO erp_user;

--
-- Name: crm_territories; Type: TABLE; Schema: public; Owner: erp_user
--

CREATE TABLE public.crm_territories (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    name character varying(100) NOT NULL,
    parent_territory_id uuid,
    assigned_to uuid,
    created_at timestamp without time zone DEFAULT now()
);


ALTER TABLE public.crm_territories OWNER TO erp_user;

--
-- Name: crm_webhooks; Type: TABLE; Schema: public; Owner: erp_user
--

CREATE TABLE public.crm_webhooks (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    name character varying(100),
    url text NOT NULL,
    events text[] DEFAULT '{}'::text[],
    secret character varying(255),
    active boolean DEFAULT true,
    created_by uuid,
    created_at timestamp without time zone DEFAULT now()
);


ALTER TABLE public.crm_webhooks OWNER TO erp_user;

--
-- Name: dead_stock_analysis; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.dead_stock_analysis (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    product_id uuid NOT NULL,
    batch_id uuid NOT NULL,
    analysis_date date DEFAULT CURRENT_DATE,
    last_movement_date date,
    days_without_movement integer,
    is_dead_stock boolean DEFAULT false,
    dead_stock_status character varying(50),
    quantity_on_hand numeric(15,4),
    inventory_value numeric(20,2),
    expiry_risk boolean DEFAULT false,
    recommendation character varying(200),
    estimated_recovery_value numeric(20,2),
    action_taken boolean DEFAULT false,
    created_by uuid,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.dead_stock_analysis OWNER TO postgres;

--
-- Name: dispatches; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.dispatches (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    invoice_no character varying(50) NOT NULL,
    customer_name character varying(255) NOT NULL,
    customer_address text,
    customer_city character varying(100),
    customer_state character varying(100),
    customer_pincode character varying(20),
    dispatch_date date DEFAULT CURRENT_DATE,
    expected_delivery_date date,
    actual_delivery_date date,
    transporter character varying(255),
    transporter_id character varying(50),
    lr_number character varying(50),
    eway_bill_no character varying(50),
    eway_bill_date date,
    boxes integer DEFAULT 1,
    weight character varying(50),
    volume character varying(50),
    package_type character varying(20) DEFAULT 'Box'::character varying,
    fragile boolean DEFAULT false,
    temperature_controlled boolean DEFAULT false,
    insurance_value numeric(15,2) DEFAULT 0,
    insurance_company character varying(255),
    cod_amount numeric(15,2) DEFAULT 0,
    shipping_cost numeric(15,2) DEFAULT 0,
    handling_charges numeric(15,2) DEFAULT 0,
    total_charges numeric(15,2) DEFAULT 0,
    payment_mode character varying(20) DEFAULT 'Prepaid'::character varying,
    status character varying(50) DEFAULT 'Packed'::character varying,
    delivery_attempts integer DEFAULT 0,
    delivery_person character varying(255),
    delivery_signature text,
    delivery_remarks text,
    vehicle_number character varying(50),
    driver_name character varying(255),
    driver_contact character varying(20),
    route_details text,
    distance_covered numeric(10,2),
    fuel_consumed numeric(10,2),
    tracking_updates jsonb DEFAULT '[]'::jsonb,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    created_by character varying(255),
    last_updated_by character varying(255)
);


ALTER TABLE public.dispatches OWNER TO postgres;

--
-- Name: dms_audit_trail; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.dms_audit_trail (
    id bigint NOT NULL,
    document_id character varying(50),
    action character varying(50) NOT NULL,
    user_id uuid,
    user_name character varying(100),
    details text,
    ip_address character varying(45),
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.dms_audit_trail OWNER TO postgres;

--
-- Name: dms_audit_trail_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.dms_audit_trail_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.dms_audit_trail_id_seq OWNER TO postgres;

--
-- Name: dms_audit_trail_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.dms_audit_trail_id_seq OWNED BY public.dms_audit_trail.id;


--
-- Name: dms_documents; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.dms_documents (
    id character varying(50) NOT NULL,
    title character varying(255) NOT NULL,
    category character varying(100) DEFAULT 'General'::character varying NOT NULL,
    file_type character varying(20),
    current_version integer DEFAULT 1,
    status character varying(50) DEFAULT 'Active'::character varying,
    expiry_date date,
    author_id uuid,
    author_name character varying(100),
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    department character varying(100),
    document_number character varying(150),
    issuing_authority character varying(255),
    issue_date date,
    is_permanent boolean DEFAULT false,
    priority character varying(20) DEFAULT 'Normal'::character varying,
    workflow_status character varying(30) DEFAULT 'Draft'::character varying,
    folder_id uuid,
    file_url text,
    file_name character varying(255),
    file_size bigint,
    tags text[] DEFAULT '{}'::text[],
    notes text,
    uploaded_by character varying(100),
    reviewed_by character varying(100),
    approved_by character varying(100),
    company_id integer DEFAULT 1,
    CONSTRAINT chk_dms_priority CHECK (((priority)::text = ANY ((ARRAY['High'::character varying, 'Normal'::character varying, 'Low'::character varying])::text[]))),
    CONSTRAINT chk_dms_status CHECK (((status)::text = ANY ((ARRAY['Active'::character varying, 'Draft'::character varying, 'Under Review'::character varying, 'Approved'::character varying, 'Archived'::character varying, 'Expired'::character varying])::text[]))),
    CONSTRAINT chk_dms_workflow CHECK (((workflow_status)::text = ANY ((ARRAY['Draft'::character varying, 'Under Review'::character varying, 'Approved'::character varying, 'Published'::character varying, 'Rejected'::character varying])::text[])))
);


ALTER TABLE public.dms_documents OWNER TO postgres;

--
-- Name: dms_folders; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.dms_folders (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    name character varying(100) NOT NULL,
    parent_id uuid,
    color character varying(30) DEFAULT 'slate'::character varying,
    sort_order integer DEFAULT 0,
    created_at timestamp without time zone DEFAULT now()
);


ALTER TABLE public.dms_folders OWNER TO postgres;

--
-- Name: dms_versions; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.dms_versions (
    id bigint NOT NULL,
    document_id character varying(50),
    version_label character varying(20) NOT NULL,
    file_url text NOT NULL,
    file_size_bytes bigint,
    change_log text,
    uploaded_by uuid,
    uploaded_name character varying(100),
    approved_by character varying(100),
    approval_date timestamp with time zone,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.dms_versions OWNER TO postgres;

--
-- Name: dms_versions_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.dms_versions_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.dms_versions_id_seq OWNER TO postgres;

--
-- Name: dms_versions_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.dms_versions_id_seq OWNED BY public.dms_versions.id;


--
-- Name: dms_workflows; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.dms_workflows (
    id bigint NOT NULL,
    document_id character varying(50),
    current_step character varying(50) NOT NULL,
    assigned_to character varying(100),
    due_date date,
    status character varying(20) DEFAULT 'In Progress'::character varying,
    comments jsonb DEFAULT '[]'::jsonb,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.dms_workflows OWNER TO postgres;

--
-- Name: dms_workflows_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.dms_workflows_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.dms_workflows_id_seq OWNER TO postgres;

--
-- Name: dms_workflows_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.dms_workflows_id_seq OWNED BY public.dms_workflows.id;


--
-- Name: document_categories; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.document_categories (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    name character varying(100) NOT NULL,
    description text,
    color character varying(30) DEFAULT 'slate'::character varying NOT NULL,
    icon character varying(50) DEFAULT 'FileText'::character varying NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    sort_order integer DEFAULT 0 NOT NULL,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE public.document_categories OWNER TO postgres;

--
-- Name: drug_licenses; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.drug_licenses (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    name character varying(255) NOT NULL,
    license_number character varying(100) NOT NULL,
    expiry_date date,
    category character varying(100),
    status character varying(50) DEFAULT 'Valid'::character varying,
    document_url text,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    start_date date,
    notes text,
    file_path text,
    file_name character varying(255),
    issued_by character varying(255),
    CONSTRAINT chk_license_status CHECK (((status)::text = ANY ((ARRAY['Valid'::character varying, 'Expiring Soon'::character varying, 'Expired'::character varying, 'Suspended'::character varying])::text[])))
);


ALTER TABLE public.drug_licenses OWNER TO postgres;

--
-- Name: e_invoices; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.e_invoices (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    company_id integer DEFAULT 1,
    invoice_id uuid,
    irn character varying(100),
    ack_no character varying(100),
    qr_code text,
    status character varying(50) DEFAULT 'Draft'::character varying,
    created_by uuid,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.e_invoices OWNER TO postgres;

--
-- Name: employees; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.employees (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    company_id integer DEFAULT 1,
    name character varying(255) NOT NULL,
    contact character varying(20),
    email character varying(100),
    headquarters character varying(100),
    assigned_area character varying(100),
    sales_target numeric(15,2) DEFAULT 0,
    total_sales numeric(15,2) DEFAULT 0,
    target_achievement numeric(5,2) DEFAULT 0,
    base_salary numeric(12,2) DEFAULT 0,
    incentives numeric(12,2) DEFAULT 0,
    deductions numeric(12,2) DEFAULT 0,
    status character varying(50) DEFAULT 'Active'::character varying,
    join_date date DEFAULT CURRENT_DATE,
    created_by uuid,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.employees OWNER TO postgres;

--
-- Name: erp_settings; Type: TABLE; Schema: public; Owner: erp_user
--

CREATE TABLE public.erp_settings (
    key character varying(100) NOT NULL,
    value text NOT NULL,
    updated_at timestamp with time zone DEFAULT now()
);


ALTER TABLE public.erp_settings OWNER TO erp_user;

--
-- Name: expenses; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.expenses (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    category character varying(50) NOT NULL,
    description text,
    amount numeric(12,2) NOT NULL,
    date date NOT NULL,
    paid_by character varying(100),
    payment_mode character varying(20),
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.expenses OWNER TO postgres;

--
-- Name: financial_audit_log; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.financial_audit_log (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    company_id integer DEFAULT 1,
    user_id uuid,
    action_type character varying(50) NOT NULL,
    entity_type character varying(50) NOT NULL,
    entity_id uuid NOT NULL,
    old_values jsonb,
    new_values jsonb,
    ip_address character varying(50),
    "timestamp" timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.financial_audit_log OWNER TO postgres;

--
-- Name: financial_years; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.financial_years (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    company_id integer DEFAULT 1,
    year_label character varying(20) NOT NULL,
    start_date date NOT NULL,
    end_date date NOT NULL,
    status character varying(20) DEFAULT 'Open'::character varying,
    closed_by uuid,
    closed_at timestamp without time zone,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    locked_by uuid,
    locked_at timestamp without time zone,
    lock_reason text
);


ALTER TABLE public.financial_years OWNER TO postgres;

--
-- Name: fixed_assets; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.fixed_assets (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    company_id integer DEFAULT 1,
    asset_name character varying(255) NOT NULL,
    asset_code character varying(100),
    account_id uuid NOT NULL,
    purchase_date date NOT NULL,
    purchase_value numeric(15,2) NOT NULL,
    current_value numeric(15,2) NOT NULL,
    depreciation_method character varying(50) DEFAULT 'Straight Line'::character varying,
    depreciation_rate_percent numeric(5,2) NOT NULL,
    accumulated_depreciation numeric(15,2) DEFAULT 0,
    location character varying(255),
    status character varying(50) DEFAULT 'Active'::character varying,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    category_id uuid,
    model_no character varying(100),
    serial_no character varying(100),
    vendor_id uuid,
    specs jsonb DEFAULT '{}'::jsonb,
    last_maintenance_date date,
    next_maintenance_date date
);


ALTER TABLE public.fixed_assets OWNER TO postgres;

--
-- Name: forecast_demand; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.forecast_demand (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    product_id uuid NOT NULL,
    forecast_date date NOT NULL,
    method_used character varying(50),
    avg_monthly_demand integer,
    demand_trend character varying(50),
    forecasted_quantity integer,
    forecast_confidence_level numeric(3,0),
    recommended_stock_level integer,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.forecast_demand OWNER TO postgres;

--
-- Name: forex_rates; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.forex_rates (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    currency_code character varying(10) NOT NULL,
    base_currency character varying(10) DEFAULT 'INR'::character varying,
    exchange_rate numeric(15,6) NOT NULL,
    effective_date date NOT NULL,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.forex_rates OWNER TO postgres;

--
-- Name: general_ledger; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.general_ledger (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    account_id uuid,
    voucher_id uuid,
    party_id uuid,
    voucher_type character varying(50),
    transaction_date date NOT NULL,
    debit numeric(15,2) DEFAULT 0,
    credit numeric(15,2) DEFAULT 0,
    running_balance numeric(15,2),
    is_reconciled boolean DEFAULT false,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    currency_code character varying(10) DEFAULT 'INR'::character varying,
    foreign_amount numeric(15,2),
    fx_rate numeric(15,6) DEFAULT 1.0,
    narration text,
    transaction_type character varying(50) DEFAULT 'JOURNAL'::character varying,
    company_id integer DEFAULT 1
);


ALTER TABLE public.general_ledger OWNER TO postgres;

--
-- Name: godowns; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.godowns (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    company_id integer DEFAULT 1,
    name character varying(255) NOT NULL,
    address text,
    manager_id uuid,
    is_default boolean DEFAULT false,
    status character varying(50) DEFAULT 'Active'::character varying,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.godowns OWNER TO postgres;

--
-- Name: goods_received_notes; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.goods_received_notes (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    purchase_order_id uuid,
    grn_number character varying(50) NOT NULL,
    received_date timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    received_by uuid,
    status character varying(20) DEFAULT 'Pending'::character varying,
    remarks text,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.goods_received_notes OWNER TO postgres;

--
-- Name: grn_items; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.grn_items (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    grn_id uuid,
    product_id uuid,
    po_item_id uuid,
    ordered_qty integer NOT NULL,
    received_qty integer NOT NULL,
    accepted_qty integer NOT NULL,
    rejected_qty integer DEFAULT 0,
    unit_price numeric(15,2),
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.grn_items OWNER TO postgres;

--
-- Name: h1_register; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.h1_register (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    entry_date date DEFAULT CURRENT_DATE,
    invoice_no character varying(50),
    patient_name character varying(255) NOT NULL,
    doctor_name character varying(255) NOT NULL,
    drug_name character varying(255) NOT NULL,
    batch_number character varying(50),
    quantity integer NOT NULL,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    created_by uuid,
    quantity_unit character varying(20) DEFAULT 'Tablet'::character varying
);


ALTER TABLE public.h1_register OWNER TO postgres;

--
-- Name: inventory_turnover_analysis; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.inventory_turnover_analysis (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    company_id uuid,
    product_id uuid NOT NULL,
    analysis_period_start date NOT NULL,
    analysis_period_end date NOT NULL,
    cost_of_goods_sold numeric(20,2),
    average_inventory_value numeric(20,2),
    inventory_turnover_ratio numeric(8,2),
    days_inventory_outstanding integer,
    trend character varying(50),
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.inventory_turnover_analysis OWNER TO postgres;

--
-- Name: journal_voucher_entries; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.journal_voucher_entries (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    voucher_id uuid,
    account_id uuid,
    debit numeric(15,2) DEFAULT 0,
    credit numeric(15,2) DEFAULT 0,
    narration text,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.journal_voucher_entries OWNER TO postgres;

--
-- Name: journal_vouchers; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.journal_vouchers (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    company_id integer DEFAULT 1,
    party_id uuid,
    voucher_type character varying(50) DEFAULT 'Journal'::character varying,
    voucher_no character varying(50) NOT NULL,
    voucher_date date NOT NULL,
    narration text,
    total_debit numeric(15,2) DEFAULT 0,
    total_credit numeric(15,2) DEFAULT 0,
    status character varying(50) DEFAULT 'Draft'::character varying,
    created_by uuid,
    posted_by uuid,
    approved_by uuid,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    posted_at timestamp without time zone,
    approved_at timestamp without time zone,
    currency_code character varying(10) DEFAULT 'INR'::character varying,
    fx_rate numeric(15,6) DEFAULT 1.0,
    foreign_amount numeric(15,2),
    reversed_by uuid,
    reversed_at timestamp without time zone,
    original_voucher_id uuid
);


ALTER TABLE public.journal_vouchers OWNER TO postgres;

--
-- Name: kpi_dashboard_data; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.kpi_dashboard_data (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    company_id uuid,
    data_date date DEFAULT CURRENT_DATE,
    total_inventory_value numeric(20,2),
    total_stock_quantity integer,
    total_sku_count integer,
    avg_inventory_turnover numeric(8,2),
    dead_stock_value numeric(20,2),
    dead_stock_percentage numeric(5,2),
    stockout_incidents_this_month integer,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.kpi_dashboard_data OWNER TO postgres;

--
-- Name: lead_activities; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.lead_activities (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    lead_id uuid,
    type character varying(50) NOT NULL,
    description text,
    performed_by uuid,
    performed_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    duration integer,
    outcome text,
    follow_up_required boolean DEFAULT false,
    follow_up_date date,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.lead_activities OWNER TO postgres;

--
-- Name: lead_interactions; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.lead_interactions (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    lead_id uuid,
    interaction_date timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    type character varying(50),
    summary text,
    next_follow_up date,
    created_by uuid,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.lead_interactions OWNER TO postgres;

--
-- Name: leads; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.leads (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    company_id integer DEFAULT 1,
    name character varying(255) NOT NULL,
    company_name character varying(255),
    email character varying(255),
    contact character varying(20) NOT NULL,
    location character varying(100),
    status character varying(50) DEFAULT 'New'::character varying,
    priority character varying(20) DEFAULT 'Medium'::character varying,
    source character varying(100),
    next_follow_up date,
    estimated_value numeric(15,2) DEFAULT 0,
    assigned_to uuid,
    notes text,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.leads OWNER TO postgres;

--
-- Name: medical_representatives; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.medical_representatives (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    company_id integer DEFAULT 1,
    name character varying(255) NOT NULL,
    contact character varying(20) NOT NULL,
    email character varying(255),
    headquarters character varying(100),
    assigned_area character varying(255),
    status character varying(20) DEFAULT 'Active'::character varying,
    join_date date DEFAULT CURRENT_DATE,
    base_salary numeric(15,2) DEFAULT 0,
    fixed_allowances numeric(15,2) DEFAULT 0,
    sales_target numeric(15,2) DEFAULT 0,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.medical_representatives OWNER TO postgres;

--
-- Name: mv_accounts_dashboard; Type: MATERIALIZED VIEW; Schema: public; Owner: postgres
--

CREATE MATERIALIZED VIEW public.mv_accounts_dashboard AS
 SELECT COALESCE(( SELECT acc_ratios_cache.current_ratio
           FROM public.acc_ratios_cache
          ORDER BY acc_ratios_cache.as_of_date DESC
         LIMIT 1), (0)::numeric) AS current_ratio,
    COALESCE(( SELECT acc_ratios_cache.net_profit_margin
           FROM public.acc_ratios_cache
          ORDER BY acc_ratios_cache.as_of_date DESC
         LIMIT 1), (0)::numeric) AS net_profit_margin,
    COALESCE(( SELECT acc_ratios_cache.debtor_days
           FROM public.acc_ratios_cache
          ORDER BY acc_ratios_cache.as_of_date DESC
         LIMIT 1), (0)::numeric) AS debtor_days,
    COALESCE(( SELECT count(*) AS count
           FROM public.acc_anomalies
          WHERE (((acc_anomalies.status)::text = 'OPEN'::text) AND ((acc_anomalies.severity)::text = 'CRITICAL'::text))), (0)::bigint) AS critical_anomalies,
    COALESCE(( SELECT count(*) AS count
           FROM public.acc_anomalies
          WHERE ((acc_anomalies.status)::text = 'OPEN'::text)), (0)::bigint) AS open_anomalies,
    COALESCE(( SELECT count(*) AS count
           FROM public.acc_dunning_log
          WHERE ((acc_dunning_log.executed_at)::date = CURRENT_DATE)), (0)::bigint) AS dunning_actions_today,
    COALESCE(( SELECT sum(acc_payment_runs.net_payable) AS sum
           FROM public.acc_payment_runs
          WHERE ((acc_payment_runs.status)::text = 'DRAFT'::text)), (0)::numeric) AS pending_payment_runs_amount,
    COALESCE(( SELECT count(*) AS count
           FROM public.acc_payment_runs
          WHERE ((acc_payment_runs.status)::text = 'DRAFT'::text)), (0)::bigint) AS pending_payment_runs_count,
    now() AS last_refreshed
  WITH NO DATA;


ALTER MATERIALIZED VIEW public.mv_accounts_dashboard OWNER TO postgres;

--
-- Name: order_items; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.order_items (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    order_id uuid,
    product_id uuid,
    product_name character varying(255),
    quantity integer NOT NULL,
    approved_quantity integer,
    rate numeric(15,2) NOT NULL,
    amount numeric(15,2) NOT NULL,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.order_items OWNER TO postgres;

--
-- Name: orders; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.orders (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    distributor_id uuid,
    distributor_name character varying(255),
    order_date date DEFAULT CURRENT_DATE,
    total_amount numeric(15,2) DEFAULT 0,
    status character varying(50) DEFAULT 'Pending Approval'::character varying,
    priority character varying(20) DEFAULT 'Normal'::character varying,
    credit_status character varying(50) DEFAULT 'Clear'::character varying,
    packing_specs text,
    labeling_specs text,
    remarks text,
    created_by uuid,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.orders OWNER TO postgres;

--
-- Name: p2; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.p2 (
    id uuid
);


ALTER TABLE public.p2 OWNER TO postgres;

--
-- Name: p3; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.p3 (
    id uuid
);


ALTER TABLE public.p3 OWNER TO postgres;

--
-- Name: p4; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.p4 (
    id uuid
);


ALTER TABLE public.p4 OWNER TO postgres;

--
-- Name: parties; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.parties (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    name character varying(255) NOT NULL,
    type character varying(20) NOT NULL,
    gstin character varying(20),
    mobile character varying(15),
    email character varying(100),
    address text,
    city character varying(100),
    state character varying(100),
    status character varying(20) DEFAULT 'Active'::character varying,
    credit_limit numeric(12,2) DEFAULT 0,
    current_balance numeric(12,2) DEFAULT 0,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    pin_code character varying(10) DEFAULT NULL::character varying,
    credit_days integer DEFAULT 0,
    category character varying(50) DEFAULT 'Regular'::character varying,
    contact_person character varying(255) DEFAULT NULL::character varying,
    pan character varying(20) DEFAULT NULL::character varying,
    route character varying(255) DEFAULT NULL::character varying,
    territory character varying(255) DEFAULT NULL::character varying,
    remarks text,
    bank_name character varying(255) DEFAULT NULL::character varying,
    account_number character varying(50) DEFAULT NULL::character varying,
    ifsc_code character varying(20) DEFAULT NULL::character varying,
    drug_license_no character varying(100) DEFAULT NULL::character varying,
    updated_at timestamp with time zone DEFAULT now()
);


ALTER TABLE public.parties OWNER TO postgres;

--
-- Name: TABLE parties; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.parties IS 'Customer (Debtor) and Supplier (Creditor) master records for Metapharsic ERP';


--
-- Name: password_history; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.password_history (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    user_id uuid NOT NULL,
    password_hash character varying(255) NOT NULL,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.password_history OWNER TO postgres;

--
-- Name: payment_vouchers; Type: TABLE; Schema: public; Owner: erp_user
--

CREATE TABLE public.payment_vouchers (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    payment_no character varying(50) NOT NULL,
    payment_date date NOT NULL,
    party_id uuid NOT NULL,
    bank_account_id uuid,
    payment_mode character varying(30) NOT NULL,
    amount numeric(15,2) NOT NULL,
    tds_section character varying(20),
    tds_amount numeric(15,2) DEFAULT 0,
    net_paid numeric(15,2) NOT NULL,
    cheque_no character varying(50),
    cheque_date date,
    utr_no character varying(100),
    narration text,
    status character varying(20) DEFAULT 'DRAFT'::character varying,
    voucher_id uuid,
    approved_by uuid,
    created_by uuid,
    created_at timestamp without time zone DEFAULT now()
);


ALTER TABLE public.payment_vouchers OWNER TO erp_user;

--
-- Name: pcd_activity_log; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.pcd_activity_log (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    partner_id uuid,
    actor_name character varying(100),
    action_type character varying(50) NOT NULL,
    description text,
    entity_type character varying(50),
    entity_id uuid,
    metadata jsonb,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    company_id integer DEFAULT 1
);


ALTER TABLE public.pcd_activity_log OWNER TO postgres;

--
-- Name: pcd_broadcast_messages; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.pcd_broadcast_messages (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    title character varying(255) NOT NULL,
    message text NOT NULL,
    channel character varying(50) DEFAULT 'EMAIL'::character varying,
    target_grades character varying(100),
    target_states character varying(255),
    sent_by uuid,
    status character varying(50) DEFAULT 'SENT'::character varying,
    recipient_count integer DEFAULT 0,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.pcd_broadcast_messages OWNER TO postgres;

--
-- Name: pcd_commissions; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.pcd_commissions (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    partner_id uuid NOT NULL,
    period character varying(20),
    period_start date,
    period_end date,
    base_commission numeric(15,2),
    scheme_bonus numeric(15,2) DEFAULT 0,
    deductions numeric(15,2) DEFAULT 0,
    net_commission numeric(15,2),
    payment_status character varying(50) DEFAULT 'PENDING'::character varying,
    paid_on date,
    notes text,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    company_id integer DEFAULT 1
);


ALTER TABLE public.pcd_commissions OWNER TO postgres;

--
-- Name: pcd_mr_assignments; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.pcd_mr_assignments (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    partner_id uuid NOT NULL,
    mr_id uuid NOT NULL,
    assigned_date date,
    is_active boolean DEFAULT true,
    notes text,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.pcd_mr_assignments OWNER TO postgres;

--
-- Name: pcd_partner_documents; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.pcd_partner_documents (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    partner_id uuid NOT NULL,
    document_type character varying(50),
    document_name character varying(255),
    file_url text,
    expiry_date date,
    renewal_date date,
    status character varying(50) DEFAULT 'PENDING'::character varying,
    verified_by uuid,
    approved_at timestamp without time zone,
    created_by uuid,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.pcd_partner_documents OWNER TO postgres;

--
-- Name: pcd_partners; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.pcd_partners (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    name character varying(255) NOT NULL,
    territory character varying(100) NOT NULL,
    state character varying(50),
    district character varying(100),
    contact_person character varying(100),
    contact_number character varying(20),
    email character varying(100),
    drug_license_no character varying(50),
    drug_license_expiry date,
    gst_registration character varying(50),
    gstin_expiry date,
    credit_limit numeric(15,2) DEFAULT 100000,
    discount_percentage numeric(5,2) DEFAULT 5,
    status character varying(50) DEFAULT 'APPLIED'::character varying,
    partner_grade character varying(20) DEFAULT 'BRONZE'::character varying,
    join_date date,
    assigned_mr_ids uuid[] DEFAULT '{}'::uuid[],
    monopoly_territory character varying(200),
    is_active boolean DEFAULT true,
    created_by uuid,
    updated_by uuid,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    company_id integer DEFAULT 1
);


ALTER TABLE public.pcd_partners OWNER TO postgres;

--
-- Name: pcd_receivables; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.pcd_receivables (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    partner_id uuid NOT NULL,
    invoice_id character varying(100),
    invoice_date date,
    invoice_amount numeric(15,2),
    paid_amount numeric(15,2) DEFAULT 0,
    outstanding_amount numeric(15,2),
    due_date date,
    days_overdue integer,
    status character varying(50) DEFAULT 'OPEN'::character varying,
    credit_limit_exceeded boolean DEFAULT false,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    company_id integer DEFAULT 1
);


ALTER TABLE public.pcd_receivables OWNER TO postgres;

--
-- Name: pcd_schemes; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.pcd_schemes (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    name character varying(255) NOT NULL,
    description text,
    scheme_type character varying(50),
    validity_start date,
    validity_end date,
    minimum_order numeric(15,2),
    discount_percentage numeric(5,2),
    free_products_qty integer DEFAULT 0,
    free_product_name character varying(255),
    bonus_cash numeric(15,2) DEFAULT 0,
    eligibility_criteria character varying(255),
    applicable_partner_grades character varying(100),
    status character varying(50) DEFAULT 'ACTIVE'::character varying,
    created_by uuid,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    company_id integer DEFAULT 1,
    terms text,
    bonus_incentives text,
    target_products text,
    scheme_code character varying(50)
);


ALTER TABLE public.pcd_schemes OWNER TO postgres;

--
-- Name: pcd_targets; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.pcd_targets (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    partner_id uuid NOT NULL,
    period character varying(20),
    period_start date,
    period_end date,
    target_amount numeric(15,2) NOT NULL,
    achieved_amount numeric(15,2) DEFAULT 0,
    incentive_percentage numeric(5,2),
    bonus_amount numeric(15,2) DEFAULT 0,
    status character varying(50) DEFAULT 'PENDING'::character varying,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    company_id integer DEFAULT 1
);


ALTER TABLE public.pcd_targets OWNER TO postgres;

--
-- Name: pcd_transactions; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.pcd_transactions (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    partner_id uuid NOT NULL,
    mr_id uuid,
    order_date date NOT NULL,
    order_amount numeric(15,2),
    product_name character varying(255),
    quantity integer,
    order_status character varying(50) DEFAULT 'VERIFIED'::character varying,
    payment_status character varying(50) DEFAULT 'UNPAID'::character varying,
    scheme_applied_id uuid,
    discount_given numeric(5,2),
    notes text,
    created_by uuid,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    company_id integer DEFAULT 1
);


ALTER TABLE public.pcd_transactions OWNER TO postgres;

--
-- Name: pdc_cheques; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.pdc_cheques (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    company_id integer DEFAULT 1,
    party_id uuid,
    bank_account_id uuid,
    cheque_number character varying(50) NOT NULL,
    cheque_date date NOT NULL,
    amount numeric(15,2) NOT NULL,
    cheque_type character varying(20) NOT NULL,
    status character varying(30) DEFAULT 'Pending'::character varying,
    bounce_reason text,
    narration text,
    journal_voucher_id uuid,
    created_by uuid,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.pdc_cheques OWNER TO postgres;

--
-- Name: pdc_register; Type: TABLE; Schema: public; Owner: erp_user
--

CREATE TABLE public.pdc_register (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    pdc_type character varying(10) NOT NULL,
    party_id uuid NOT NULL,
    cheque_no character varying(50) NOT NULL,
    cheque_date date NOT NULL,
    bank_name character varying(100),
    amount numeric(15,2) NOT NULL,
    narration text,
    status character varying(30) DEFAULT 'PENDING'::character varying,
    receipt_id uuid,
    payment_id uuid,
    deposited_date date,
    bounce_reason text,
    created_at timestamp without time zone DEFAULT now()
);


ALTER TABLE public.pdc_register OWNER TO erp_user;

--
-- Name: pos_bill_items; Type: TABLE; Schema: public; Owner: erp_user
--

CREATE TABLE public.pos_bill_items (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    bill_id uuid NOT NULL,
    product_id uuid NOT NULL,
    product_name character varying(255) NOT NULL,
    hsn_code character varying(20),
    batch_no character varying(100),
    expiry_date date,
    qty numeric(15,3) NOT NULL,
    unit character varying(20) DEFAULT 'NOS'::character varying,
    mrp numeric(15,2) NOT NULL,
    sale_rate numeric(15,2) NOT NULL,
    discount_percent numeric(5,2) DEFAULT 0,
    discount_amount numeric(15,2) DEFAULT 0,
    taxable_value numeric(15,2) NOT NULL,
    gst_percent numeric(5,2) DEFAULT 0,
    cgst_percent numeric(5,2) DEFAULT 0,
    sgst_percent numeric(5,2) DEFAULT 0,
    igst_percent numeric(5,2) DEFAULT 0,
    cgst_amount numeric(15,2) DEFAULT 0,
    sgst_amount numeric(15,2) DEFAULT 0,
    igst_amount numeric(15,2) DEFAULT 0,
    line_total numeric(15,2) NOT NULL,
    created_at timestamp without time zone DEFAULT now(),
    batch_id uuid
);


ALTER TABLE public.pos_bill_items OWNER TO erp_user;

--
-- Name: pos_bills; Type: TABLE; Schema: public; Owner: erp_user
--

CREATE TABLE public.pos_bills (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    bill_no character varying(50) NOT NULL,
    session_id uuid,
    bill_date date DEFAULT CURRENT_DATE NOT NULL,
    party_id uuid,
    patient_name character varying(255),
    doctor_name character varying(255),
    prescription_no character varying(100),
    subtotal numeric(15,2) DEFAULT 0,
    discount_percent numeric(5,2) DEFAULT 0,
    discount_amount numeric(15,2) DEFAULT 0,
    taxable_amount numeric(15,2) DEFAULT 0,
    cgst_amount numeric(15,2) DEFAULT 0,
    sgst_amount numeric(15,2) DEFAULT 0,
    igst_amount numeric(15,2) DEFAULT 0,
    cess_amount numeric(15,2) DEFAULT 0,
    total_tax numeric(15,2) DEFAULT 0,
    round_off numeric(5,2) DEFAULT 0,
    net_payable numeric(15,2) NOT NULL,
    amount_paid numeric(15,2) DEFAULT 0,
    change_returned numeric(15,2) DEFAULT 0,
    payment_status character varying(20) DEFAULT 'PAID'::character varying,
    status character varying(20) DEFAULT 'COMPLETED'::character varying,
    is_gst_bill boolean DEFAULT true,
    customer_state_code character varying(10),
    supply_type character varying(10) DEFAULT 'LOCAL'::character varying,
    voucher_id uuid,
    created_by uuid,
    created_at timestamp without time zone DEFAULT now()
);


ALTER TABLE public.pos_bills OWNER TO erp_user;

--
-- Name: pos_payments; Type: TABLE; Schema: public; Owner: erp_user
--

CREATE TABLE public.pos_payments (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    bill_id uuid NOT NULL,
    payment_mode character varying(30) NOT NULL,
    amount numeric(15,2) NOT NULL,
    reference_no character varying(100),
    payment_date date DEFAULT CURRENT_DATE,
    created_at timestamp without time zone DEFAULT now()
);


ALTER TABLE public.pos_payments OWNER TO erp_user;

--
-- Name: pos_sessions; Type: TABLE; Schema: public; Owner: erp_user
--

CREATE TABLE public.pos_sessions (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    session_date date NOT NULL,
    terminal_id character varying(50) DEFAULT 'MAIN'::character varying,
    opened_by uuid NOT NULL,
    opening_cash numeric(15,2) DEFAULT 0,
    closed_by uuid,
    closing_cash numeric(15,2),
    expected_cash numeric(15,2),
    cash_difference numeric(15,2),
    total_sales numeric(15,2) DEFAULT 0,
    total_returns numeric(15,2) DEFAULT 0,
    total_cash numeric(15,2) DEFAULT 0,
    total_card numeric(15,2) DEFAULT 0,
    total_upi numeric(15,2) DEFAULT 0,
    total_credit numeric(15,2) DEFAULT 0,
    bill_count integer DEFAULT 0,
    status character varying(20) DEFAULT 'OPEN'::character varying,
    z_report_url text,
    opened_at timestamp without time zone DEFAULT now(),
    closed_at timestamp without time zone
);


ALTER TABLE public.pos_sessions OWNER TO erp_user;

--
-- Name: production_orders; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.production_orders (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    order_no character varying(50) NOT NULL,
    product_id uuid,
    bom_id uuid,
    quantity integer NOT NULL,
    status character varying(50) DEFAULT 'Scheduled'::character varying,
    start_date date,
    end_date date,
    created_by uuid,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.production_orders OWNER TO postgres;

--
-- Name: products; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.products (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    code character varying(50),
    name character varying(255) NOT NULL,
    generic_name character varying(255) NOT NULL,
    manufacturer character varying(255) NOT NULL,
    source character varying(50) DEFAULT 'TRADING'::character varying,
    therapeutic_category character varying(100),
    category character varying(100),
    packing character varying(50),
    uom character varying(20) DEFAULT 'Strip'::character varying,
    hsn character varying(20),
    gst numeric(5,2) DEFAULT 12.00,
    min_stock_level integer DEFAULT 50,
    reorder_level integer DEFAULT 100,
    reorder_qty integer DEFAULT 0,
    rack character varying(50),
    schedule_type character varying(20) DEFAULT 'OTC'::character varying,
    is_narcotic boolean DEFAULT false,
    is_temperature_sensitive boolean DEFAULT false,
    purchase_rate numeric(12,2) DEFAULT 0,
    selling_rate numeric(12,2) DEFAULT 0,
    ptr numeric(12,2) DEFAULT 0,
    pts numeric(12,2) DEFAULT 0,
    opening_stock integer DEFAULT 0,
    current_stock integer DEFAULT 0,
    maintain_batches boolean DEFAULT true,
    track_expiry boolean DEFAULT true,
    is_active boolean DEFAULT true,
    last_received_date timestamp without time zone,
    branch_distribution boolean DEFAULT false,
    valuation_method character varying(50) DEFAULT 'FIFO'::character varying,
    default_godown_id uuid,
    deleted_at timestamp without time zone,
    created_by uuid,
    updated_by uuid,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    enable_batch_tracking boolean DEFAULT true,
    enable_serial_tracking boolean DEFAULT false,
    is_fast_moving boolean DEFAULT false,
    min_shelf_life_months integer,
    requires_quality_check boolean DEFAULT false,
    is_compliance_tracked boolean DEFAULT true,
    abc_class character varying(1),
    turnover_ratio numeric(8,2),
    is_slow_moving boolean DEFAULT false,
    mrp numeric(10,2) DEFAULT 0,
    company_id integer DEFAULT 1
);


ALTER TABLE public.products OWNER TO postgres;

--
-- Name: purchase_budgets; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.purchase_budgets (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    category_id character varying(50) NOT NULL,
    period_name character varying(50) NOT NULL,
    budgeted_amount numeric(15,2) NOT NULL,
    spent_amount numeric(15,2) DEFAULT 0,
    committed_amount numeric(15,2) DEFAULT 0,
    status character varying(20) DEFAULT 'Under'::character varying,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.purchase_budgets OWNER TO postgres;

--
-- Name: purchase_invoice_items; Type: TABLE; Schema: public; Owner: erp_user
--

CREATE TABLE public.purchase_invoice_items (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    invoice_id uuid NOT NULL,
    sr_no integer NOT NULL,
    product_id uuid,
    product_name character varying(255) NOT NULL,
    hsn_code character varying(20),
    batch_no character varying(100),
    mfg_date date,
    expiry_date date,
    qty numeric(15,3) NOT NULL,
    unit character varying(20),
    rate numeric(15,4) NOT NULL,
    mrp numeric(15,2),
    discount_percent numeric(5,2) DEFAULT 0,
    taxable_value numeric(15,2) NOT NULL,
    gst_rate numeric(5,2) DEFAULT 0,
    cgst_rate numeric(5,2) DEFAULT 0,
    sgst_rate numeric(5,2) DEFAULT 0,
    igst_rate numeric(5,2) DEFAULT 0,
    cgst_amount numeric(15,2) DEFAULT 0,
    sgst_amount numeric(15,2) DEFAULT 0,
    igst_amount numeric(15,2) DEFAULT 0,
    line_total numeric(15,2) NOT NULL
);


ALTER TABLE public.purchase_invoice_items OWNER TO erp_user;

--
-- Name: purchase_invoices; Type: TABLE; Schema: public; Owner: erp_user
--

CREATE TABLE public.purchase_invoices (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    voucher_no character varying(50) NOT NULL,
    vendor_invoice_no character varying(100),
    invoice_type character varying(20) DEFAULT 'PURCHASE'::character varying,
    invoice_date date NOT NULL,
    due_date date,
    party_id uuid NOT NULL,
    place_of_supply character varying(10),
    subtotal numeric(15,2) DEFAULT 0,
    discount_amount numeric(15,2) DEFAULT 0,
    taxable_amount numeric(15,2) DEFAULT 0,
    cgst numeric(15,2) DEFAULT 0,
    sgst numeric(15,2) DEFAULT 0,
    igst numeric(15,2) DEFAULT 0,
    tds_section character varying(20),
    tds_rate numeric(5,2) DEFAULT 0,
    tds_amount numeric(15,2) DEFAULT 0,
    net_amount numeric(15,2) NOT NULL,
    paid_amount numeric(15,2) DEFAULT 0,
    outstanding numeric(15,2) DEFAULT 0,
    status character varying(20) DEFAULT 'DRAFT'::character varying,
    payment_status character varying(20) DEFAULT 'UNPAID'::character varying,
    voucher_id uuid,
    approved_by uuid,
    approved_at timestamp without time zone,
    created_by uuid,
    created_at timestamp without time zone DEFAULT now()
);


ALTER TABLE public.purchase_invoices OWNER TO erp_user;

--
-- Name: purchase_items; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.purchase_items (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    purchase_id uuid,
    product_id uuid,
    batch_number character varying(50),
    expiry_date date,
    quantity integer NOT NULL,
    purchase_rate numeric(10,2) NOT NULL,
    mrp numeric(10,2),
    gst_percent numeric(5,2) DEFAULT 0,
    amount numeric(12,2) NOT NULL
);


ALTER TABLE public.purchase_items OWNER TO postgres;

--
-- Name: purchase_order_items; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.purchase_order_items (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    po_id uuid,
    product_id uuid,
    quantity integer NOT NULL,
    unit_price numeric(15,2) NOT NULL,
    total_amount numeric(15,2) NOT NULL,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.purchase_order_items OWNER TO postgres;

--
-- Name: purchase_orders; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.purchase_orders (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    company_id integer DEFAULT 1,
    supplier_id uuid,
    po_number character varying(50) NOT NULL,
    date date NOT NULL,
    total_amount numeric(15,2) DEFAULT 0,
    status character varying(50) DEFAULT 'Draft'::character varying,
    created_by uuid,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.purchase_orders OWNER TO postgres;

--
-- Name: purchases; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.purchases (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    supplier_id uuid,
    invoice_number character varying(50),
    date date NOT NULL,
    total_amount numeric(12,2) NOT NULL,
    status character varying(20) DEFAULT 'Received'::character varying,
    payment_status character varying(20) DEFAULT 'Unpaid'::character varying,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.purchases OWNER TO postgres;

--
-- Name: qc_parameters; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.qc_parameters (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    record_id uuid,
    parameter character varying(255) NOT NULL,
    standard character varying(255),
    result character varying(255),
    status character varying(20),
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.qc_parameters OWNER TO postgres;

--
-- Name: qc_records; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.qc_records (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    batch_id uuid,
    batch_number character varying(50) NOT NULL,
    product_name character varying(255) NOT NULL,
    test_date date DEFAULT CURRENT_DATE,
    tested_by uuid,
    final_status character varying(20) DEFAULT 'Pending'::character varying,
    coa_generated boolean DEFAULT false,
    remarks text,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.qc_records OWNER TO postgres;

--
-- Name: qc_reports; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.qc_reports (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    production_order_id uuid,
    batch_number character varying(50),
    test_date date DEFAULT CURRENT_DATE,
    tester_name character varying(100),
    status character varying(20) DEFAULT 'Pending'::character varying,
    overall_result text,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.qc_reports OWNER TO postgres;

--
-- Name: qc_test_results; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.qc_test_results (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    qc_report_id uuid,
    parameter_name character varying(255),
    specification character varying(255),
    result_value character varying(255),
    status character varying(20)
);


ALTER TABLE public.qc_test_results OWNER TO postgres;

--
-- Name: receipt_allocations; Type: TABLE; Schema: public; Owner: erp_user
--

CREATE TABLE public.receipt_allocations (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    receipt_id uuid NOT NULL,
    invoice_id uuid,
    allocated_amount numeric(15,2) NOT NULL,
    created_at timestamp without time zone DEFAULT now()
);


ALTER TABLE public.receipt_allocations OWNER TO erp_user;

--
-- Name: receipt_vouchers; Type: TABLE; Schema: public; Owner: erp_user
--

CREATE TABLE public.receipt_vouchers (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    receipt_no character varying(50) NOT NULL,
    receipt_date date NOT NULL,
    party_id uuid NOT NULL,
    bank_account_id uuid,
    payment_mode character varying(30) NOT NULL,
    amount numeric(15,2) NOT NULL,
    tds_amount numeric(15,2) DEFAULT 0,
    net_received numeric(15,2) NOT NULL,
    cheque_no character varying(50),
    cheque_date date,
    bank_name character varying(100),
    utr_no character varying(100),
    narration text,
    status character varying(20) DEFAULT 'DRAFT'::character varying,
    voucher_id uuid,
    created_by uuid,
    created_at timestamp without time zone DEFAULT now()
);


ALTER TABLE public.receipt_vouchers OWNER TO erp_user;

--
-- Name: reconciliation_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.reconciliation_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.reconciliation_seq OWNER TO postgres;

--
-- Name: recurring_entries; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.recurring_entries (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    company_id integer DEFAULT 1,
    template_name character varying(100) NOT NULL,
    frequency character varying(20) NOT NULL,
    next_run_date date NOT NULL,
    end_date date,
    amount numeric(15,2) NOT NULL,
    debit_account_id uuid,
    credit_account_id uuid,
    narration text,
    is_active boolean DEFAULT true,
    created_by uuid,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.recurring_entries OWNER TO postgres;

--
-- Name: refresh_tokens; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.refresh_tokens (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    user_id uuid NOT NULL,
    token_hash character varying(255) NOT NULL,
    expires_at timestamp without time zone NOT NULL,
    revoked boolean DEFAULT false,
    revoked_at timestamp without time zone,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    ip_address character varying(45),
    user_agent character varying(255)
);


ALTER TABLE public.refresh_tokens OWNER TO postgres;

--
-- Name: reserved_stock; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.reserved_stock (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    company_id integer DEFAULT 1,
    batch_id uuid,
    order_id uuid,
    order_type character varying(50),
    order_number character varying(50),
    qty_reserved integer NOT NULL,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.reserved_stock OWNER TO postgres;

--
-- Name: return_note_items; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.return_note_items (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    return_id uuid,
    product_id uuid,
    batch_id uuid,
    qty_returned integer NOT NULL,
    mrp numeric(10,2),
    purchase_rate numeric(10,2),
    return_reason character varying(100),
    return_value numeric(15,2),
    notes text,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.return_note_items OWNER TO postgres;

--
-- Name: return_notes; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.return_notes (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    company_id integer DEFAULT 1,
    return_number character varying(50) NOT NULL,
    note_type character varying(50) NOT NULL,
    party_id uuid,
    reference_invoice character varying(50),
    reference_invoice_date date,
    return_date date NOT NULL,
    approval_date date,
    received_date date,
    total_qty integer DEFAULT 0,
    total_value numeric(15,2) DEFAULT 0,
    status character varying(50) DEFAULT 'Draft'::character varying,
    reason text,
    rejection_reason text,
    credit_note_id uuid,
    debit_note_id uuid,
    created_by uuid,
    approved_by uuid,
    received_by uuid,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    approved_at timestamp without time zone,
    received_at timestamp without time zone
);


ALTER TABLE public.return_notes OWNER TO postgres;

--
-- Name: rnd_experiments; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.rnd_experiments (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    formulation_id uuid,
    test_name character varying(255) NOT NULL,
    start_date date DEFAULT CURRENT_DATE,
    end_date date,
    assigned_to character varying(255),
    status character varying(50) DEFAULT 'Scheduled'::character varying,
    result_data text,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.rnd_experiments OWNER TO postgres;

--
-- Name: rnd_formulations; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.rnd_formulations (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    product_name character varying(255) NOT NULL,
    dosage_form character varying(50),
    version character varying(20) DEFAULT '1.0'::character varying,
    stage character varying(50) DEFAULT 'Ideation'::character varying,
    start_date date DEFAULT CURRENT_DATE,
    ingredients jsonb DEFAULT '[]'::jsonb,
    target_cost numeric(15,4) DEFAULT 0,
    created_by uuid,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.rnd_formulations OWNER TO postgres;

--
-- Name: sales_invoice_items; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.sales_invoice_items (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    invoice_id uuid,
    product_id uuid,
    batch_id uuid,
    quantity integer NOT NULL,
    free_quantity integer DEFAULT 0,
    mrp numeric(10,2) NOT NULL,
    rate numeric(10,2) NOT NULL,
    discount_percent numeric(5,2) DEFAULT 0,
    discount_amount numeric(10,2) DEFAULT 0,
    taxable_value numeric(10,2) DEFAULT 0,
    gst_percent numeric(5,2) DEFAULT 0,
    cgst_amount numeric(10,2) DEFAULT 0,
    sgst_amount numeric(10,2) DEFAULT 0,
    igst_amount numeric(10,2) DEFAULT 0,
    total_amount numeric(12,2) NOT NULL,
    sales_invoice_id uuid,
    selling_rate numeric(10,2)
);


ALTER TABLE public.sales_invoice_items OWNER TO postgres;

--
-- Name: sales_invoices; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.sales_invoices (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    company_id integer DEFAULT 1,
    party_id uuid,
    invoice_number character varying(50) NOT NULL,
    date date NOT NULL,
    "time" time without time zone DEFAULT CURRENT_TIME,
    customer_name character varying(255),
    customer_mobile character varying(15),
    doctor_name character varying(255),
    payment_mode character varying(20),
    sub_total numeric(12,2) DEFAULT 0,
    taxable_value numeric(12,2) DEFAULT 0,
    total_gst numeric(12,2) DEFAULT 0,
    total_discount numeric(12,2) DEFAULT 0,
    round_off numeric(5,2) DEFAULT 0,
    net_amount numeric(12,2) NOT NULL,
    status character varying(20) DEFAULT 'Completed'::character varying,
    created_by uuid,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_by uuid,
    invoice_no character varying(50),
    invoice_date date,
    net_payable numeric(12,2),
    voucher_id uuid
);


ALTER TABLE public.sales_invoices OWNER TO postgres;

--
-- Name: stock_ledger_detailed; Type: TABLE; Schema: public; Owner: erp_user
--

CREATE TABLE public.stock_ledger_detailed (
    id bigint NOT NULL,
    company_id uuid,
    product_id uuid NOT NULL,
    batch_id uuid NOT NULL,
    godown_id uuid,
    transaction_id uuid NOT NULL,
    transaction_type character varying(50) NOT NULL,
    reference_doc_id uuid,
    reference_doc_type character varying(50),
    quantity_in numeric(15,4) DEFAULT 0,
    quantity_out numeric(15,4) DEFAULT 0,
    unit_cost numeric(18,6) NOT NULL,
    valuation_method character varying(20) NOT NULL,
    value_in numeric(20,2),
    value_out numeric(20,2),
    cumulative_qty numeric(15,4),
    cumulative_value numeric(20,2),
    batch_expiry_date date,
    cost_per_unit_at_time numeric(18,6),
    created_by uuid,
    approved_by uuid,
    approval_date timestamp without time zone,
    remarks text,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.stock_ledger_detailed OWNER TO erp_user;

--
-- Name: stock_ledger_detailed_id_seq; Type: SEQUENCE; Schema: public; Owner: erp_user
--

CREATE SEQUENCE public.stock_ledger_detailed_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.stock_ledger_detailed_id_seq OWNER TO erp_user;

--
-- Name: stock_ledger_detailed_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: erp_user
--

ALTER SEQUENCE public.stock_ledger_detailed_id_seq OWNED BY public.stock_ledger_detailed.id;


--
-- Name: stock_ledger_entries; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.stock_ledger_entries (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    company_id integer DEFAULT 1,
    godown_id uuid,
    product_id uuid,
    batch_id uuid,
    movement_type character varying(10) NOT NULL,
    reference_type character varying(50),
    reference_id uuid,
    reference_number character varying(50),
    in_qty integer DEFAULT 0,
    out_qty integer DEFAULT 0,
    running_balance integer,
    cost_per_unit numeric(15,2),
    total_cost numeric(15,2),
    movement_date date NOT NULL,
    narration text,
    created_by uuid,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.stock_ledger_entries OWNER TO postgres;

--
-- Name: stock_movement_reasons; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.stock_movement_reasons (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    reason_code character varying(50) NOT NULL,
    reason_name character varying(255) NOT NULL,
    movement_category character varying(50),
    description text,
    status character varying(50) DEFAULT 'Active'::character varying,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.stock_movement_reasons OWNER TO postgres;

--
-- Name: stock_reconciliation; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.stock_reconciliation (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    company_id integer DEFAULT 1,
    godown_id uuid,
    reconciliation_number character varying(50) NOT NULL,
    reconciliation_date date NOT NULL,
    reconciliation_period_from date,
    reconciliation_period_to date,
    status character varying(50) DEFAULT 'Draft'::character varying,
    total_system_qty integer DEFAULT 0,
    total_physical_qty integer DEFAULT 0,
    total_variance_qty integer DEFAULT 0,
    total_variance_value numeric(15,2) DEFAULT 0,
    created_by uuid,
    verified_by uuid,
    approved_by uuid,
    rejection_reason text,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    verified_at timestamp without time zone,
    approved_at timestamp without time zone
);


ALTER TABLE public.stock_reconciliation OWNER TO postgres;

--
-- Name: stock_reconciliation_items; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.stock_reconciliation_items (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    reconciliation_id uuid,
    product_id uuid,
    batch_id uuid,
    system_qty integer DEFAULT 0,
    physical_qty integer DEFAULT 0,
    variance_qty integer DEFAULT 0,
    variance_reason character varying(100),
    variance_value numeric(15,2) DEFAULT 0,
    notes text,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.stock_reconciliation_items OWNER TO postgres;

--
-- Name: supplier_invoices; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.supplier_invoices (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    supplier_id uuid,
    invoice_number character varying(100) NOT NULL,
    invoice_date date NOT NULL,
    due_date date,
    total_amount numeric(15,2) NOT NULL,
    tax_amount numeric(15,2) DEFAULT 0,
    status character varying(20) DEFAULT 'Pending'::character varying,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.supplier_invoices OWNER TO postgres;

--
-- Name: suppliers; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.suppliers (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    name character varying(255) NOT NULL,
    gstin character varying(20)
);


ALTER TABLE public.suppliers OWNER TO postgres;

--
-- Name: tax_configurations; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.tax_configurations (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    tax_type character varying(20) NOT NULL,
    tax_name character varying(100) NOT NULL,
    rate numeric(5,2) NOT NULL,
    account_id uuid NOT NULL,
    is_active boolean DEFAULT true,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.tax_configurations OWNER TO postgres;

--
-- Name: tds_entries; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.tds_entries (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    company_id integer DEFAULT 1,
    invoice_id uuid,
    tds_section character varying(50),
    tds_rate numeric(5,2),
    tds_amount numeric(15,2),
    payment_date date,
    created_by uuid,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.tds_entries OWNER TO postgres;

--
-- Name: temperature_logs; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.temperature_logs (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    log_date date DEFAULT CURRENT_DATE,
    log_time time without time zone DEFAULT CURRENT_TIME,
    temperature numeric(4,2) NOT NULL,
    checked_by character varying(255),
    equipment_name character varying(255) DEFAULT 'Main Refrigerator'::character varying,
    status character varying(50),
    remarks text,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    created_by uuid,
    CONSTRAINT chk_temp_status CHECK (((status)::text = ANY ((ARRAY['OK'::character varying, 'Warning'::character varying, 'Critical'::character varying])::text[])))
);


ALTER TABLE public.temperature_logs OWNER TO postgres;

--
-- Name: three_way_matches; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.three_way_matches (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    purchase_order_id uuid,
    grn_id uuid,
    invoice_id uuid,
    match_status character varying(20) DEFAULT 'Matched'::character varying,
    variance_amount numeric(15,2) DEFAULT 0,
    remarks text,
    verified_by uuid,
    verified_at timestamp without time zone,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.three_way_matches OWNER TO postgres;

--
-- Name: users; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.users (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    username character varying(50) NOT NULL,
    password_hash character varying(255) NOT NULL,
    name character varying(100) NOT NULL,
    role character varying(50) NOT NULL,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    email character varying(100),
    two_factor_enabled boolean DEFAULT false,
    totp_secret character varying(255),
    phone character varying(15),
    last_login timestamp without time zone,
    last_login_ip character varying(45),
    login_attempts integer DEFAULT 0,
    locked_until timestamp without time zone,
    otp_code character varying(6),
    otp_expires_at timestamp without time zone,
    last_device_fingerprint character varying(255),
    risk_score numeric(5,2) DEFAULT 0.0,
    created_by uuid,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.users OWNER TO postgres;

--
-- Name: valuation_configurations; Type: TABLE; Schema: public; Owner: erp_user
--

CREATE TABLE public.valuation_configurations (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    company_id uuid,
    default_method character varying(20) DEFAULT 'WAC'::character varying NOT NULL,
    method_by_product_category boolean DEFAULT true,
    round_to_nearest integer DEFAULT 2,
    rounding_method character varying(20) DEFAULT 'BANKER'::character varying,
    closing_method character varying(20) DEFAULT 'PERIODIC'::character varying,
    valuation_period integer DEFAULT 1,
    include_gst_in_valuation boolean DEFAULT true,
    enforce_batch_expiry boolean DEFAULT true,
    track_landed_cost boolean DEFAULT true,
    allow_negative_stock boolean DEFAULT false,
    require_approval_on_adjustment boolean DEFAULT true,
    require_approval_on_return boolean DEFAULT true,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.valuation_configurations OWNER TO erp_user;

--
-- Name: valuation_methods; Type: TABLE; Schema: public; Owner: erp_user
--

CREATE TABLE public.valuation_methods (
    id integer NOT NULL,
    code character varying(20) NOT NULL,
    name character varying(100) NOT NULL,
    description text,
    enabled boolean DEFAULT true,
    is_default boolean DEFAULT false,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.valuation_methods OWNER TO erp_user;

--
-- Name: valuation_methods_id_seq; Type: SEQUENCE; Schema: public; Owner: erp_user
--

CREATE SEQUENCE public.valuation_methods_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.valuation_methods_id_seq OWNER TO erp_user;

--
-- Name: valuation_methods_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: erp_user
--

ALTER SEQUENCE public.valuation_methods_id_seq OWNED BY public.valuation_methods.id;


--
-- Name: vendor_ratings; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.vendor_ratings (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    supplier_id uuid,
    quality_score numeric(3,2) DEFAULT 5.0,
    delivery_score numeric(3,2) DEFAULT 5.0,
    price_score numeric(3,2) DEFAULT 5.0,
    service_score numeric(3,2) DEFAULT 5.0,
    overall_rating numeric(3,2) DEFAULT 5.0,
    on_time_delivery_rate numeric(5,2) DEFAULT 100.0,
    total_transactions integer DEFAULT 0,
    last_evaluated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.vendor_ratings OWNER TO postgres;

--
-- Name: voucher_types; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.voucher_types (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    name character varying(100) NOT NULL,
    alias character varying(100),
    type_of_voucher character varying(50),
    abbreviation character varying(20),
    method_of_voucher_numbering character varying(50) DEFAULT 'Automatic'::character varying,
    use_effective_dates boolean DEFAULT false,
    make_optional_by_default boolean DEFAULT false,
    allow_narration boolean DEFAULT true,
    provide_narrations_for_each_ledger boolean DEFAULT false,
    print_after_saving boolean DEFAULT false,
    name_of_class character varying(100),
    is_active boolean DEFAULT true,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.voucher_types OWNER TO postgres;

--
-- Name: vw_profit_loss; Type: VIEW; Schema: public; Owner: postgres
--

CREATE VIEW public.vw_profit_loss AS
 SELECT coa.account_type,
    coa.account_name,
    coa.company_id,
    COALESCE(sum((gl.debit - gl.credit)), (0)::numeric) AS amount
   FROM (public.chart_of_accounts coa
     JOIN public.general_ledger gl ON ((coa.id = gl.account_id)))
  WHERE ((coa.account_type)::text = ANY ((ARRAY['Income'::character varying, 'Expense'::character varying])::text[]))
  GROUP BY coa.account_type, coa.account_name, coa.company_id;


ALTER VIEW public.vw_profit_loss OWNER TO postgres;

--
-- Name: vw_trial_balance; Type: VIEW; Schema: public; Owner: postgres
--

CREATE VIEW public.vw_trial_balance AS
 SELECT coa.id AS account_id,
    coa.account_code,
    coa.account_name,
    coa.account_type,
    coa.company_id,
    COALESCE(sum(gl.debit), (0)::numeric) AS total_debit,
    COALESCE(sum(gl.credit), (0)::numeric) AS total_credit,
    COALESCE(sum((gl.debit - gl.credit)), (0)::numeric) AS net_balance
   FROM (public.chart_of_accounts coa
     LEFT JOIN public.general_ledger gl ON ((coa.id = gl.account_id)))
  GROUP BY coa.id, coa.account_code, coa.account_name, coa.account_type, coa.company_id;


ALTER VIEW public.vw_trial_balance OWNER TO postgres;

--
-- Name: batch_valuation_history id; Type: DEFAULT; Schema: public; Owner: erp_user
--

ALTER TABLE ONLY public.batch_valuation_history ALTER COLUMN id SET DEFAULT nextval('public.batch_valuation_history_id_seq'::regclass);


--
-- Name: compliance_notification_log id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.compliance_notification_log ALTER COLUMN id SET DEFAULT nextval('public.compliance_notification_log_id_seq'::regclass);


--
-- Name: compliance_notification_settings id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.compliance_notification_settings ALTER COLUMN id SET DEFAULT nextval('public.compliance_notification_settings_id_seq'::regclass);


--
-- Name: crm_audit_log id; Type: DEFAULT; Schema: public; Owner: erp_user
--

ALTER TABLE ONLY public.crm_audit_log ALTER COLUMN id SET DEFAULT nextval('public.crm_audit_log_id_seq'::regclass);


--
-- Name: dms_audit_trail id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.dms_audit_trail ALTER COLUMN id SET DEFAULT nextval('public.dms_audit_trail_id_seq'::regclass);


--
-- Name: dms_versions id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.dms_versions ALTER COLUMN id SET DEFAULT nextval('public.dms_versions_id_seq'::regclass);


--
-- Name: dms_workflows id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.dms_workflows ALTER COLUMN id SET DEFAULT nextval('public.dms_workflows_id_seq'::regclass);


--
-- Name: stock_ledger_detailed id; Type: DEFAULT; Schema: public; Owner: erp_user
--

ALTER TABLE ONLY public.stock_ledger_detailed ALTER COLUMN id SET DEFAULT nextval('public.stock_ledger_detailed_id_seq'::regclass);


--
-- Name: valuation_methods id; Type: DEFAULT; Schema: public; Owner: erp_user
--

ALTER TABLE ONLY public.valuation_methods ALTER COLUMN id SET DEFAULT nextval('public.valuation_methods_id_seq'::regclass);


--
-- Data for Name: stg_chart_of_accounts; Type: TABLE DATA; Schema: accounts_staging; Owner: postgres
--

COPY accounts_staging.stg_chart_of_accounts (staging_id, batch_id, import_status, error_message, raw_data, company_id, account_code, account_name, account_type, account_group, opening_balance, current_balance, currency, status, gst_applicable, tds_applicable, is_bank_or_cash, parent_account_code, created_at, processed_at) FROM stdin;
\.


--
-- Data for Name: stg_parties; Type: TABLE DATA; Schema: accounts_staging; Owner: postgres
--

COPY accounts_staging.stg_parties (staging_id, batch_id, import_status, error_message, raw_data, company_id, party_type, name, gstin, pan, email, mobile, address, state_code, account_code, credit_limit, credit_days, opening_balance, current_balance, created_at, processed_at) FROM stdin;
\.


--
-- Data for Name: stg_voucher_entries; Type: TABLE DATA; Schema: accounts_staging; Owner: postgres
--

COPY accounts_staging.stg_voucher_entries (staging_id, batch_id, import_status, error_message, raw_data, voucher_no, account_code, party_gstin, debit, credit, narration, cost_center, created_at, processed_at) FROM stdin;
\.


--
-- Data for Name: stg_vouchers; Type: TABLE DATA; Schema: accounts_staging; Owner: postgres
--

COPY accounts_staging.stg_vouchers (staging_id, batch_id, import_status, error_message, raw_data, company_id, voucher_no, voucher_date, voucher_type, narration, total_debit, total_credit, status, reference_number, created_at, processed_at) FROM stdin;
\.


--
-- Data for Name: abc_analysis; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.abc_analysis (id, company_id, analysis_period_start, analysis_period_end, analysis_run_date, analysis_method, abc_threshold_a, abc_threshold_b, total_products, total_inventory_value, total_annual_turns, class_a_count, class_a_value, class_b_count, class_b_value, class_c_count, class_c_value, status, created_by, created_at) FROM stdin;
\.


--
-- Data for Name: abc_classification; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.abc_classification (id, abc_analysis_id, product_id, class, classification_date, annual_consumption, annual_consumption_value, avg_unit_cost, consumption_percentage, cumulative_percentage, reorder_point, reorder_quantity, safety_stock, review_frequency, created_at) FROM stdin;
\.


--
-- Data for Name: acc_anomalies; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.acc_anomalies (id, anomaly_type, severity, voucher_id, gl_id, user_id, description, amount, confidence_score, status, reviewed_by, reviewed_at, review_notes, detected_at, created_at) FROM stdin;
\.


--
-- Data for Name: acc_bank_statement_lines; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.acc_bank_statement_lines (id, statement_id, transaction_date, value_date, description, reference_no, debit, credit, balance, match_status, match_confidence, matched_gl_id, matched_voucher_id, matched_by, matched_at, created_at) FROM stdin;
\.


--
-- Data for Name: acc_bank_statements; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.acc_bank_statements (id, account_id, bank_name, account_number, statement_date, opening_balance, closing_balance, total_credits, total_debits, import_source, file_url, imported_by, imported_at, status) FROM stdin;
\.


--
-- Data for Name: acc_cash_flow_forecast; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.acc_cash_flow_forecast (id, forecast_date, week_number, forecast_type, description, expected_inflow, expected_outflow, net_cash_flow, opening_balance, closing_balance, actual_inflow, actual_outflow, variance, generated_by, generated_at) FROM stdin;
\.


--
-- Data for Name: acc_close_checklist; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.acc_close_checklist (id, period_id, checklist_item, sort_order, is_completed, completed_by, completed_at, notes, created_at) FROM stdin;
\.


--
-- Data for Name: acc_dunning_log; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.acc_dunning_log (id, party_id, party_name, rule_id, invoice_ref, outstanding_amount, days_overdue, action_taken, message_sent, sent_to, status, response_notes, executed_by, executed_at) FROM stdin;
\.


--
-- Data for Name: acc_dunning_rules; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.acc_dunning_rules (id, rule_name, days_overdue_from, days_overdue_to, action_type, message_template, escalate_to_role, is_active, created_by, created_at) FROM stdin;
f0968c70-b0b6-4de2-94ae-21a26ccd5e4b	Friendly Reminder	0	6	EMAIL	Dear {party}, your invoice {invoice_no} of ₹{amount} was due on {due_date}. Please arrange payment at earliest.	\N	t	\N	2026-05-26 23:39:23.746291
2739ab42-e6e0-4ce5-902e-02cee8b5a8c9	First Follow-up	7	14	EMAIL	Dear {party}, invoice {invoice_no} (₹{amount}) is now {days} days overdue. Please pay immediately to avoid service disruption.	\N	t	\N	2026-05-26 23:39:23.746291
8a35f4ea-469f-4572-b14d-9ab99dcb7f4a	Urgent Notice	15	29	WHATSAPP	URGENT: Invoice {invoice_no} (₹{amount}) is {days} days overdue. Payment required within 48 hours.	\N	t	\N	2026-05-26 23:39:23.746291
9851afd1-219c-453a-876c-c187e3f96b62	Final Warning	30	44	EMAIL	FINAL WARNING: Invoice {invoice_no} (₹{amount}) is {days} days overdue. Legal action will commence if not paid within 7 days.	\N	t	\N	2026-05-26 23:39:23.746291
12a4ab04-4727-473a-bbfc-9f8095f2febc	Order Hold	45	59	HOLD_ORDERS	Orders placed on hold due to {days}+ days overdue balance of ₹{amount}.	\N	t	\N	2026-05-26 23:39:23.746291
0613b75c-09da-4872-838e-b973cb1b270b	Legal Notice	60	\N	LEGAL_NOTICE	Your account has been referred for legal recovery. Outstanding: ₹{amount} ({days} days overdue).	\N	t	\N	2026-05-26 23:39:23.746291
\.


--
-- Data for Name: acc_fx_revaluation_log; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.acc_fx_revaluation_log (id, revaluation_date, account_id, currency_code, original_balance, fx_rate_used, revalued_balance_inr, gain_loss, voucher_id, created_by, created_at) FROM stdin;
\.


--
-- Data for Name: acc_payment_run_items; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.acc_payment_run_items (id, run_id, vendor_id, vendor_name, invoice_ref, invoice_date, invoice_amount, tds_rate, tds_amount, net_payment, bank_account_no, ifsc_code, beneficiary_name, payment_ref, status, voucher_id, created_at) FROM stdin;
\.


--
-- Data for Name: acc_payment_runs; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.acc_payment_runs (id, run_name, payment_date, payment_mode, bank_account_id, total_amount, total_invoices, tds_deducted, net_payable, status, file_generated, file_url, approved_by, approved_at, processed_by, processed_at, created_by, created_at) FROM stdin;
\.


--
-- Data for Name: acc_periods; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.acc_periods (id, financial_year_id, period_name, period_number, start_date, end_date, status, closed_by, closed_at, locked_by, locked_at, checklist_completed, notes, created_at) FROM stdin;
759178dc-8459-4639-920a-1eb3b14eeb86	5dfbdc55-2cea-422b-a641-7a185168dd84	April     2025	1	2025-04-01	2025-04-30	OPEN	\N	\N	\N	\N	f	\N	2026-05-26 23:39:23.784856
9c4b9c8e-acfd-4b0d-9ece-c3f6b31b5966	5dfbdc55-2cea-422b-a641-7a185168dd84	May       2025	2	2025-05-01	2025-05-31	OPEN	\N	\N	\N	\N	f	\N	2026-05-26 23:39:23.784856
1712cfc2-d5ff-4298-8693-f52506609673	5dfbdc55-2cea-422b-a641-7a185168dd84	June      2025	3	2025-06-01	2025-06-30	OPEN	\N	\N	\N	\N	f	\N	2026-05-26 23:39:23.784856
7683a2f3-3c6b-4432-97eb-7ea816be3db6	5dfbdc55-2cea-422b-a641-7a185168dd84	July      2025	4	2025-07-01	2025-07-31	OPEN	\N	\N	\N	\N	f	\N	2026-05-26 23:39:23.784856
357e6b1b-6a66-4e40-abb7-1297055f489d	5dfbdc55-2cea-422b-a641-7a185168dd84	August    2025	5	2025-08-01	2025-08-31	OPEN	\N	\N	\N	\N	f	\N	2026-05-26 23:39:23.784856
28507e72-6bfa-432d-8709-06b74b6c0543	5dfbdc55-2cea-422b-a641-7a185168dd84	September 2025	6	2025-09-01	2025-09-30	OPEN	\N	\N	\N	\N	f	\N	2026-05-26 23:39:23.784856
72d5238d-40a2-43c6-a3e0-38c62bdee98a	5dfbdc55-2cea-422b-a641-7a185168dd84	October   2025	7	2025-10-01	2025-10-31	OPEN	\N	\N	\N	\N	f	\N	2026-05-26 23:39:23.784856
a9396903-d7e7-4eb9-baea-75d020fd545d	5dfbdc55-2cea-422b-a641-7a185168dd84	November  2025	8	2025-11-01	2025-11-30	OPEN	\N	\N	\N	\N	f	\N	2026-05-26 23:39:23.784856
d4c8e97f-2039-420c-b498-6b0a8895e06f	5dfbdc55-2cea-422b-a641-7a185168dd84	December  2025	9	2025-12-01	2025-12-31	OPEN	\N	\N	\N	\N	f	\N	2026-05-26 23:39:23.784856
c2522c02-7fc5-4b9d-ac9b-b3c23c085cfc	5dfbdc55-2cea-422b-a641-7a185168dd84	January   2026	10	2026-01-01	2026-01-31	OPEN	\N	\N	\N	\N	f	\N	2026-05-26 23:39:23.784856
d47c06ba-f3e2-435f-bed1-bf68ea29a816	5dfbdc55-2cea-422b-a641-7a185168dd84	February  2026	11	2026-02-01	2026-02-28	OPEN	\N	\N	\N	\N	f	\N	2026-05-26 23:39:23.784856
3a715a34-11df-47d3-9cf8-a0b39acc1b88	5dfbdc55-2cea-422b-a641-7a185168dd84	March     2026	12	2026-03-01	2026-03-31	OPEN	\N	\N	\N	\N	f	\N	2026-05-26 23:39:23.784856
\.


--
-- Data for Name: acc_ratios_cache; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.acc_ratios_cache (id, as_of_date, current_ratio, quick_ratio, debt_equity_ratio, gross_profit_margin, net_profit_margin, return_on_equity, return_on_capital_employed, debtor_days, creditor_days, inventory_turnover, interest_coverage_ratio, working_capital, computed_at) FROM stdin;
\.


--
-- Data for Name: acc_tally_sync_log; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.acc_tally_sync_log (id, sync_direction, sync_type, file_name, file_url, total_records, success_count, error_count, errors, status, started_at, completed_at, created_by, created_at) FROM stdin;
\.


--
-- Data for Name: api_keys; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.api_keys (id, user_id, name, key_hash, permissions, rate_limit, active, last_used, created_at, expires_at) FROM stdin;
\.


--
-- Data for Name: approval_workflows; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.approval_workflows (id, document_type, document_id, current_level, total_levels, status, created_at) FROM stdin;
\.


--
-- Data for Name: asset_alerts; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.asset_alerts (id, asset_id, type, priority, message, due_date, status, created_at) FROM stdin;
\.


--
-- Data for Name: asset_categories; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.asset_categories (id, name, description, icon, useful_life_years, depreciation_rate, created_at) FROM stdin;
13a3a027-6594-43cb-902f-3994b1dee685	Machinery	Production and plant machinery	Cog	10	15.00	2026-05-22 17:51:18.062132
099df7ed-6c8a-42ab-a39b-4e694fe2c230	Vehicle	Company owned transport and logistics	Truck	8	20.00	2026-05-22 17:51:18.062132
109c4aa3-6d84-4c2f-86cb-fa2438ac84cc	IT	Laptops, Servers, and Networking infrastructure	Monitor	3	40.00	2026-05-22 17:51:18.062132
d3ce5f70-51e1-4ced-88de-d999974b1dc0	Furniture	Office furniture and fixtures	Layout	10	10.00	2026-05-22 17:51:18.062132
\.


--
-- Data for Name: asset_insurance_policies; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.asset_insurance_policies (id, asset_id, policy_number, insurance_company, coverage_amount, premium_amount, issue_date, expiry_date, status, documents_url, created_at) FROM stdin;
\.


--
-- Data for Name: asset_maintenance_logs; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.asset_maintenance_logs (id, asset_id, maintenance_date, type, description, cost, performed_by, vendor_id, status, created_at) FROM stdin;
\.


--
-- Data for Name: asset_transfers; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.asset_transfers (id, asset_id, from_location, to_location, transfer_date, reason, approved_by, status, created_at) FROM stdin;
\.


--
-- Data for Name: audit_log_accounting; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.audit_log_accounting (id, company_id, table_name, record_id, action, old_value, new_value, user_id, ip_address, "timestamp") FROM stdin;
\.


--
-- Data for Name: audit_logs; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.audit_logs (id, user_id, action, module, table_name, record_id, changes, status, error_message, ip_address, user_agent, created_at) FROM stdin;
\.


--
-- Data for Name: bank_reconciliation; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.bank_reconciliation (id, company_id, bank_account_id, bank_statement_date, bank_balance, gl_balance, variance, status, created_by, created_at) FROM stdin;
\.


--
-- Data for Name: bank_reconciliations; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.bank_reconciliations (id, company_id, account_id, statement_date, closing_balance_per_bank, closing_balance_per_books, unreconciled_difference, reconciliation_status, created_by, created_at) FROM stdin;
\.


--
-- Data for Name: batch_valuation_history; Type: TABLE DATA; Schema: public; Owner: erp_user
--

COPY public.batch_valuation_history (id, batch_id, valuation_date, valuation_method, previous_cost, current_cost, cost_change, cost_change_reason, quantity_on_hand, inventory_value, changed_by, reason_code, created_at) FROM stdin;
\.


--
-- Data for Name: batches; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.batches (id, product_id, batch_number, expiry_date, manufacturing_date, stock, mrp, purchase_rate, selling_rate, location, created_at, godown_id, status, reserved_qty, damaged_qty, ptr_rate, landed_cost, shelf_location, cumulative_valuation_cost, compliance_status, compliance_remarks) FROM stdin;
44444444-4444-4444-4444-444444444441	33333333-3333-3333-3333-333333333331	B-DOLO-001	2028-05-22	2026-04-22	500	30.00	20.00	25.00	RACK-A1	2026-05-22 17:51:18.47143	\N	In Stock	0	0	\N	\N	\N	\N	COMPLIANT	\N
44444444-4444-4444-4444-444444444442	33333333-3333-3333-3333-333333333332	B-AUG-001	2027-05-22	2026-03-22	200	200.00	150.00	180.00	RACK-A2	2026-05-22 17:51:18.47143	\N	In Stock	0	0	\N	\N	\N	\N	COMPLIANT	\N
44444444-4444-4444-4444-444444444443	33333333-3333-3333-3333-333333333333	B-COR-001	2027-11-22	2026-04-22	100	115.00	85.00	100.00	RACK-B1	2026-05-22 17:51:18.47143	\N	In Stock	0	0	\N	\N	\N	\N	COMPLIANT	\N
44444444-4444-4444-4444-444444444444	33333333-3333-3333-3333-333333333334	B-PAN-001	2029-05-22	2025-11-22	300	150.00	100.00	130.00	RACK-C1	2026-05-22 17:51:18.47143	\N	In Stock	0	0	\N	\N	\N	\N	COMPLIANT	\N
44444444-4444-4444-4444-444444444445	33333333-3333-3333-3333-333333333335	B-META-001	2028-05-22	2026-05-22	1000	250.00	100.00	200.00	RACK-M1	2026-05-22 17:51:18.47143	\N	In Stock	0	0	\N	\N	\N	\N	COMPLIANT	\N
c7801adb-971a-47c3-a725-c410f39d57f1	8c2abe12-1114-4dfa-b5bc-7ad5fa276f0d	MM2601	2027-05-31	\N	1000	30.00	18.00	25.00	\N	2026-05-29 11:46:18.209639	\N	In Stock	0	0	\N	\N	\N	\N	COMPLIANT	\N
56582867-12a7-41af-9453-b015f14065a1	8c2abe12-1114-4dfa-b5bc-7ad5fa276f0d	MM2602	2026-08-15	\N	200	30.00	18.00	25.00	\N	2026-05-29 11:46:18.209639	\N	In Stock	0	0	\N	\N	\N	\N	COMPLIANT	\N
cbb6eebd-7e1c-4581-afe3-71677c78b2bf	24547ecb-5d6e-49a1-931e-cb188f20e682	MC26A	2027-12-31	\N	500	200.00	140.00	180.00	\N	2026-05-29 11:46:18.209639	\N	In Stock	0	0	\N	\N	\N	\N	COMPLIANT	\N
ced5c02f-aefb-4f5f-9b54-f9202df953d0	0334d868-6c8d-4e1d-b8df-cbc1533a8855	MP99X	2028-01-20	\N	800	150.00	90.00	130.00	\N	2026-05-29 11:46:18.209639	\N	In Stock	0	0	\N	\N	\N	\N	COMPLIANT	\N
\.


--
-- Data for Name: boms; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.boms (id, product_id, version, status, created_at) FROM stdin;
\.


--
-- Data for Name: branches; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.branches (id, name, type, location, city, state, manager, contact, is_hq, created_at) FROM stdin;
\.


--
-- Data for Name: budgets; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.budgets (id, company_id, cost_center_id, account_id, budget_amount, period_from, period_to, actual_amount, variance, created_by, created_at) FROM stdin;
\.


--
-- Data for Name: chart_of_accounts; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.chart_of_accounts (id, company_id, account_code, account_name, account_type, account_group, opening_balance, current_balance, description, status, gst_applicable, tds_applicable, is_bank_or_cash, account_format, reconciliation_status, cost_center_id, parent_account_id, created_by, created_at, updated_at, alias, inventory_affected, ledger_type, activate_interest, mailing_name, mailing_address, mailing_country, mailing_state, provide_bank_details, pan_it_no, currency_code, foreign_balance, gstin) FROM stdin;
88888888-8888-8888-8888-888888888881	1	ASST-001	Cash in Hand	Asset	Current Assets	50000.00	0.00	\N	Active	f	f	f	debit	Pending	\N	\N	\N	2026-05-22 17:51:18.47691	2026-05-22 17:51:18.47691	\N	f	\N	f	\N	\N	India	\N	f	\N	INR	0.00	\N
88888888-8888-8888-8888-888888888883	1	INC-001	Sales Account	Income	Direct Income	0.00	0.00	\N	Active	f	f	f	credit	Pending	\N	\N	\N	2026-05-22 17:51:18.47691	2026-05-22 17:51:18.47691	\N	f	\N	f	\N	\N	India	\N	f	\N	INR	0.00	\N
88888888-8888-8888-8888-888888888884	1	EXP-001	Purchase Account	Expense	Direct Expenses	0.00	0.00	\N	Active	f	f	f	debit	Pending	\N	\N	\N	2026-05-22 17:51:18.47691	2026-05-22 17:51:18.47691	\N	f	\N	f	\N	\N	India	\N	f	\N	INR	0.00	\N
88888888-8888-8888-8888-888888888885	1	EXP-002	Rent Expense	Expense	Indirect Expenses	0.00	15000.00	\N	Active	f	f	f	debit	Pending	\N	\N	\N	2026-05-22 17:51:18.47691	2026-05-22 17:51:18.478615	\N	f	\N	f	\N	\N	India	\N	f	\N	INR	0.00	\N
88888888-8888-8888-8888-888888888882	1	ASST-002	HDFC Bank C/A	Asset	Bank Accounts	250000.00	235000.00	\N	Active	f	f	f	debit	Pending	\N	\N	\N	2026-05-22 17:51:18.47691	2026-05-22 17:51:18.478615	\N	f	\N	f	\N	\N	India	\N	f	\N	INR	0.00	\N
f477417a-e59f-4dd0-bcd3-1837daa744b1	1	1002	HDFC Bank Current A/c	Asset	Bank Accounts	500000.00	0.00	\N	Active	f	f	t	debit	Pending	\N	\N	\N	2026-05-29 11:46:18.201946	2026-05-29 11:46:18.201946	\N	f	\N	f	\N	\N	India	\N	f	\N	INR	0.00	\N
28fdf1a5-ce47-4435-addc-480b00eabf6b	1	2001	Sales Account	Income	Sales Accounts	0.00	0.00	\N	Active	f	f	f	debit	Pending	\N	\N	\N	2026-05-29 11:46:18.201946	2026-05-29 11:46:18.201946	\N	f	\N	f	\N	\N	India	\N	f	\N	INR	0.00	\N
a981e8b5-72b9-492b-826b-0b312c4687e9	1	3001	Purchase Account	Expense	Purchase Accounts	0.00	0.00	\N	Active	f	f	f	debit	Pending	\N	\N	\N	2026-05-29 11:46:18.201946	2026-05-29 11:46:18.201946	\N	f	\N	f	\N	\N	India	\N	f	\N	INR	0.00	\N
dbf61d9a-bf46-467f-99bc-9fc2465784f2	1	4001	CGST Input	Asset	Duties & Taxes	0.00	0.00	\N	Active	f	f	f	debit	Pending	\N	\N	\N	2026-05-29 11:46:18.201946	2026-05-29 11:46:18.201946	\N	f	\N	f	\N	\N	India	\N	f	\N	INR	0.00	\N
de9aa53d-8ef7-4799-8800-65ee6f8884b1	1	4002	SGST Input	Asset	Duties & Taxes	0.00	0.00	\N	Active	f	f	f	debit	Pending	\N	\N	\N	2026-05-29 11:46:18.201946	2026-05-29 11:46:18.201946	\N	f	\N	f	\N	\N	India	\N	f	\N	INR	0.00	\N
84e7fe68-327e-4403-9644-28c302afd97c	1	4003	IGST Input	Asset	Duties & Taxes	0.00	0.00	\N	Active	f	f	f	debit	Pending	\N	\N	\N	2026-05-29 11:46:18.201946	2026-05-29 11:46:18.201946	\N	f	\N	f	\N	\N	India	\N	f	\N	INR	0.00	\N
8891382c-0ebe-4814-bd4a-fecf61512791	1	5001	CGST Output	Liability	Duties & Taxes	0.00	0.00	\N	Active	f	f	f	debit	Pending	\N	\N	\N	2026-05-29 11:46:18.201946	2026-05-29 11:46:18.201946	\N	f	\N	f	\N	\N	India	\N	f	\N	INR	0.00	\N
9ce6ad5a-4104-41aa-9e32-62427b8de9f2	1	5002	SGST Output	Liability	Duties & Taxes	0.00	0.00	\N	Active	f	f	f	debit	Pending	\N	\N	\N	2026-05-29 11:46:18.201946	2026-05-29 11:46:18.201946	\N	f	\N	f	\N	\N	India	\N	f	\N	INR	0.00	\N
7b3879c3-f7fc-4ba7-b4ff-043a80fcfcbe	1	5003	IGST Output	Liability	Duties & Taxes	0.00	0.00	\N	Active	f	f	f	debit	Pending	\N	\N	\N	2026-05-29 11:46:18.201946	2026-05-29 11:46:18.201946	\N	f	\N	f	\N	\N	India	\N	f	\N	INR	0.00	\N
4e99fc78-2b3c-40d9-bde8-baccad80c996	1	6001	TDS Payable (194Q)	Liability	Duties & Taxes	0.00	0.00	\N	Active	f	f	f	debit	Pending	\N	\N	\N	2026-05-29 11:46:18.201946	2026-05-29 11:46:18.201946	\N	f	\N	f	\N	\N	India	\N	f	\N	INR	0.00	\N
e5aa3710-53b5-41ca-b37e-152224cb5f1b	1	SYS-200001	Sales Revenue	Income	Direct Income	0.00	-2950.90	\N	Active	f	f	f	credit	Pending	\N	\N	\N	2026-05-29 15:08:11.43881	2026-05-29 15:08:23.960675	\N	f	\N	f	\N	\N	India	\N	f	\N	INR	0.00	\N
36ac5938-f7a5-4d64-a7f0-e4cc4196edb8	1	SYS-300002	CGST Payable	Liability	Duties & Taxes	0.00	-177.05	\N	Active	f	f	f	credit	Pending	\N	\N	\N	2026-05-29 15:08:11.43881	2026-05-29 15:08:23.960675	\N	f	\N	f	\N	\N	India	\N	f	\N	INR	0.00	\N
6e40e9fa-4c85-4793-ab2c-03bdad214550	1	SYS-300003	SGST Payable	Liability	Duties & Taxes	0.00	-177.05	\N	Active	f	f	f	credit	Pending	\N	\N	\N	2026-05-29 15:08:11.43881	2026-05-29 15:08:23.960675	\N	f	\N	f	\N	\N	India	\N	f	\N	INR	0.00	\N
7f08969d-5e05-4329-a02e-e0759ccd3e5f	1	1001	Cash in Hand	Asset	Cash-in-hand	50000.00	50205.00	\N	Active	f	f	t	debit	Pending	\N	\N	\N	2026-05-29 11:46:18.201946	2026-05-29 15:04:09.051446	\N	f	\N	f	\N	\N	India	\N	f	\N	INR	0.00	\N
bae11377-a767-4360-997c-5d5174f03d2e	1	SYS-110002	Cash in Hand	Asset	Cash in Hand	0.00	205.00	\N	Active	f	f	f	debit	Pending	\N	\N	\N	2026-05-29 15:08:11.43881	2026-05-29 15:08:11.43881	\N	f	\N	f	\N	\N	India	\N	f	\N	INR	0.00	\N
8705617a-54a5-4b61-8756-8cc53d984f4e	1	SYS-110001	Sundry Debtors	Asset	Sundry Debtors	0.00	3100.00	\N	Active	f	f	f	debit	Pending	\N	\N	\N	2026-05-29 15:08:23.960675	2026-05-29 15:08:23.960675	\N	f	\N	f	\N	\N	India	\N	f	\N	INR	0.00	\N
\.


--
-- Data for Name: company_document_history; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.company_document_history (id, document_id, version_number, document_number, issue_date, expiry_date, document_url, renewed_by, notes, archived_at) FROM stdin;
\.


--
-- Data for Name: company_documents; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.company_documents (id, document_name, document_type, document_number, issuing_authority, issue_date, expiry_date, is_permanent, status, document_url, version_number, notes, created_at, updated_at, license_number, start_date, file_name, notified_at) FROM stdin;
fbb115c0-6e39-4076-8ab2-2e66142d11d6	Certificate of Incorporation	Registration	\N	Registrar of Companies (MCA)	\N	\N	t	Active	\N	1	Primary incorporation certificate issued by ROC	2026-05-26 08:22:03.306156	2026-05-26 08:22:03.306156	\N	\N	\N	\N
2a51a391-873c-47b9-a03d-77d0ce20a0fa	Memorandum & Articles of Association	Registration	\N	Registrar of Companies (MCA)	\N	\N	t	Active	\N	1	MOA & AOA of the company	2026-05-26 08:22:03.306156	2026-05-26 08:22:03.306156	\N	\N	\N	\N
92f8143f-b4ca-409c-9889-c962cc5b765b	PAN Card (Company)	Tax	\N	Income Tax Department	\N	\N	t	Active	\N	1	Permanent Account Number for the company entity	2026-05-26 08:22:03.306156	2026-05-26 08:22:03.306156	\N	\N	\N	\N
4f2df8a9-d58a-4d15-9269-4c85b85020aa	TAN Certificate	Tax	\N	Income Tax Department	\N	\N	t	Active	\N	1	Tax Deduction Account Number for TDS compliance	2026-05-26 08:22:03.306156	2026-05-26 08:22:03.306156	\N	\N	\N	\N
584eb70b-cbea-49f0-b8f5-66fe7a9bc852	GST Registration Certificate	Tax	\N	GST Department / GSTN	\N	\N	t	Active	\N	1	GSTIN registration certificate	2026-05-26 08:22:03.306156	2026-05-26 08:22:03.306156	\N	\N	\N	\N
4647a64c-eae1-4f20-84da-7850a829d8b7	MSME / Udyam Registration	Registration	\N	Ministry of MSME	\N	\N	t	Active	\N	1	Udyam registration for MSME benefits	2026-05-26 08:22:03.306156	2026-05-26 08:22:03.306156	\N	\N	\N	\N
743f8e08-1516-4726-95ba-021907103d85	Trademark Registration Certificate	Certificate	\N	Intellectual Property India (Trade Marks Registry)	\N	\N	f	Active	\N	1	Brand / logo trademark registration	2026-05-26 08:22:03.306156	2026-05-26 08:22:03.306156	\N	\N	\N	\N
97d404ea-d08c-4afe-b75d-4af4e3a7913a	Drug Manufacturing License (Form 25/28)	License	\N	State Drug Control Authority	\N	\N	f	Active	\N	1	License to manufacture allopathic drugs	2026-05-26 08:22:03.306156	2026-05-26 08:22:03.306156	\N	\N	\N	\N
0910672b-0d29-4c86-94ae-e58c8a6edb7c	Drug Wholesale License (Form 20B/21B)	License	\N	State Drug Control Authority	\N	\N	f	Active	\N	1	Wholesale distribution license for drugs	2026-05-26 08:22:03.306156	2026-05-26 08:22:03.306156	\N	\N	\N	\N
5e80807e-487b-4c0b-9c91-580b65ae82c9	Drug Retail License (Form 20/21)	License	\N	State Drug Control Authority	\N	\N	f	Active	\N	1	Retail sale license for drugs	2026-05-26 08:22:03.306156	2026-05-26 08:22:03.306156	\N	\N	\N	\N
84030904-d04d-4b68-a785-e0e2f71fea1a	Schedule H / H1 Drug License	License	\N	State Drug Control Authority	\N	\N	f	Active	\N	1	License to stock and sell Schedule H / H1 prescription drugs	2026-05-26 08:22:03.306156	2026-05-26 08:22:03.306156	\N	\N	\N	\N
26cf9fe4-d50b-44a6-9897-98f74d873c24	Narcotic & Psychotropic Drug License	License	\N	Central / State Drug Control Authority	\N	\N	f	Active	\N	1	License for Schedule X / controlled substances	2026-05-26 08:22:03.306156	2026-05-26 08:22:03.306156	\N	\N	\N	\N
c5226305-d888-48f6-861e-8b8dbad357e8	WHO-GMP Certificate	Certificate	\N	State Drug Control Authority / CDSCO	\N	\N	f	Active	\N	1	Good Manufacturing Practices certification	2026-05-26 08:22:03.306156	2026-05-26 08:22:03.306156	\N	\N	\N	\N
340a5a1f-840d-411b-8288-5d54bc63693c	CDSCO Manufacturing Certificate	Certificate	\N	Central Drugs Standard Control Organisation	\N	\N	f	Active	\N	1	CDSCO product approval / manufacturing certificate	2026-05-26 08:22:03.306156	2026-05-26 08:22:03.306156	\N	\N	\N	\N
46285a68-7361-4d94-8194-58dd435029ca	Factory License	License	\N	Chief Inspector of Factories (State)	\N	\N	f	Active	\N	1	License under the Factories Act 1948	2026-05-26 08:22:03.306156	2026-05-26 08:22:03.306156	\N	\N	\N	\N
aa3fe577-ec81-4f62-928c-f62eb1eb0cfa	Trade License	License	\N	Municipal Corporation / Local Body	\N	\N	f	Active	\N	1	Trade / business license from local municipal authority	2026-05-26 08:22:03.306156	2026-05-26 08:22:03.306156	\N	\N	\N	\N
04117a15-3747-406e-8be1-2db0bd9fb164	Shop & Establishment Certificate	Registration	\N	Department of Labour (State)	\N	\N	f	Active	\N	1	Registration under Shops & Establishments Act	2026-05-26 08:22:03.306156	2026-05-26 08:22:03.306156	\N	\N	\N	\N
61b45c0a-9e85-4a89-b6a2-d8f0416cf1de	Fire NOC	Certificate	\N	State Fire & Emergency Services	\N	\N	f	Active	\N	1	No Objection Certificate from Fire Department	2026-05-26 08:22:03.306156	2026-05-26 08:22:03.306156	\N	\N	\N	\N
726c7c92-9d67-46d7-b3d5-ca6b1526debc	Pollution Control Consent (Water Act)	Certificate	\N	State Pollution Control Board	\N	\N	f	Active	\N	1	Consent to operate under Water (Prevention & Control of Pollution) Act	2026-05-26 08:22:03.306156	2026-05-26 08:22:03.306156	\N	\N	\N	\N
aa7448ba-f635-4819-96c5-767b4ce8affe	Pollution Control Consent (Air Act)	Certificate	\N	State Pollution Control Board	\N	\N	f	Active	\N	1	Consent to operate under Air (Prevention & Control of Pollution) Act	2026-05-26 08:22:03.306156	2026-05-26 08:22:03.306156	\N	\N	\N	\N
c2a9e066-30a1-4de0-9b46-0e3bca1ceda2	Import Export Code (IEC)	Registration	\N	DGFT (Directorate General of Foreign Trade)	\N	\N	t	Active	\N	1	IEC certificate for import / export of goods	2026-05-26 08:22:03.306156	2026-05-26 08:22:03.306156	\N	\N	\N	\N
dc597dc7-ee14-4a19-8b47-4538807847a2	EPF Registration Certificate	Registration	\N	Employees Provident Fund Organisation (EPFO)	\N	\N	t	Active	\N	1	PF code registration for employee provident fund	2026-05-26 08:22:03.306156	2026-05-26 08:22:03.306156	\N	\N	\N	\N
d9458424-2741-4748-b286-e9c953b038b8	ESI Registration Certificate	Registration	\N	Employees State Insurance Corporation (ESIC)	\N	\N	t	Active	\N	1	ESI code registration for employee health insurance	2026-05-26 08:22:03.306156	2026-05-26 08:22:03.306156	\N	\N	\N	\N
82cdd23a-f65b-4e44-9b30-cd50ca98b27e	Professional Tax Registration	Tax	\N	State Commercial Tax Department	\N	\N	t	Active	\N	1	Professional tax registration certificate	2026-05-26 08:22:03.306156	2026-05-26 08:22:03.306156	\N	\N	\N	\N
599fb53c-c4c3-4404-9765-0615c99cfff6	Labour License (Contract Labour)	License	\N	Department of Labour (State)	\N	\N	f	Active	\N	1	License under Contract Labour (Regulation & Abolition) Act	2026-05-26 08:22:03.306156	2026-05-26 08:22:03.306156	\N	\N	\N	\N
994d1806-4d89-449f-bf80-a494342f41e7	ISO 9001 Certificate (Quality Management)	Certificate	\N	Accredited Certification Body	\N	\N	f	Active	\N	1	ISO 9001:2015 Quality Management System certificate	2026-05-26 08:22:03.306156	2026-05-26 08:22:03.306156	\N	\N	\N	\N
9fbcd334-7f4b-47d5-942d-3c8d3f99cdff	ISO 14001 Certificate (Environmental)	Certificate	\N	Accredited Certification Body	\N	\N	f	Active	\N	1	ISO 14001:2015 Environmental Management System certificate	2026-05-26 08:22:03.306156	2026-05-26 08:22:03.306156	\N	\N	\N	\N
a794aef9-85e4-4bc4-8bdd-d1708b5dbfe8	Public Liability Insurance Policy	Insurance	\N	Insurance Company	\N	\N	f	Active	\N	1	Public liability insurance policy for third-party claims	2026-05-26 08:22:03.306156	2026-05-26 08:22:03.306156	\N	\N	\N	\N
d41696be-2611-4696-b6f1-cbebe005a64f	Product Liability Insurance Policy	Insurance	\N	Insurance Company	\N	\N	f	Active	\N	1	Product liability insurance for pharma products	2026-05-26 08:22:03.306156	2026-05-26 08:22:03.306156	\N	\N	\N	\N
4ee8f346-1af2-458e-891a-2eea5216466f	Fire & Burglary Insurance Policy	Insurance	\N	Insurance Company	\N	\N	f	Active	\N	1	Fire, theft and property insurance for premises	2026-05-26 08:22:03.306156	2026-05-26 08:22:03.306156	\N	\N	\N	\N
f083b5e6-139a-428b-8233-1525abcad580	Group Health Insurance Policy	Insurance	\N	Insurance Company	\N	\N	f	Active	\N	1	Employee group mediclaim / health insurance policy	2026-05-26 08:22:03.306156	2026-05-26 08:22:03.306156	\N	\N	\N	\N
9cc1bbb9-7373-4326-8b98-88db9f97921a	Workmen's Compensation Policy	Insurance	\N	Insurance Company	\N	\N	f	Active	\N	1	Workmen's compensation / employer's liability insurance	2026-05-26 08:22:03.306156	2026-05-26 08:22:03.306156	\N	\N	\N	\N
c7e8dcea-29e9-42d0-bf22-fb1e3ede4bd0	Rent Agreement / Lease Deed	Registration	\N	Sub-Registrar Office	\N	\N	f	Active	\N	1	Registered lease agreement for business premises	2026-05-26 08:22:03.306156	2026-05-26 08:22:03.306156	\N	\N	\N	\N
b78836c5-fb9c-4689-930a-4d0f15ae805c	Property Tax Receipt (Latest)	Tax	\N	Municipal Corporation	\N	\N	f	Active	\N	1	Latest property tax payment receipt	2026-05-26 08:22:03.306156	2026-05-26 08:22:03.306156	\N	\N	\N	\N
\.


--
-- Data for Name: compliance_audits; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.compliance_audits (id, audit_date, auditor_name, score_percentage, status, notes, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: compliance_checklist_items; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.compliance_checklist_items (id, audit_id, requirement_text, is_compliant, observation, created_at) FROM stdin;
\.


--
-- Data for Name: compliance_checklist_templates; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.compliance_checklist_templates (id, task_text, category, is_active) FROM stdin;
\.


--
-- Data for Name: compliance_checklists; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.compliance_checklists (id, checklist_date, items, score_percentage, performed_by, status, remarks, created_at) FROM stdin;
\.


--
-- Data for Name: compliance_notification_log; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.compliance_notification_log (id, license_id, channel, message, status, sent_at) FROM stdin;
\.


--
-- Data for Name: compliance_notification_settings; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.compliance_notification_settings (id, email_enabled, email_address, whatsapp_enabled, whatsapp_number, whatsapp_apikey, alert_days_30, alert_days_15, alert_days_7, alert_days_1, updated_at) FROM stdin;
1	t	metapharsic@gmail.com	f	\N	\N	t	t	t	t	2026-05-30 03:34:09.528074
\.


--
-- Data for Name: cost_centers; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.cost_centers (id, company_id, name, type, manager_id, created_by, created_at) FROM stdin;
\.


--
-- Data for Name: crm_accounts; Type: TABLE DATA; Schema: public; Owner: erp_user
--

COPY public.crm_accounts (id, name, account_type, industry, territory, state, district, city, pincode, address, phone, email, website, annual_revenue, bed_count, status, pcd_partner_id, assigned_owner_id, parent_account_id, tags, custom_fields, deleted_at, created_by, created_at, updated_at) FROM stdin;
f2e965a1-34a0-4e1e-a3ac-1a422efa89be	meta	HOSPITAL	\N			\N		\N					\N	\N	PROSPECT	\N	\N	\N	{}	{}	\N	\N	2026-05-29 18:30:21.007898	2026-05-29 18:30:21.007898
\.


--
-- Data for Name: crm_activities; Type: TABLE DATA; Schema: public; Owner: erp_user
--

COPY public.crm_activities (id, activity_type, subject, description, account_id, contact_id, opportunity_id, performed_by, scheduled_at, completed_at, outcome, duration_minutes, location_lat, location_lng, attachments, created_by, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: crm_audit_log; Type: TABLE DATA; Schema: public; Owner: erp_user
--

COPY public.crm_audit_log (id, occurred_at, actor_id, actor_email, action, entity_type, entity_id, before_state, after_state, ip_address) FROM stdin;
\.


--
-- Data for Name: crm_badges; Type: TABLE DATA; Schema: public; Owner: erp_user
--

COPY public.crm_badges (id, user_id, badge_key, badge_name, earned_at) FROM stdin;
\.


--
-- Data for Name: crm_campaign_recipients; Type: TABLE DATA; Schema: public; Owner: erp_user
--

COPY public.crm_campaign_recipients (id, campaign_id, contact_id, phone, email, variant, status, sent_at, delivered_at, opened_at, clicked_at, replied_at, unsubscribed_at) FROM stdin;
\.


--
-- Data for Name: crm_campaigns; Type: TABLE DATA; Schema: public; Owner: erp_user
--

COPY public.crm_campaigns (id, name, campaign_type, channel, status, segment_id, template_id, scheduled_at, sent_at, total_recipients, sent_count, delivered_count, opened_count, replied_count, ab_enabled, ab_split_pct, ab_winner_metric, created_by, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: crm_comments; Type: TABLE DATA; Schema: public; Owner: erp_user
--

COPY public.crm_comments (id, entity_type, entity_id, parent_comment_id, content, created_by, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: crm_consents; Type: TABLE DATA; Schema: public; Owner: erp_user
--

COPY public.crm_consents (id, contact_id, channel, purpose, status, granted_at, withdrawn_at, source, legal_basis) FROM stdin;
\.


--
-- Data for Name: crm_contacts; Type: TABLE DATA; Schema: public; Owner: erp_user
--

COPY public.crm_contacts (id, account_id, first_name, last_name, designation, department, email, phone, whatsapp, address, preferred_channel, do_not_contact, is_decision_maker, birthday, anniversary, custom_fields, deleted_at, created_by, created_at, updated_at) FROM stdin;
146bce64-4ab5-47f0-9283-a87c176c34db	\N	mannan							\N	WHATSAPP	f	f	\N	\N	{}	\N	\N	2026-05-29 18:34:06.032108	2026-05-29 18:34:06.032108
\.


--
-- Data for Name: crm_copilot_threads; Type: TABLE DATA; Schema: public; Owner: erp_user
--

COPY public.crm_copilot_threads (id, user_id, messages, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: crm_custom_fields; Type: TABLE DATA; Schema: public; Owner: erp_user
--

COPY public.crm_custom_fields (id, object_type, api_name, display_name, field_type, options, required, sort_order, created_at) FROM stdin;
\.


--
-- Data for Name: crm_custom_objects; Type: TABLE DATA; Schema: public; Owner: erp_user
--

COPY public.crm_custom_objects (id, api_name, display_name, description, enabled, created_at) FROM stdin;
\.


--
-- Data for Name: crm_embeddings; Type: TABLE DATA; Schema: public; Owner: erp_user
--

COPY public.crm_embeddings (id, entity_type, entity_id, content_text, embedding, model, created_at) FROM stdin;
\.


--
-- Data for Name: crm_forecasts; Type: TABLE DATA; Schema: public; Owner: erp_user
--

COPY public.crm_forecasts (id, user_id, period_start, period_end, quota, closed_won, commit_amount, best_case, pipeline_total, snapshot_date) FROM stdin;
\.


--
-- Data for Name: crm_gamification_points; Type: TABLE DATA; Schema: public; Owner: erp_user
--

COPY public.crm_gamification_points (id, user_id, event_type, points, metadata, earned_at) FROM stdin;
\.


--
-- Data for Name: crm_hcps; Type: TABLE DATA; Schema: public; Owner: erp_user
--

COPY public.crm_hcps (id, contact_id, specialty, qualification, mci_registration_no, experience_years, typical_rx_volume, preferred_brands, rating, notes, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: crm_kb_articles; Type: TABLE DATA; Schema: public; Owner: erp_user
--

COPY public.crm_kb_articles (id, title, category, content, article_type, status, view_count, created_by, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: crm_layouts; Type: TABLE DATA; Schema: public; Owner: erp_user
--

COPY public.crm_layouts (id, object_type, role, layout_config, updated_at) FROM stdin;
\.


--
-- Data for Name: crm_leads; Type: TABLE DATA; Schema: public; Owner: erp_user
--

COPY public.crm_leads (id, first_name, last_name, company, email, phone, territory, lead_source, status, score, owner_id, converted, converted_account_id, converted_contact_id, notes, deleted_at, created_by, created_at, updated_at) FROM stdin;
fe8f3f65-aa31-4de5-8ba3-605dc5997636	meta						DIRECT	NEW	0	\N	f	\N	\N		\N	\N	2026-05-29 18:34:28.459716	2026-05-29 18:34:28.459716
\.


--
-- Data for Name: crm_mentions; Type: TABLE DATA; Schema: public; Owner: erp_user
--

COPY public.crm_mentions (id, mentioned_user_id, mentioned_by, entity_type, entity_id, context, read, created_at) FROM stdin;
\.


--
-- Data for Name: crm_notes; Type: TABLE DATA; Schema: public; Owner: erp_user
--

COPY public.crm_notes (id, entity_type, entity_id, content, created_by, created_at) FROM stdin;
\.


--
-- Data for Name: crm_oauth_tokens; Type: TABLE DATA; Schema: public; Owner: erp_user
--

COPY public.crm_oauth_tokens (id, user_id, provider, access_token, refresh_token, expires_at, scope) FROM stdin;
\.


--
-- Data for Name: crm_opportunities; Type: TABLE DATA; Schema: public; Owner: erp_user
--

COPY public.crm_opportunities (id, name, account_id, contact_id, pipeline_id, stage, value, probability, expected_close_date, actual_close_date, source, loss_reason, owner_id, product_interest, next_action, next_action_date, deleted_at, created_by, created_at, updated_at) FROM stdin;
3266f36c-77eb-4642-945c-19f361d779c3	meta	\N	\N	\N	DISCOVERY	\N	20.00	\N	\N	\N	\N	\N	{}	\N	\N	\N	\N	2026-05-29 18:34:42.634363	2026-05-29 18:34:42.634363
\.


--
-- Data for Name: crm_permissions; Type: TABLE DATA; Schema: public; Owner: erp_user
--

COPY public.crm_permissions (id, entity_type, entity_id, grantee_type, grantee_id, access_level, granted_by, granted_at) FROM stdin;
\.


--
-- Data for Name: crm_pipeline_stages; Type: TABLE DATA; Schema: public; Owner: erp_user
--

COPY public.crm_pipeline_stages (id, pipeline_id, name, stage_order, win_probability, is_won, is_lost) FROM stdin;
cbe537e1-1d5d-40dd-bd4b-555839d9323e	9ebe82f6-be18-4988-98ce-9eeeab169618	Discovery	1	10.00	f	f
93569203-1698-42bb-a902-cb7d038e7746	9ebe82f6-be18-4988-98ce-9eeeab169618	Qualified	2	30.00	f	f
83c04c48-6e2d-4509-90d7-f38c44cf70e5	9ebe82f6-be18-4988-98ce-9eeeab169618	Proposal	3	60.00	f	f
e165c596-5a7f-4773-9b2a-8dcae5f2790a	9ebe82f6-be18-4988-98ce-9eeeab169618	Negotiation	4	80.00	f	f
074be99c-3add-4724-9651-43e61b7da3ac	9ebe82f6-be18-4988-98ce-9eeeab169618	Won	5	100.00	t	f
7f0a9498-5911-48ef-8c66-948fd5d12a0f	9ebe82f6-be18-4988-98ce-9eeeab169618	Lost	6	0.00	f	t
639ea15f-0c1b-422a-9823-f3c20dc448e7	9ebe82f6-be18-4988-98ce-9eeeab169618	Discovery	1	10.00	f	f
a72cc332-033a-4840-aa49-81f08bc17fd1	a5bc872a-5932-40ca-9468-4274e6e68cd0	Discovery	1	10.00	f	f
fc0e28ec-6279-4f1c-b37d-89a7c9455b3c	9ebe82f6-be18-4988-98ce-9eeeab169618	Qualified	2	30.00	f	f
89301d15-dee7-4c66-b596-48597d7fcc59	a5bc872a-5932-40ca-9468-4274e6e68cd0	Qualified	2	30.00	f	f
08dbb8cb-c8a6-49e5-b207-4082ac3db7c4	9ebe82f6-be18-4988-98ce-9eeeab169618	Proposal	3	60.00	f	f
0e543f01-0be1-405e-ad61-90b7de28ccf2	a5bc872a-5932-40ca-9468-4274e6e68cd0	Proposal	3	60.00	f	f
b7dc898b-f83c-4b07-b243-48e9d2762eee	9ebe82f6-be18-4988-98ce-9eeeab169618	Negotiation	4	80.00	f	f
f008e9eb-51c8-4be9-990a-17480224e4b8	a5bc872a-5932-40ca-9468-4274e6e68cd0	Negotiation	4	80.00	f	f
cb864b9a-0815-413e-81d8-3bc8917708d0	9ebe82f6-be18-4988-98ce-9eeeab169618	Won	5	100.00	t	f
ff333bbb-0228-46b5-985b-52e8ed9d2990	a5bc872a-5932-40ca-9468-4274e6e68cd0	Won	5	100.00	t	f
79d22fcf-5502-470f-9d39-00d0765983fd	9ebe82f6-be18-4988-98ce-9eeeab169618	Lost	6	0.00	f	t
55c3a6d9-014b-4c3c-b008-52c7ced18d97	a5bc872a-5932-40ca-9468-4274e6e68cd0	Lost	6	0.00	f	t
1fe46377-7337-4c51-ada3-6054efab9c51	9ebe82f6-be18-4988-98ce-9eeeab169618	Discovery	1	10.00	f	f
0cdc2754-768b-4e35-a5b1-762c5d5c3320	a5bc872a-5932-40ca-9468-4274e6e68cd0	Discovery	1	10.00	f	f
ef3b4347-22d8-4a6a-8a97-0ab8ed1a435f	8efbd547-3132-46c6-b77d-52da0492b154	Discovery	1	10.00	f	f
129ef929-7b50-49d1-8f8e-bc5386f52bcd	9ebe82f6-be18-4988-98ce-9eeeab169618	Qualified	2	30.00	f	f
ebaeb4bd-7942-4ccc-8132-c593b6757a68	a5bc872a-5932-40ca-9468-4274e6e68cd0	Qualified	2	30.00	f	f
bda10ca5-9d87-4e6e-938c-6beb5825978c	8efbd547-3132-46c6-b77d-52da0492b154	Qualified	2	30.00	f	f
ea8faafa-5fb2-49c2-8e5a-1b5e9e2c43ab	9ebe82f6-be18-4988-98ce-9eeeab169618	Proposal	3	60.00	f	f
5ac70e5a-fde7-465d-b6cf-dd7254cd1877	a5bc872a-5932-40ca-9468-4274e6e68cd0	Proposal	3	60.00	f	f
94650369-2d0b-495e-8532-7b2123b4e9eb	8efbd547-3132-46c6-b77d-52da0492b154	Proposal	3	60.00	f	f
b4c386dc-3a69-4c32-8f30-e4e9687b000f	9ebe82f6-be18-4988-98ce-9eeeab169618	Negotiation	4	80.00	f	f
0e9970d6-c066-410f-9286-e92065669f22	a5bc872a-5932-40ca-9468-4274e6e68cd0	Negotiation	4	80.00	f	f
e5281618-7207-4d0b-8dde-17e956230ced	8efbd547-3132-46c6-b77d-52da0492b154	Negotiation	4	80.00	f	f
d3f15f55-3fa9-414b-a0ea-c74e3a8ae0b1	9ebe82f6-be18-4988-98ce-9eeeab169618	Won	5	100.00	t	f
de52a74d-cf7b-4c43-ac48-5f68ea265f97	a5bc872a-5932-40ca-9468-4274e6e68cd0	Won	5	100.00	t	f
d03be946-1a02-43dd-be13-36b70b4b05a8	8efbd547-3132-46c6-b77d-52da0492b154	Won	5	100.00	t	f
d825a7f1-6c99-4c2d-99e8-15609d6c7843	9ebe82f6-be18-4988-98ce-9eeeab169618	Lost	6	0.00	f	t
77112c7a-a746-4ad1-85be-d1f6f177efb3	a5bc872a-5932-40ca-9468-4274e6e68cd0	Lost	6	0.00	f	t
eb88eba6-a8ec-41ed-b2c5-2484d5a2ff4e	8efbd547-3132-46c6-b77d-52da0492b154	Lost	6	0.00	f	t
95145393-9e6d-4da9-b052-7029aface70e	9ebe82f6-be18-4988-98ce-9eeeab169618	Discovery	1	10.00	f	f
52bd30a4-c822-45e0-b61d-3c077f137d48	a5bc872a-5932-40ca-9468-4274e6e68cd0	Discovery	1	10.00	f	f
f1125262-4206-450c-8d48-5213525abc1b	8efbd547-3132-46c6-b77d-52da0492b154	Discovery	1	10.00	f	f
0d3b0428-3787-466c-81d0-a2b3be6234a5	98cc7623-1d25-4bf2-ab88-1249b593aff7	Discovery	1	10.00	f	f
7b882b32-fbcb-40fd-80e3-e7ddae848202	9ebe82f6-be18-4988-98ce-9eeeab169618	Qualified	2	30.00	f	f
e72da9fb-c49b-4f93-b9b8-4ad784f9be69	a5bc872a-5932-40ca-9468-4274e6e68cd0	Qualified	2	30.00	f	f
178544c4-91eb-480a-afab-cc4c4e5a503b	8efbd547-3132-46c6-b77d-52da0492b154	Qualified	2	30.00	f	f
f1f71e79-a9fb-45fb-89a4-e218d5bdd204	98cc7623-1d25-4bf2-ab88-1249b593aff7	Qualified	2	30.00	f	f
e99c057b-0367-4f85-b19d-62c8defc162d	9ebe82f6-be18-4988-98ce-9eeeab169618	Proposal	3	60.00	f	f
665fb4a0-99f9-44c7-a9fe-46cad27411e5	a5bc872a-5932-40ca-9468-4274e6e68cd0	Proposal	3	60.00	f	f
c9516971-4a4c-4f09-b6f8-d7684f439a87	8efbd547-3132-46c6-b77d-52da0492b154	Proposal	3	60.00	f	f
0722038e-da1e-4703-878a-f18c123fadaf	98cc7623-1d25-4bf2-ab88-1249b593aff7	Proposal	3	60.00	f	f
1e832842-6087-4f8d-8446-aa3b067117e1	9ebe82f6-be18-4988-98ce-9eeeab169618	Negotiation	4	80.00	f	f
6d506ab3-99e9-44d5-9124-79f09371eb90	a5bc872a-5932-40ca-9468-4274e6e68cd0	Negotiation	4	80.00	f	f
f7345758-af05-4370-a509-71145e7786fa	8efbd547-3132-46c6-b77d-52da0492b154	Negotiation	4	80.00	f	f
d9416bdb-15ff-420c-9a0f-03744bb5ff27	98cc7623-1d25-4bf2-ab88-1249b593aff7	Negotiation	4	80.00	f	f
34a90bf0-4d4e-48b9-817b-2bb26f3f9b2c	9ebe82f6-be18-4988-98ce-9eeeab169618	Won	5	100.00	t	f
15e9dc53-82d7-4a22-8e4d-e917b77eb439	a5bc872a-5932-40ca-9468-4274e6e68cd0	Won	5	100.00	t	f
c53f2ad6-3332-48fd-8cac-a58fad96a696	8efbd547-3132-46c6-b77d-52da0492b154	Won	5	100.00	t	f
feea66fc-06f6-4808-af09-da48da43a688	98cc7623-1d25-4bf2-ab88-1249b593aff7	Won	5	100.00	t	f
87900afd-bbe0-4810-902f-d69b81c594cd	9ebe82f6-be18-4988-98ce-9eeeab169618	Lost	6	0.00	f	t
9383791f-32fd-49d9-83af-17ea92adc93e	a5bc872a-5932-40ca-9468-4274e6e68cd0	Lost	6	0.00	f	t
c0fc0d04-bcfa-4aca-ab5a-cad5d2ca6ae6	8efbd547-3132-46c6-b77d-52da0492b154	Lost	6	0.00	f	t
b72e910f-4156-4f61-8707-23543c1f9479	98cc7623-1d25-4bf2-ab88-1249b593aff7	Lost	6	0.00	f	t
\.


--
-- Data for Name: crm_pipelines; Type: TABLE DATA; Schema: public; Owner: erp_user
--

COPY public.crm_pipelines (id, name, is_default, created_at) FROM stdin;
9ebe82f6-be18-4988-98ce-9eeeab169618	Sales Pipeline	t	2026-05-26 18:24:22.85656
a5bc872a-5932-40ca-9468-4274e6e68cd0	Sales Pipeline	t	2026-05-26 19:18:56.58375
8efbd547-3132-46c6-b77d-52da0492b154	Sales Pipeline	t	2026-05-27 06:46:05.778947
98cc7623-1d25-4bf2-ab88-1249b593aff7	Sales Pipeline	t	2026-05-29 12:17:08.969518
\.


--
-- Data for Name: crm_playbooks; Type: TABLE DATA; Schema: public; Owner: erp_user
--

COPY public.crm_playbooks (id, name, description, steps, status, created_by, created_at) FROM stdin;
\.


--
-- Data for Name: crm_predictions; Type: TABLE DATA; Schema: public; Owner: erp_user
--

COPY public.crm_predictions (id, prediction_type, entity_type, entity_id, value, confidence, factors, model_version, predicted_at) FROM stdin;
\.


--
-- Data for Name: crm_push_subscriptions; Type: TABLE DATA; Schema: public; Owner: erp_user
--

COPY public.crm_push_subscriptions (id, user_id, endpoint, p256dh, auth, created_at) FROM stdin;
\.


--
-- Data for Name: crm_quotas; Type: TABLE DATA; Schema: public; Owner: erp_user
--

COPY public.crm_quotas (id, user_id, period_type, period_start, period_end, quota_amount, created_at) FROM stdin;
\.


--
-- Data for Name: crm_quote_lines; Type: TABLE DATA; Schema: public; Owner: erp_user
--

COPY public.crm_quote_lines (id, quote_id, product_name, product_id, quantity, unit_price, discount_pct, line_total, sort_order) FROM stdin;
\.


--
-- Data for Name: crm_quotes; Type: TABLE DATA; Schema: public; Owner: erp_user
--

COPY public.crm_quotes (id, quote_number, opportunity_id, account_id, contact_id, status, valid_until, subtotal, tax_amount, discount_amount, total, notes, terms, signed_at, deleted_at, created_by, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: crm_samples; Type: TABLE DATA; Schema: public; Owner: erp_user
--

COPY public.crm_samples (id, contact_id, account_id, product_name, quantity, batch_number, given_by, given_date, purpose, recipient_signature, created_at) FROM stdin;
\.


--
-- Data for Name: crm_scores; Type: TABLE DATA; Schema: public; Owner: erp_user
--

COPY public.crm_scores (id, entity_type, entity_id, lead_score, churn_risk, health_score, engagement_score, factors, computed_at) FROM stdin;
\.


--
-- Data for Name: crm_segments; Type: TABLE DATA; Schema: public; Owner: erp_user
--

COPY public.crm_segments (id, name, description, rules, is_dynamic, last_count, last_evaluated, created_by, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: crm_sequence_enrolments; Type: TABLE DATA; Schema: public; Owner: erp_user
--

COPY public.crm_sequence_enrolments (id, sequence_id, contact_id, current_step, status, enrolled_at, exited_at, exit_reason) FROM stdin;
\.


--
-- Data for Name: crm_sequence_steps; Type: TABLE DATA; Schema: public; Owner: erp_user
--

COPY public.crm_sequence_steps (id, sequence_id, step_order, step_type, template_id, delay_hours, conditions, variant) FROM stdin;
\.


--
-- Data for Name: crm_sequences; Type: TABLE DATA; Schema: public; Owner: erp_user
--

COPY public.crm_sequences (id, name, description, status, ab_test_enabled, exit_on_reply, exit_on_meeting, exit_on_won, created_by, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: crm_tasks; Type: TABLE DATA; Schema: public; Owner: erp_user
--

COPY public.crm_tasks (id, title, task_type, priority, status, due_date, completed_at, snoozed_until, account_id, contact_id, opportunity_id, assigned_to, is_recurring, recurrence_rule, notes, deleted_at, created_by, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: crm_templates; Type: TABLE DATA; Schema: public; Owner: erp_user
--

COPY public.crm_templates (id, name, channel, category, subject, body, merge_tokens, whatsapp_approved, created_by, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: crm_territories; Type: TABLE DATA; Schema: public; Owner: erp_user
--

COPY public.crm_territories (id, name, parent_territory_id, assigned_to, created_at) FROM stdin;
\.


--
-- Data for Name: crm_webhooks; Type: TABLE DATA; Schema: public; Owner: erp_user
--

COPY public.crm_webhooks (id, name, url, events, secret, active, created_by, created_at) FROM stdin;
\.


--
-- Data for Name: dead_stock_analysis; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.dead_stock_analysis (id, product_id, batch_id, analysis_date, last_movement_date, days_without_movement, is_dead_stock, dead_stock_status, quantity_on_hand, inventory_value, expiry_risk, recommendation, estimated_recovery_value, action_taken, created_by, created_at) FROM stdin;
\.


--
-- Data for Name: dispatches; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.dispatches (id, invoice_no, customer_name, customer_address, customer_city, customer_state, customer_pincode, dispatch_date, expected_delivery_date, actual_delivery_date, transporter, transporter_id, lr_number, eway_bill_no, eway_bill_date, boxes, weight, volume, package_type, fragile, temperature_controlled, insurance_value, insurance_company, cod_amount, shipping_cost, handling_charges, total_charges, payment_mode, status, delivery_attempts, delivery_person, delivery_signature, delivery_remarks, vehicle_number, driver_name, driver_contact, route_details, distance_covered, fuel_consumed, tracking_updates, created_at, updated_at, created_by, last_updated_by) FROM stdin;
\.


--
-- Data for Name: dms_audit_trail; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.dms_audit_trail (id, document_id, action, user_id, user_name, details, ip_address, created_at) FROM stdin;
\.


--
-- Data for Name: dms_documents; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.dms_documents (id, title, category, file_type, current_version, status, expiry_date, author_id, author_name, created_at, updated_at, department, document_number, issuing_authority, issue_date, is_permanent, priority, workflow_status, folder_id, file_url, file_name, file_size, tags, notes, uploaded_by, reviewed_by, approved_by, company_id) FROM stdin;
\.


--
-- Data for Name: dms_folders; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.dms_folders (id, name, parent_id, color, sort_order, created_at) FROM stdin;
5689c2fc-6d90-4669-8654-f8c484b4bac1	Quality & Compliance	\N	emerald	1	2026-05-26 08:58:13.654528
9dd86a17-35cd-4882-be6e-d22672bfbf32	Human Resources	\N	blue	2	2026-05-26 08:58:13.654528
f796a739-c6ba-4628-9a59-9e91fb5e2c7d	Finance & Accounts	\N	amber	3	2026-05-26 08:58:13.654528
ae12c911-fb77-43e6-aa0e-a3b06f0b6cd8	Operations	\N	orange	4	2026-05-26 08:58:13.654528
fb6b2d05-91d4-4a9d-b260-e8acc7dc8483	Regulatory	\N	purple	5	2026-05-26 08:58:13.654528
1294d1dd-fdfc-4483-9842-29a741021a69	Safety & Environment	\N	red	6	2026-05-26 08:58:13.654528
68eb3a69-9b4c-4bd3-83a6-a598f34cfdae	Vendor & Procurement	\N	sky	7	2026-05-26 08:58:13.654528
b76946ce-48ba-4c28-90da-b9ea2aa84ff1	IT & Systems	\N	slate	8	2026-05-26 08:58:13.654528
\.


--
-- Data for Name: dms_versions; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.dms_versions (id, document_id, version_label, file_url, file_size_bytes, change_log, uploaded_by, uploaded_name, approved_by, approval_date, created_at) FROM stdin;
\.


--
-- Data for Name: dms_workflows; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.dms_workflows (id, document_id, current_step, assigned_to, due_date, status, comments, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: document_categories; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.document_categories (id, name, description, color, icon, is_active, sort_order, created_at, updated_at) FROM stdin;
9b9b4720-c842-4753-8f86-a2040244f203	Registration	Company registrations, incorporations, and statutory enrollments	blue	Building2	t	1	2026-05-26 08:38:36.650388	2026-05-26 08:38:36.650388
f2d49048-3541-47f3-add5-bfb4193701c1	Certificate	Quality, compliance, and regulatory certificates	purple	Award	t	2	2026-05-26 08:38:36.650388	2026-05-26 08:38:36.650388
c85fd6b4-da17-4d01-8cc7-61863160242d	License	Operating licenses, drug licenses, and permits	emerald	ShieldCheck	t	3	2026-05-26 08:38:36.650388	2026-05-26 08:38:36.650388
df015942-7b31-490f-bd2e-5b561a274f22	Tax	Tax registrations, PAN, TAN, GST and property tax documents	amber	Receipt	t	4	2026-05-26 08:38:36.650388	2026-05-26 08:38:36.650388
77ef97d9-f09a-4a3a-9756-18305374c415	Insurance	All insurance policies — liability, property, health	sky	Umbrella	t	5	2026-05-26 08:38:36.650388	2026-05-26 08:38:36.650388
01a0d1e5-690b-45d0-83cb-29847f2999c9	Inspection	Inspection reports, audit certificates, and NOCs	orange	ClipboardCheck	t	6	2026-05-26 08:38:36.650388	2026-05-26 08:38:36.650388
0eb1e22a-745b-4271-a7ff-053c70cbb6a1	Contract	Lease deeds, vendor agreements, and MoUs	teal	FileSignature	t	7	2026-05-26 08:38:36.650388	2026-05-26 08:38:36.650388
68c63e0b-9c33-44e8-8c22-64092773328a	Other	Miscellaneous documents not covered by other categories	slate	File	t	8	2026-05-26 08:38:36.650388	2026-05-26 08:38:36.650388
\.


--
-- Data for Name: drug_licenses; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.drug_licenses (id, name, license_number, expiry_date, category, status, document_url, created_at, updated_at, start_date, notes, file_path, file_name, issued_by) FROM stdin;
4a492b7b-7db9-41f6-8f38-c538de4f0164	GST	36ACHFM0773D1ZC	2027-05-26	Wholesale	Valid	/api/uploads/licenses/license_4a492b7b-7db9-41f6-8f38-c538de4f0164_1779771381293.pdf	2026-05-25 19:11:34.401528	2026-05-26 04:56:21.297356	\N	\N	\N	\N	\N
1aa58611-655a-49fc-91d2-310575ea518e	Labour  Registration	SEA/MED/ALO/NR/1310461/2026	2027-03-14	Wholesale	Valid	/api/uploads/licenses/license_1aa58611-655a-49fc-91d2-310575ea518e_1779771466828.pdf	2026-05-26 04:57:46.689043	2026-05-26 05:32:15.472559	2026-03-14	\N	\N	\N	\N
39af61d0-84ff-4724-9f74-e963ee3816e3	Trade License 	TR-4068-197 0001	2027-04-16	Wholesale	Valid	/api/uploads/licenses/license_39af61d0-84ff-4724-9f74-e963ee3816e3_1779771546157.pdf	2026-05-26 04:59:06.086781	2026-05-26 05:32:47.212448	2026-04-16	\N	\N	\N	\N
9a4a69b3-d0dd-40bf-901b-31feaf01cc02	GST Registration	12334352355	2026-06-18	Tax	Expiring Soon	\N	2026-05-30 04:20:47.821292	2026-05-30 04:20:47.968425	\N	\N	/uploads/certificates/1780114847965_GST_CERTIFICATE.pdf	GST CERTIFICATE.pdf	Goods & Services Tax Network
\.


--
-- Data for Name: e_invoices; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.e_invoices (id, company_id, invoice_id, irn, ack_no, qr_code, status, created_by, created_at) FROM stdin;
\.


--
-- Data for Name: employees; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.employees (id, company_id, name, contact, email, headquarters, assigned_area, sales_target, total_sales, target_achievement, base_salary, incentives, deductions, status, join_date, created_by, created_at, updated_at) FROM stdin;
a660bda3-f632-433c-8095-4931f8516437	1	Rajesh Kumar	9876543210	rajesh.kumar@metapharsic.com	Pune	Pune Central	500000.00	625000.00	125.00	35000.00	0.00	0.00	Active	2026-05-22	\N	2026-05-22 17:51:17.703018	2026-05-22 17:51:17.703018
0c37ef16-8d53-46a1-85c9-980e016ca82f	1	Priya Sharma	9876543211	priya.sharma@metapharsic.com	Mumbai	Mumbai West	600000.00	540000.00	90.00	40000.00	0.00	0.00	Active	2026-05-22	\N	2026-05-22 17:51:17.703018	2026-05-22 17:51:17.703018
92d8ba25-5a31-47bc-be44-980bdb0bad7e	1	Amit Patel	9876543212	amit.patel@metapharsic.com	Nashik	Nashik Region	400000.00	280000.00	70.00	30000.00	0.00	0.00	Active	2026-05-22	\N	2026-05-22 17:51:17.703018	2026-05-22 17:51:17.703018
0cce4723-f8b5-47de-a887-d1b6ea9c64e7	1	Sneha Gupta	9876543213	sneha.gupta@metapharsic.com	Pune	Pune East	450000.00	495000.00	110.00	38000.00	0.00	0.00	On Leave	2026-05-22	\N	2026-05-22 17:51:17.703018	2026-05-22 17:51:17.703018
\.


--
-- Data for Name: erp_settings; Type: TABLE DATA; Schema: public; Owner: erp_user
--

COPY public.erp_settings (key, value, updated_at) FROM stdin;
\.


--
-- Data for Name: expenses; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.expenses (id, category, description, amount, date, paid_by, payment_mode, created_at) FROM stdin;
1971045f-beb8-417c-a9b8-6cc543a02665	Rent	Office & Warehouse Rent - May	15000.00	2026-05-17	Admin	Bank Transfer	2026-05-22 17:51:18.476566
167a2da9-9573-453b-a09c-ee85226c8005	Electricity	Monthly Bill	2500.00	2026-05-19	Admin	UPI	2026-05-22 17:51:18.476566
5709de0e-3e9e-4ca4-ac92-dfa9b1f9fa2e	Internet	Broadband Services	1000.00	2026-05-20	Admin	UPI	2026-05-22 17:51:18.476566
\.


--
-- Data for Name: financial_audit_log; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.financial_audit_log (id, company_id, user_id, action_type, entity_type, entity_id, old_values, new_values, ip_address, "timestamp") FROM stdin;
\.


--
-- Data for Name: financial_years; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.financial_years (id, company_id, year_label, start_date, end_date, status, closed_by, closed_at, created_at, locked_by, locked_at, lock_reason) FROM stdin;
5dfbdc55-2cea-422b-a641-7a185168dd84	1	2025-26	2025-04-01	2026-03-31	Open	\N	\N	2026-05-22 17:51:18.241468	\N	\N	\N
\.


--
-- Data for Name: fixed_assets; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.fixed_assets (id, company_id, asset_name, asset_code, account_id, purchase_date, purchase_value, current_value, depreciation_method, depreciation_rate_percent, accumulated_depreciation, location, status, created_at, category_id, model_no, serial_no, vendor_id, specs, last_maintenance_date, next_maintenance_date) FROM stdin;
\.


--
-- Data for Name: forecast_demand; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.forecast_demand (id, product_id, forecast_date, method_used, avg_monthly_demand, demand_trend, forecasted_quantity, forecast_confidence_level, recommended_stock_level, created_at) FROM stdin;
\.


--
-- Data for Name: forex_rates; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.forex_rates (id, currency_code, base_currency, exchange_rate, effective_date, created_at) FROM stdin;
\.


--
-- Data for Name: general_ledger; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.general_ledger (id, account_id, voucher_id, party_id, voucher_type, transaction_date, debit, credit, running_balance, is_reconciled, created_at, currency_code, foreign_amount, fx_rate, narration, transaction_type, company_id) FROM stdin;
d3511b6c-dd8d-4a2a-9273-c6cd50cfe926	88888888-8888-8888-8888-888888888885	99999999-9999-9999-9999-999999999991	\N	JV	2026-05-17	15000.00	0.00	15000.00	t	2026-05-22 17:51:18.478615	INR	\N	1.000000	\N	JOURNAL	1
27d0f0c8-7fb5-49a8-8ab4-a23f703363ed	88888888-8888-8888-8888-888888888882	99999999-9999-9999-9999-999999999991	\N	JV	2026-05-17	0.00	15000.00	235000.00	f	2026-05-22 17:51:18.478615	INR	\N	1.000000	\N	JOURNAL	1
aab106ff-212c-4ca6-934c-738c31b2e879	7f08969d-5e05-4329-a02e-e0759ccd3e5f	c0b63346-a725-4142-88a9-ee54fdd8655a	\N	Sales	2026-05-29	205.00	0.00	205.00	f	2026-05-29 15:04:09.051446	INR	\N	1.000000	\N	JOURNAL	1
248c92c7-62f4-4cdc-8c67-036b5abeffbe	bae11377-a767-4360-997c-5d5174f03d2e	7897cb2c-8c6d-4f8d-9b20-2f76db2f0d38	\N	Sales	2026-05-20	205.00	0.00	205.00	f	2026-05-29 15:08:11.43881	INR	\N	1.000000	\N	JOURNAL	1
ad88d73e-42fc-42b3-b65b-28f75b0b7acb	e5aa3710-53b5-41ca-b37e-152224cb5f1b	7897cb2c-8c6d-4f8d-9b20-2f76db2f0d38	\N	Sales	2026-05-20	0.00	183.04	-183.04	f	2026-05-29 15:08:11.43881	INR	\N	1.000000	\N	JOURNAL	1
28415e9c-b17d-4647-8d3f-12de8768032b	36ac5938-f7a5-4d64-a7f0-e4cc4196edb8	7897cb2c-8c6d-4f8d-9b20-2f76db2f0d38	\N	Sales	2026-05-20	0.00	10.98	-10.98	f	2026-05-29 15:08:11.43881	INR	\N	1.000000	\N	JOURNAL	1
98609f89-0073-4036-aded-e28bfbd62b89	6e40e9fa-4c85-4793-ab2c-03bdad214550	7897cb2c-8c6d-4f8d-9b20-2f76db2f0d38	\N	Sales	2026-05-20	0.00	10.98	-10.98	f	2026-05-29 15:08:11.43881	INR	\N	1.000000	\N	JOURNAL	1
2f034287-dd6e-4f98-b282-7c24c13c13c3	8705617a-54a5-4b61-8756-8cc53d984f4e	16166f7f-d7f0-459f-97b5-05b8a4e15088	\N	Sales	2026-05-21	3100.00	0.00	3100.00	f	2026-05-29 15:08:23.960675	INR	\N	1.000000	\N	JOURNAL	1
1b9d487d-a2e9-4f72-bf31-8abef4ed8669	e5aa3710-53b5-41ca-b37e-152224cb5f1b	16166f7f-d7f0-459f-97b5-05b8a4e15088	\N	Sales	2026-05-21	0.00	2767.86	-2950.90	f	2026-05-29 15:08:23.960675	INR	\N	1.000000	\N	JOURNAL	1
864a90f2-c1c8-4b79-9e02-dbe796baa202	36ac5938-f7a5-4d64-a7f0-e4cc4196edb8	16166f7f-d7f0-459f-97b5-05b8a4e15088	\N	Sales	2026-05-21	0.00	166.07	-177.05	f	2026-05-29 15:08:23.960675	INR	\N	1.000000	\N	JOURNAL	1
a1c24914-b15a-4b0c-979b-62276959887f	6e40e9fa-4c85-4793-ab2c-03bdad214550	16166f7f-d7f0-459f-97b5-05b8a4e15088	\N	Sales	2026-05-21	0.00	166.07	-177.05	f	2026-05-29 15:08:23.960675	INR	\N	1.000000	\N	JOURNAL	1
\.


--
-- Data for Name: godowns; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.godowns (id, company_id, name, address, manager_id, is_default, status, created_at, updated_at) FROM stdin;
337e0393-728c-40c9-a612-a03a9eb91836	1	Main Warehouse	Primary Storage Location	\N	t	Active	2026-05-22 17:51:17.493674	2026-05-22 17:51:17.493674
\.


--
-- Data for Name: goods_received_notes; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.goods_received_notes (id, purchase_order_id, grn_number, received_date, received_by, status, remarks, created_at) FROM stdin;
\.


--
-- Data for Name: grn_items; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.grn_items (id, grn_id, product_id, po_item_id, ordered_qty, received_qty, accepted_qty, rejected_qty, unit_price, created_at) FROM stdin;
\.


--
-- Data for Name: h1_register; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.h1_register (id, entry_date, invoice_no, patient_name, doctor_name, drug_name, batch_number, quantity, created_at, created_by, quantity_unit) FROM stdin;
\.


--
-- Data for Name: inventory_turnover_analysis; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.inventory_turnover_analysis (id, company_id, product_id, analysis_period_start, analysis_period_end, cost_of_goods_sold, average_inventory_value, inventory_turnover_ratio, days_inventory_outstanding, trend, created_at) FROM stdin;
\.


--
-- Data for Name: journal_voucher_entries; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.journal_voucher_entries (id, voucher_id, account_id, debit, credit, narration, created_at) FROM stdin;
2782bb99-a021-43e2-a9f4-e73d674429f4	99999999-9999-9999-9999-999999999991	88888888-8888-8888-8888-888888888885	15000.00	0.00	Rent Expense	2026-05-22 17:51:18.477951
23d4064b-6713-45eb-be93-8d4c0a5ccc41	99999999-9999-9999-9999-999999999991	88888888-8888-8888-8888-888888888882	0.00	15000.00	Paid from HDFC Bank	2026-05-22 17:51:18.477951
3dec7300-46bd-4b5a-9810-2f66e03909ad	c0b63346-a725-4142-88a9-ee54fdd8655a	7f08969d-5e05-4329-a02e-e0759ccd3e5f	205.00	0.00	Test DR	2026-05-29 15:04:09.051446
3c806a18-f9a8-4d79-add0-d215a1f5ea2d	7897cb2c-8c6d-4f8d-9b20-2f76db2f0d38	bae11377-a767-4360-997c-5d5174f03d2e	205.00	0.00	Cash/Debtor:INV-2026-0001	2026-05-29 15:08:11.43881
fd1c06f4-d666-4571-9ad6-4c8fe3bf1557	7897cb2c-8c6d-4f8d-9b20-2f76db2f0d38	e5aa3710-53b5-41ca-b37e-152224cb5f1b	0.00	183.04	Sales:INV-2026-0001	2026-05-29 15:08:11.43881
363b9647-6174-4643-bed4-b19295b0474b	7897cb2c-8c6d-4f8d-9b20-2f76db2f0d38	36ac5938-f7a5-4d64-a7f0-e4cc4196edb8	0.00	10.98	CGST	2026-05-29 15:08:11.43881
8ad43e5d-e8fa-4f7f-a0ff-f683ac76ccc4	7897cb2c-8c6d-4f8d-9b20-2f76db2f0d38	6e40e9fa-4c85-4793-ab2c-03bdad214550	0.00	10.98	SGST	2026-05-29 15:08:11.43881
8f419bba-afb1-4500-be98-2156cbe0726b	16166f7f-d7f0-459f-97b5-05b8a4e15088	8705617a-54a5-4b61-8756-8cc53d984f4e	3100.00	0.00	Cash/Debtor:INV-2026-0002	2026-05-29 15:08:23.960675
b91e94e1-dc1c-45f0-b7d2-6e95a1705bcd	16166f7f-d7f0-459f-97b5-05b8a4e15088	e5aa3710-53b5-41ca-b37e-152224cb5f1b	0.00	2767.86	Sales:INV-2026-0002	2026-05-29 15:08:23.960675
3ba1d7c6-88f4-4b16-a819-1780bfdcbecf	16166f7f-d7f0-459f-97b5-05b8a4e15088	36ac5938-f7a5-4d64-a7f0-e4cc4196edb8	0.00	166.07	CGST	2026-05-29 15:08:23.960675
e3cb9d12-3557-46a7-bb2a-71bafb78d7b3	16166f7f-d7f0-459f-97b5-05b8a4e15088	6e40e9fa-4c85-4793-ab2c-03bdad214550	0.00	166.07	SGST	2026-05-29 15:08:23.960675
\.


--
-- Data for Name: journal_vouchers; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.journal_vouchers (id, company_id, party_id, voucher_type, voucher_no, voucher_date, narration, total_debit, total_credit, status, created_by, posted_by, approved_by, created_at, posted_at, approved_at, currency_code, fx_rate, foreign_amount, reversed_by, reversed_at, original_voucher_id) FROM stdin;
99999999-9999-9999-9999-999999999991	1	\N	Journal	JV-2026-001	2026-05-17	Rent Paid for the month	15000.00	15000.00	Posted	11111111-1111-1111-1111-111111111111	\N	\N	2026-05-22 17:51:18.477443	\N	\N	INR	1.000000	\N	\N	\N	\N
c0b63346-a725-4142-88a9-ee54fdd8655a	1	\N	Sales	PSQL-TEST-001	2026-05-29	PSQL Direct Test	205.00	205.00	Posted	\N	\N	\N	2026-05-29 15:04:09.051446	\N	\N	INR	1.000000	\N	\N	\N	\N
7897cb2c-8c6d-4f8d-9b20-2f76db2f0d38	1	\N	Sales	SI-AUTO/2026/00001	2026-05-20	Auto:Sale INV-2026-0001	205.00	205.00	Posted	\N	\N	\N	2026-05-29 15:08:11.43881	2026-05-29 15:08:11.43881	\N	INR	1.000000	\N	\N	\N	\N
16166f7f-d7f0-459f-97b5-05b8a4e15088	1	\N	Sales	SI-AUTO/2026/00002	2026-05-21	Auto:Sale INV-2026-0002	3100.00	3100.00	Posted	\N	\N	\N	2026-05-29 15:08:23.960675	2026-05-29 15:08:23.960675	\N	INR	1.000000	\N	\N	\N	\N
\.


--
-- Data for Name: kpi_dashboard_data; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.kpi_dashboard_data (id, company_id, data_date, total_inventory_value, total_stock_quantity, total_sku_count, avg_inventory_turnover, dead_stock_value, dead_stock_percentage, stockout_incidents_this_month, created_at) FROM stdin;
\.


--
-- Data for Name: lead_activities; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.lead_activities (id, lead_id, type, description, performed_by, performed_at, duration, outcome, follow_up_required, follow_up_date, created_at) FROM stdin;
\.


--
-- Data for Name: lead_interactions; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.lead_interactions (id, lead_id, interaction_date, type, summary, next_follow_up, created_by, created_at) FROM stdin;
\.


--
-- Data for Name: leads; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.leads (id, company_id, name, company_name, email, contact, location, status, priority, source, next_follow_up, estimated_value, assigned_to, notes, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: medical_representatives; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.medical_representatives (id, company_id, name, contact, email, headquarters, assigned_area, status, join_date, base_salary, fixed_allowances, sales_target, created_at, updated_at) FROM stdin;
d22e30f1-a67a-4c28-9e70-11022f276c55	1	Amit Sharma	+91-9811111111	amit.sharma@metapharsic.com	Mumbai	Mumbai North & Central	Active	2023-01-01	35000.00	0.00	500000.00	2026-05-30 04:38:59.076093	2026-05-30 04:38:59.076093
46016c4b-acd3-4ece-a5f6-919c56603994	1	Priya Desai	+91-9822222222	priya.desai@metapharsic.com	Pune	Pune & Nashik	Active	2023-02-01	32000.00	0.00	400000.00	2026-05-30 04:38:59.076093	2026-05-30 04:38:59.076093
21e2fbc0-4ddc-4ea7-bdf3-11f681754e90	1	Karthik Rao	+91-9833333333	karthik.rao@metapharsic.com	Bangalore	Bangalore & Mysore	Active	2022-11-01	38000.00	0.00	600000.00	2026-05-30 04:38:59.076093	2026-05-30 04:38:59.076093
e9c49e98-c522-4e71-81a8-21d15a4af2f3	1	Neha Gupta	+91-9844444444	neha.gupta@metapharsic.com	Delhi	Delhi NCR & Noida	Active	2022-06-01	40000.00	0.00	700000.00	2026-05-30 04:38:59.076093	2026-05-30 04:38:59.076093
39e50d58-7818-4d39-9e8d-51f504fa8f18	1	Ravi Menon	+91-9855555555	ravi.menon@metapharsic.com	Hyderabad	Hyderabad & Secunderabad	Active	2023-05-01	33000.00	0.00	450000.00	2026-05-30 04:38:59.076093	2026-05-30 04:38:59.076093
\.


--
-- Data for Name: order_items; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.order_items (id, order_id, product_id, product_name, quantity, approved_quantity, rate, amount, created_at) FROM stdin;
\.


--
-- Data for Name: orders; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.orders (id, distributor_id, distributor_name, order_date, total_amount, status, priority, credit_status, packing_specs, labeling_specs, remarks, created_by, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: p2; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.p2 (id) FROM stdin;
7969fca6-148d-4d78-9d9c-3a4e7343a789
\.


--
-- Data for Name: p3; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.p3 (id) FROM stdin;
244368c9-181e-422c-8aba-f608c762fc8f
\.


--
-- Data for Name: p4; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.p4 (id) FROM stdin;
7d0e3de3-648b-4f87-8bc4-a6495b9296df
\.


--
-- Data for Name: parties; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.parties (id, name, type, gstin, mobile, email, address, city, state, status, credit_limit, current_balance, created_at, pin_code, credit_days, category, contact_person, pan, route, territory, remarks, bank_name, account_number, ifsc_code, drug_license_no, updated_at) FROM stdin;
55555555-5555-5555-5555-555555555551	Apollo Distributors	Creditor	29ABCDE1234F1Z5	9876543210	orders@apollodist.com	123 Pharma Street	Bangalore	Karnataka	Active	500000.00	-25000.00	2026-05-22 17:51:18.47277	\N	0	Regular	\N	\N	\N	\N	\N	\N	\N	\N	\N	2026-05-22 17:51:18.47277+00
55555555-5555-5555-5555-555555555552	National Medicos	Creditor	27XYZA1234B2Z4	9988776655	supply@nationalmed.com	45 Health Ave	Mumbai	Maharashtra	Active	200000.00	0.00	2026-05-22 17:51:18.47277	\N	0	Regular	\N	\N	\N	\N	\N	\N	\N	\N	\N	2026-05-22 17:51:18.47277+00
55555555-5555-5555-5555-555555555553	City Hospital Pharmacy	Debtor	07HOSP1234C3Z3	9898989898	pharmacy@cityhospital.com	Main Road	Delhi	Delhi	Active	100000.00	15000.00	2026-05-22 17:51:18.47277	\N	0	Regular	\N	\N	\N	\N	\N	\N	\N	\N	\N	2026-05-22 17:51:18.47277+00
55555555-5555-5555-5555-555555555554	Generic Retail Store	Debtor	33RETA1234D4Z2	9797979797	billing@genericretail.com	Market Square	Chennai	Tamil Nadu	Active	50000.00	5000.00	2026-05-22 17:51:18.47277	\N	0	Regular	\N	\N	\N	\N	\N	\N	\N	\N	\N	2026-05-22 17:51:18.47277+00
45a136aa-0199-4298-90df-b21bf8e84c0d	Wellness Distributors	Debtor	27AAAAA0000A1Z5	9888877777	\N	\N	Pune	Maharashtra	Active	0.00	0.00	2026-05-29 11:46:18.207324	\N	0	Regular	\N	\N	\N	\N	\N	\N	\N	\N	\N	2026-05-29 11:46:18.207324+00
b8f472d7-3cd2-4580-8602-7be84f0ef48d	MediCare Franchise	Debtor	27BBBBB0000B1Z5	9777766666	\N	\N	Nashik	Maharashtra	Active	0.00	0.00	2026-05-29 11:46:18.207324	\N	0	Regular	\N	\N	\N	\N	\N	\N	\N	\N	\N	2026-05-29 11:46:18.207324+00
b10b9ea7-f01b-4690-99d9-6ff01ddebf33	LifeLine Pharma	Debtor	27CCCCC0000C1Z5	9666655555	\N	\N	Mumbai	Maharashtra	Active	0.00	0.00	2026-05-29 11:46:18.207324	\N	0	Regular	\N	\N	\N	\N	\N	\N	\N	\N	\N	2026-05-29 11:46:18.207324+00
9add0b7d-1ba5-4ce4-8db6-cb08ce27023d	Apex Labs (Procurement)	Creditor	29ABCDE1234F1Z5	9876543210	\N	\N	Pune	Maharashtra	Active	0.00	0.00	2026-05-29 11:46:18.207324	\N	0	Regular	\N	\N	\N	\N	\N	\N	\N	\N	\N	2026-05-29 11:46:18.207324+00
ac0fb53a-a431-4d9c-8a3b-804c74cc62ec	Sanjeevani Agencies	Creditor	29FGHIJ5678K1Z9	9123456780	\N	\N	Mumbai	Maharashtra	Active	0.00	0.00	2026-05-29 11:46:18.207324	\N	0	Regular	\N	\N	\N	\N	\N	\N	\N	\N	\N	2026-05-29 11:46:18.207324+00
a13cc34b-6b4a-4af6-b06e-3241e421a088	Global API Source	Creditor	29KLMNO9876P1Z2	9988776655	\N	\N	Hyderabad	Telangana	Active	0.00	0.00	2026-05-29 11:46:18.207324	\N	0	Regular	\N	\N	\N	\N	\N	\N	\N	\N	\N	2026-05-29 11:46:18.207324+00
\.


--
-- Data for Name: password_history; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.password_history (id, user_id, password_hash, created_at) FROM stdin;
\.


--
-- Data for Name: payment_vouchers; Type: TABLE DATA; Schema: public; Owner: erp_user
--

COPY public.payment_vouchers (id, payment_no, payment_date, party_id, bank_account_id, payment_mode, amount, tds_section, tds_amount, net_paid, cheque_no, cheque_date, utr_no, narration, status, voucher_id, approved_by, created_by, created_at) FROM stdin;
\.


--
-- Data for Name: pcd_activity_log; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.pcd_activity_log (id, partner_id, actor_name, action_type, description, entity_type, entity_id, metadata, created_at, company_id) FROM stdin;
384e3100-8a4a-4144-8a0a-7682ca8a1009	\N	Admin	PARTNER_ONBOARDED	Delhi Pharma Network upgraded to PLATINUM status	partner	\N	\N	2026-05-30 04:39:33.383842	1
29ca5793-6b35-41b1-b1cf-03dc9a8f5bae	\N	Admin	SCHEME_CREATED	Q1 Festive Boost scheme activated for SILVER+ partners	scheme	\N	\N	2026-05-30 04:39:33.383842	1
97e91121-293b-4986-b759-424de33befd9	\N	System	TARGET_ACHIEVED	Bharat Medical Agencies achieved Q1 target (104%)	target	\N	\N	2026-05-30 04:39:33.383842	1
9033a94d-c4ae-46eb-a3a0-8d50913b66a5	\N	Admin	COMMISSION_PAID	Q4-2025 commissions disbursed for 3 partners	commission	\N	\N	2026-05-30 04:39:33.383842	1
1366fecd-d92b-42d5-b0fb-48a5e9a2f674	\N	Admin	BROADCAST_SENT	Q1 scheme details shared with all active partners	broadcast	\N	\N	2026-05-30 04:39:33.383842	1
1eedd441-a446-4ccb-b26d-7b28102bf51e	\N	Amit Sharma	MR_VISIT	Visited Bharat Medical Agencies - Mumbai territory coverage update	visit	\N	\N	2026-05-30 04:58:31.662071	1
6ea61c90-319c-4ccb-b2a7-39caac778ec9	\N	Neha Gupta	ORDER_PLACED	Delhi Pharma Network placed order 220000 for MetaMol 500mg	transaction	\N	\N	2026-05-30 04:58:31.662071	1
f236cdce-63f5-4146-9d16-875999d95bf6	\N	Karthik Rao	PAYMENT_RECEIVED	Nair Healthcare cleared outstanding 95000 invoice	payment	\N	\N	2026-05-30 04:58:31.662071	1
9d1b5633-29b6-4587-bddd-755de5e2ef35	\N	System	TARGET_EXCEEDED	Delhi Pharma Network exceeded Q1 target by 17 percent	target	\N	\N	2026-05-30 04:58:31.662071	1
043b14e7-2892-4482-bc71-728b152e8388	\N	Admin	PARTNER_UPGRADED	Bharat Medical Agencies upgraded from SILVER to GOLD	partner	\N	\N	2026-05-30 04:58:31.662071	1
95fe187b-0300-4e1a-a989-013c5b695fd3	7969fca6-148d-4d78-9d9c-3a4e7343a789	System	MR_ASSIGNED	MR Karthik Rao assigned to partner	partner	7969fca6-148d-4d78-9d9c-3a4e7343a789	\N	2026-05-30 10:46:07.824329	1
3fe406c3-0b69-46b3-9c7d-bd1aa674e7cb	17d623ec-d5c1-4cee-85a5-0653b91905fe	System	ORDER_PLACED	Order ₹75000 for Summer Cardiac Drive	transaction	b305569e-a163-4d24-b2c0-6d59284dc67e	\N	2026-05-30 11:07:35.906788	1
88de367e-263a-4bb4-9986-6684551e96d6	17d623ec-d5c1-4cee-85a5-0653b91905fe	System	ORDER_PLACED	Order ₹75000 for Summer Cardiac Drive	transaction	50ea0754-6279-40ba-b1f9-089df1b3c354	\N	2026-05-30 11:07:44.940612	1
50debc3e-faf6-4732-98ee-c2f66f93dcd1	244368c9-181e-422c-8aba-f608c762fc8f	System	PAYMENT_RECEIVED	Payment ₹2000 recorded for invoice INV-2026-003	receivable	86bd83b6-1b0c-48e5-abb7-0b755dcfaf34	\N	2026-05-30 13:42:52.664448	1
1a568138-16e4-4266-a15e-39ddfba66b57	7969fca6-148d-4d78-9d9c-3a4e7343a789	System	PAYMENT_RECEIVED	Payment ₹2000 recorded for invoice INV-2026-005	receivable	bc15dbf4-0a21-4e8a-89cf-13e298ea301d	\N	2026-05-31 05:07:32.067507	1
\.


--
-- Data for Name: pcd_broadcast_messages; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.pcd_broadcast_messages (id, title, message, channel, target_grades, target_states, sent_by, status, recipient_count, created_at) FROM stdin;
c83431ce-467c-43f4-9269-0254514ba77d	Q1 2026 Scheme Launch	Dear Partner, We are excited to announce our Q1 2026 Festive Boost scheme. Order above 50000 and get 3 percent extra discount plus free samples. Valid till 31st March 2026.	EMAIL	SILVER,GOLD,PLATINUM	\N	\N	SENT	6	2026-05-30 04:58:31.66078
25607ecc-ce3b-4a56-b94a-2da679586dd1	New Product Launch MetaCard 20mg	Introducing MetaCard 20mg our latest cardiac care innovation. Contact your MR for product details and scheme pricing.	BOTH	ALL	\N	\N	SENT	7	2026-05-30 04:58:31.66078
20fec96d-cff3-4039-b779-5b30a3352dcc	Pending Payment Reminder	This is a gentle reminder regarding your outstanding invoice. Please clear dues before 15th to avail Q2 scheme benefits.	WHATSAPP	SILVER,BRONZE	\N	\N	SENT	4	2026-05-30 04:58:31.66078
\.


--
-- Data for Name: pcd_commissions; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.pcd_commissions (id, partner_id, period, period_start, period_end, base_commission, scheme_bonus, deductions, net_commission, payment_status, paid_on, notes, created_at, company_id) FROM stdin;
fc5ee656-35e1-4808-9af7-dc1264c284e3	7d0e3de3-648b-4f87-8bc4-a6495b9296df	Q4-2025	2025-10-01	2025-12-31	28000.00	4000.00	0.00	32000.00	PENDING	\N	\N	2026-05-30 04:40:49.365354	1
ba493383-d398-4446-ae3d-67ffad4161e0	244368c9-181e-422c-8aba-f608c762fc8f	Q1-2026	2026-01-01	2026-03-31	69700.00	8200.00	0.00	77900.00	PENDING	\N	\N	2026-05-30 05:11:51.049803	1
a73ba4ac-f48b-4efc-a72e-d5d44e55db7f	4487a596-6018-4730-89c0-732c19890ed0	Q1-2026	2026-01-01	2026-03-31	32895.00	0.00	0.00	32895.00	PENDING	\N	\N	2026-05-30 05:11:51.049803	1
34ce60a3-65e3-43ee-86f6-945c292b3cbe	7969fca6-148d-4d78-9d9c-3a4e7343a789	Q1-2026	2026-01-01	2026-03-31	26520.00	0.00	0.00	26520.00	PENDING	\N	\N	2026-05-30 05:11:51.049803	1
e2e89d80-89f5-4698-81b8-746c7cdafd99	7d0e3de3-648b-4f87-8bc4-a6495b9296df	Q1-2026	2026-01-01	2026-03-31	16575.00	0.00	0.00	16575.00	PENDING	\N	\N	2026-05-30 05:11:51.049803	1
845db2ef-5421-47ea-a048-fb66cb53e996	4487a596-6018-4730-89c0-732c19890ed0	Q4-2025	2025-10-01	2025-12-31	34000.00	5000.00	0.00	39000.00	PAID	2026-01-15	\N	2026-05-30 04:40:49.365354	1
e35dcd9c-ec2e-42dc-aa0f-1f0453b62401	7969fca6-148d-4d78-9d9c-3a4e7343a789	Q4-2025	2025-10-01	2025-12-31	22000.00	3000.00	0.00	25000.00	PAID	2026-01-15	\N	2026-05-30 04:40:49.365354	1
8a7cf4e1-c0b5-4e93-b9bb-67a6f2b7ff88	244368c9-181e-422c-8aba-f608c762fc8f	Q4-2025	2025-10-01	2025-12-31	58000.00	12000.00	0.00	70000.00	PAID	2026-01-15	\N	2026-05-30 04:40:49.365354	1
\.


--
-- Data for Name: pcd_mr_assignments; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.pcd_mr_assignments (id, partner_id, mr_id, assigned_date, is_active, notes, created_at) FROM stdin;
9ed9a2d4-56f2-4bd7-8d44-91de11712996	7969fca6-148d-4d78-9d9c-3a4e7343a789	d22e30f1-a67a-4c28-9e70-11022f276c55	2026-05-30	t	\N	2026-05-30 04:57:50.208905
9125d64c-25fb-434f-a737-1462421e6014	17d623ec-d5c1-4cee-85a5-0653b91905fe	21e2fbc0-4ddc-4ea7-bdf3-11f681754e90	2026-05-30	t	\N	2026-05-30 04:57:50.211361
1f8fc958-0cf4-43b8-a223-7e6560afb67a	244368c9-181e-422c-8aba-f608c762fc8f	e9c49e98-c522-4e71-81a8-21d15a4af2f3	2026-05-30	t	\N	2026-05-30 04:57:50.212405
06a27dfa-ed39-4a7e-aef6-41f1836c6797	32744608-4214-467b-8b2a-4173c8394dae	46016c4b-acd3-4ece-a5f6-919c56603994	2026-05-30	t	\N	2026-05-30 04:57:50.213385
c651417b-f237-4326-9a41-2b34f1b59063	da8274dd-4c0d-4166-bc87-42027b8ddb1d	39e50d58-7818-4d39-9e8d-51f504fa8f18	2026-05-30	t	\N	2026-05-30 04:57:50.214375
1b00df64-52f2-43d0-b80d-bf741374c484	7d0e3de3-648b-4f87-8bc4-a6495b9296df	d22e30f1-a67a-4c28-9e70-11022f276c55	2026-05-30	t	\N	2026-05-30 04:57:50.215116
04cec2a7-65b0-4f31-88fa-f23423e1508e	4487a596-6018-4730-89c0-732c19890ed0	21e2fbc0-4ddc-4ea7-bdf3-11f681754e90	2026-05-30	t	\N	2026-05-30 04:57:50.215956
\.


--
-- Data for Name: pcd_partner_documents; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.pcd_partner_documents (id, partner_id, document_type, document_name, file_url, expiry_date, renewal_date, status, verified_by, approved_at, created_by, created_at) FROM stdin;
\.


--
-- Data for Name: pcd_partners; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.pcd_partners (id, name, territory, state, district, contact_person, contact_number, email, drug_license_no, drug_license_expiry, gst_registration, gstin_expiry, credit_limit, discount_percentage, status, partner_grade, join_date, assigned_mr_ids, monopoly_territory, is_active, created_by, updated_by, created_at, updated_at, company_id) FROM stdin;
17d623ec-d5c1-4cee-85a5-0653b91905fe	Chennai MedSupply	Chennai West	Tamil Nadu	Chennai	Lakshmi Iyer	+91-9321098765	lakshmi@chennaimedsuply.com	TN-CHN-20B-2024-001	\N	33ABCXY1111G1Z1	\N	350000.00	7.50	ACTIVE	SILVER	2023-06-01	{21e2fbc0-4ddc-4ea7-bdf3-11f681754e90}	\N	t	\N	\N	2026-05-30 04:38:59.074866	2026-05-30 04:38:59.074866	1
244368c9-181e-422c-8aba-f608c762fc8f	Delhi Pharma Network	Delhi NCR	Delhi	New Delhi	Vikram Singh	+91-9543210987	vikram@delhipharma.com	DL-DEL-20B-2024-001	\N	07PQRST3456M4W8	\N	600000.00	10.00	ACTIVE	PLATINUM	2022-06-01	{e9c49e98-c522-4e71-81a8-21d15a4af2f3}	\N	t	\N	\N	2026-05-30 04:38:59.074866	2026-05-30 04:38:59.074866	1
32744608-4214-467b-8b2a-4173c8394dae	Hyderabad Drug House	Hyderabad Central	Telangana	Hyderabad	Ramesh Reddy	+91-9432109876	ramesh@hydbdrughouse.com	TS-HYD-20B-2024-001	\N	36UVWXY7890N5V9	\N	250000.00	6.50	PENDING	BRONZE	2024-01-05	{46016c4b-acd3-4ece-a5f6-919c56603994}	\N	t	\N	\N	2026-05-30 04:38:59.074866	2026-05-30 04:38:59.074866	1
da8274dd-4c0d-4166-bc87-42027b8ddb1d	Kolkata Drug Traders	Kolkata North	West Bengal	Kolkata	Subhash Ghosh	+91-9210987654	subhash@kolkatadrug.com	WB-KOL-20B-2024-001	\N	19MNOPQ2222H2Y2	\N	200000.00	5.50	ACTIVE	BRONZE	2023-09-15	{39e50d58-7818-4d39-9e8d-51f504fa8f18}	\N	t	\N	\N	2026-05-30 04:38:59.074866	2026-05-30 04:38:59.074866	1
7d0e3de3-648b-4f87-8bc4-a6495b9296df	Nair Healthcare Solutions	Bangalore South	Karnataka	Bangalore	Anoop Nair	+91-9654321098	anoop@nairhealthcare.com	KA-BLR-20B-2024-001	\N	29KLMNO9012L3X7	\N	400000.00	9.00	ACTIVE	GOLD	2022-11-20	{d22e30f1-a67a-4c28-9e70-11022f276c55}	\N	t	\N	\N	2026-05-30 04:38:59.074866	2026-05-30 04:38:59.074866	1
4487a596-6018-4730-89c0-732c19890ed0	Sunrise Pharma Distributors	Mumbai North	Maharashtra	Mumbai	Rajesh Kumar	+91-9876543210	rajesh@sunrisepharma.com	MH-MUM-20B-2024-001	\N	27ABCDE1234F1Z5	\N	500000.00	8.50	ACTIVE	GOLD	2023-01-15	{21e2fbc0-4ddc-4ea7-bdf3-11f681754e90}	\N	t	\N	\N	2026-05-30 04:38:59.074866	2026-05-30 04:38:59.074866	1
7969fca6-148d-4d78-9d9c-3a4e7343a789	Bharat Medical Agencies	Pune Central	Maharashtra	Pune	Suresh Patel	+91-9765432109	suresh@bharatmedical.com	MH-PUN-20B-2024-002	\N	27FGHIJ5678K2Y6	\N	300000.00	7.00	ACTIVE	SILVER	2023-03-10	{21e2fbc0-4ddc-4ea7-bdf3-11f681754e90,d22e30f1-a67a-4c28-9e70-11022f276c55}	\N	t	\N	\N	2026-05-30 04:38:59.074866	2026-05-30 10:46:07.822476	1
\.


--
-- Data for Name: pcd_receivables; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.pcd_receivables (id, partner_id, invoice_id, invoice_date, invoice_amount, paid_amount, outstanding_amount, due_date, days_overdue, status, credit_limit_exceeded, created_at, updated_at, company_id) FROM stdin;
7b7ad2d9-3024-492d-b81d-c4994c225af3	4487a596-6018-4730-89c0-732c19890ed0	INV-2026-001	2026-03-05	177000.00	80000.00	97000.00	2026-04-05	55	PARTIAL	f	2026-05-30 04:41:14.990295	2026-05-30 04:41:14.990295	1
fae16d99-de11-4273-b8f9-d153534d8c14	7d0e3de3-648b-4f87-8bc4-a6495b9296df	INV-2026-004	2026-03-22	100000.00	0.00	100000.00	2026-04-22	38	OPEN	f	2026-05-30 04:41:14.990295	2026-05-30 04:41:14.990295	1
983c2239-e0c1-432d-acf4-fcbfeb9b2be2	7d0e3de3-648b-4f87-8bc4-a6495b9296df	INV-2026-006	2026-04-10	220000.00	110000.00	110000.00	2026-05-10	20	PARTIAL	f	2026-05-30 05:06:17.733655	2026-05-30 05:06:17.733655	1
40a1bfdb-5181-40d1-bcd1-effd254be165	17d623ec-d5c1-4cee-85a5-0653b91905fe	INV-2026-007	2026-05-15	85000.00	85000.00	0.00	2026-06-14	0	CLEARED	f	2026-05-30 05:06:17.733655	2026-05-30 05:06:17.733655	1
133bd58c-e5ae-4409-93b4-174ce178e0f1	4487a596-6018-4730-89c0-732c19890ed0	INV-2026-008	2026-05-25	180000.00	0.00	180000.00	2026-06-24	0	OPEN	f	2026-05-30 05:06:17.733655	2026-05-30 05:06:17.733655	1
86bd83b6-1b0c-48e5-abb7-0b755dcfaf34	244368c9-181e-422c-8aba-f608c762fc8f	INV-2026-003	2026-03-18	290000.00	2000.00	288000.00	2026-04-18	42	PARTIAL	f	2026-05-30 04:41:14.990295	2026-05-30 13:42:52.66359	1
bc15dbf4-0a21-4e8a-89cf-13e298ea301d	7969fca6-148d-4d78-9d9c-3a4e7343a789	INV-2026-005	2026-02-19	145000.00	2000.00	143000.00	2026-03-21	70	PARTIAL	f	2026-05-30 05:06:17.733655	2026-05-31 05:07:32.066443	1
\.


--
-- Data for Name: pcd_schemes; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.pcd_schemes (id, name, description, scheme_type, validity_start, validity_end, minimum_order, discount_percentage, free_products_qty, free_product_name, bonus_cash, eligibility_criteria, applicable_partner_grades, status, created_by, created_at, updated_at, company_id, terms, bonus_incentives, target_products, scheme_code) FROM stdin;
bc273718-ed46-4801-9523-37fd2947a384	Q1 Festive Boost	Extra 3% discount + free samples on orders above 50K	DISCOUNT	2026-01-01	2026-03-31	50000.00	3.00	5	MetaMol 500mg Strips	0.00	\N	SILVER,GOLD,PLATINUM	ACTIVE	\N	2026-05-30 04:38:59.07667	2026-05-30 04:38:59.07667	1	\N	\N	\N	\N
e0890a11-8460-41c8-8e3e-3237bc41d32c	Platinum Loyalty Scheme	Exclusive 5% additional discount for Platinum partners	LOYALTY	2026-01-01	2026-12-31	100000.00	5.00	0		0.00	\N	PLATINUM	ACTIVE	\N	2026-05-30 04:38:59.07667	2026-05-30 04:38:59.07667	1	\N	\N	\N	\N
45f8a860-4b5f-422b-ab8d-c194c05dda46	New Partner Welcome	10% discount + starter kit for new onboarded partners	WELCOME	2026-01-01	2026-06-30	10000.00	10.00	10	Starter Sample Kit	0.00	\N	BRONZE	ACTIVE	\N	2026-05-30 04:38:59.07667	2026-05-30 04:38:59.07667	1	\N	\N	\N	\N
1631c29a-9d88-4c2e-8391-d42250e22722	Summer Cardiac Drive	Boost cardiac product sales — 4% extra + cash bonus	INCENTIVE	2026-04-01	2026-06-30	75000.00	4.00	0		0.00	\N	,GOLD,PLATINUM	ACTIVE	\N	2026-05-30 04:38:59.07667	2026-05-30 04:38:59.07667	1	\N	\N	\N	\N
2ab9050b-f9c8-4f32-8fe0-3c7248a3b373	Q1 Festive Boost	Extra 3% discount + free samples on orders above 50K	Value	\N	2026-03-31	50000.00	3.00	0	Free Samples	0.00	\N	\N	ACTIVE	\N	2026-05-30 05:54:39.164408	2026-05-30 05:54:39.164408	1	\N	\N	\N	\N
64e7ee96-a031-42f8-8acf-0484ee49adb0	Platinum Loyalty Scheme	Exclusive 5% additional discount for Platinum partners	Value	\N	2026-12-31	100000.00	5.00	0	\N	0.00	\N	\N	ACTIVE	\N	2026-05-30 05:54:39.164408	2026-05-30 05:54:39.164408	1	\N	\N	\N	\N
3b0efefd-d9ea-4e47-9ccf-561ed800c49f	New Partner Welcome	10% discount + starter kit for new onboarded partners	Value	\N	2026-06-30	10000.00	10.00	0	Starter Kit	0.00	\N	\N	ACTIVE	\N	2026-05-30 05:54:39.164408	2026-05-30 05:54:39.164408	1	\N	\N	\N	\N
e11ce822-5810-4c22-aeff-e20bd47f7638	Summer Cardiac Drive	Boost cardiac product sales — 4% extra + cash bonus	VOLUME	\N	2026-06-30	75000.00	4.00	\N	\N	\N	\N	\N	\N	\N	2026-05-30 05:54:39.164408	2026-05-30 05:55:00.169169	1	\N	\N	\N	\N
\.


--
-- Data for Name: pcd_targets; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.pcd_targets (id, partner_id, period, period_start, period_end, target_amount, achieved_amount, incentive_percentage, bonus_amount, status, created_at, updated_at, company_id) FROM stdin;
35eee886-8c97-41bd-9323-0d58034c1823	4487a596-6018-4730-89c0-732c19890ed0	Q1-2026	2026-01-01	2026-03-31	500000.00	387000.00	3.50	0.00	IN_PROGRESS	2026-05-30 04:40:49.361841	2026-05-30 04:40:49.361841	1
c6a0d075-2bc3-4cd0-a97f-1971aa5a0117	7969fca6-148d-4d78-9d9c-3a4e7343a789	Q1-2026	2026-01-01	2026-03-31	300000.00	312000.00	4.00	0.00	ACHIEVED	2026-05-30 04:40:49.361841	2026-05-30 04:40:49.361841	1
a87fdcdd-d028-4aed-8a42-dccd9d9f1c23	244368c9-181e-422c-8aba-f608c762fc8f	Q1-2026	2026-01-01	2026-03-31	700000.00	820000.00	5.00	0.00	EXCEEDED	2026-05-30 04:40:49.361841	2026-05-30 04:40:49.361841	1
0be525e0-cf27-4b38-9e2b-7fc805de226b	7d0e3de3-648b-4f87-8bc4-a6495b9296df	Q1-2026	2026-01-01	2026-03-31	400000.00	195000.00	3.00	0.00	IN_PROGRESS	2026-05-30 04:40:49.361841	2026-05-30 04:40:49.361841	1
dbc23850-6a25-4886-a857-6ff723e22421	17d623ec-d5c1-4cee-85a5-0653b91905fe	Q2 2026	2026-04-01	2026-06-30	170000.00	0.00	2.50	0.00	IN_PROGRESS	2026-05-30 13:42:23.667471	2026-05-30 13:42:23.667471	1
\.


--
-- Data for Name: pcd_transactions; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.pcd_transactions (id, partner_id, mr_id, order_date, order_amount, product_name, quantity, order_status, payment_status, scheme_applied_id, discount_given, notes, created_by, created_at, updated_at, company_id) FROM stdin;
9269b503-5aa2-486d-951a-6fb426bf8421	4487a596-6018-4730-89c0-732c19890ed0	\N	2026-01-10	85000.00	MetaMol 500mg	200	DELIVERED	PAID	\N	8.50	\N	\N	2026-05-30 04:40:49.36405	2026-05-30 04:40:49.36405	1
3fd805e0-caad-4777-853f-db88ea846ad5	4487a596-6018-4730-89c0-732c19890ed0	\N	2026-02-14	125000.00	MetaCard 10mg	300	DELIVERED	PAID	\N	8.50	\N	\N	2026-05-30 04:40:49.36405	2026-05-30 04:40:49.36405	1
0e95e1cc-d1fe-473f-8653-2f48125c27d9	4487a596-6018-4730-89c0-732c19890ed0	\N	2026-03-05	177000.00	MetaMol+MetaCard	450	DELIVERED	PARTIAL	\N	8.50	\N	\N	2026-05-30 04:40:49.36405	2026-05-30 04:40:49.36405	1
d94fcf05-467f-45c0-a1d2-9b80460b53c4	7969fca6-148d-4d78-9d9c-3a4e7343a789	\N	2026-01-20	95000.00	MetaCard 10mg	180	DELIVERED	PAID	\N	7.00	\N	\N	2026-05-30 04:40:49.36405	2026-05-30 04:40:49.36405	1
4f187909-6d6a-48b5-9f72-6c39a42bc9e7	7969fca6-148d-4d78-9d9c-3a4e7343a789	\N	2026-02-28	217000.00	MetaVir 400mg	500	DELIVERED	PAID	\N	7.00	\N	\N	2026-05-30 04:40:49.36405	2026-05-30 04:40:49.36405	1
47302116-72a3-4c87-9efd-8188ab68fb9b	244368c9-181e-422c-8aba-f608c762fc8f	\N	2026-01-08	220000.00	MetaMol 500mg	600	DELIVERED	PAID	\N	10.00	\N	\N	2026-05-30 04:40:49.36405	2026-05-30 04:40:49.36405	1
a64b2167-6fad-4fa6-a710-7a2d7e43a92a	244368c9-181e-422c-8aba-f608c762fc8f	\N	2026-02-22	310000.00	MetaCard+MetaVir	700	DELIVERED	PAID	\N	10.00	\N	\N	2026-05-30 04:40:49.36405	2026-05-30 04:40:49.36405	1
68ef1686-7c20-4544-b679-2416c871edd8	244368c9-181e-422c-8aba-f608c762fc8f	\N	2026-03-18	290000.00	MetaCard 10mg	650	DELIVERED	UNPAID	\N	10.00	\N	\N	2026-05-30 04:40:49.36405	2026-05-30 04:40:49.36405	1
1bcd774e-8751-4b53-826c-902287c1159d	7d0e3de3-648b-4f87-8bc4-a6495b9296df	\N	2026-01-15	95000.00	MetaVir 400mg	220	DELIVERED	PAID	\N	9.00	\N	\N	2026-05-30 04:40:49.36405	2026-05-30 04:40:49.36405	1
4e2cd2e8-0f56-4b1e-80f5-b5245e3252af	7d0e3de3-648b-4f87-8bc4-a6495b9296df	\N	2026-03-22	100000.00	MetaMol 500mg	250	PROCESSING	UNPAID	\N	9.00	\N	\N	2026-05-30 04:40:49.36405	2026-05-30 04:40:49.36405	1
b305569e-a163-4d24-b2c0-6d59284dc67e	17d623ec-d5c1-4cee-85a5-0653b91905fe	21e2fbc0-4ddc-4ea7-bdf3-11f681754e90	2026-05-30	75000.00	Summer Cardiac Drive	1	DELIVERED	UNPAID	\N	0.00	\N	\N	2026-05-30 11:07:35.903328	2026-05-30 11:07:35.903328	1
50ea0754-6279-40ba-b1f9-089df1b3c354	17d623ec-d5c1-4cee-85a5-0653b91905fe	21e2fbc0-4ddc-4ea7-bdf3-11f681754e90	2026-05-30	75000.00	Summer Cardiac Drive	1	DELIVERED	UNPAID	\N	0.00	\N	\N	2026-05-30 11:07:44.937546	2026-05-30 11:07:44.937546	1
\.


--
-- Data for Name: pdc_cheques; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.pdc_cheques (id, company_id, party_id, bank_account_id, cheque_number, cheque_date, amount, cheque_type, status, bounce_reason, narration, journal_voucher_id, created_by, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: pdc_register; Type: TABLE DATA; Schema: public; Owner: erp_user
--

COPY public.pdc_register (id, pdc_type, party_id, cheque_no, cheque_date, bank_name, amount, narration, status, receipt_id, payment_id, deposited_date, bounce_reason, created_at) FROM stdin;
\.


--
-- Data for Name: pos_bill_items; Type: TABLE DATA; Schema: public; Owner: erp_user
--

COPY public.pos_bill_items (id, bill_id, product_id, product_name, hsn_code, batch_no, expiry_date, qty, unit, mrp, sale_rate, discount_percent, discount_amount, taxable_value, gst_percent, cgst_percent, sgst_percent, igst_percent, cgst_amount, sgst_amount, igst_amount, line_total, created_at, batch_id) FROM stdin;
\.


--
-- Data for Name: pos_bills; Type: TABLE DATA; Schema: public; Owner: erp_user
--

COPY public.pos_bills (id, bill_no, session_id, bill_date, party_id, patient_name, doctor_name, prescription_no, subtotal, discount_percent, discount_amount, taxable_amount, cgst_amount, sgst_amount, igst_amount, cess_amount, total_tax, round_off, net_payable, amount_paid, change_returned, payment_status, status, is_gst_bill, customer_state_code, supply_type, voucher_id, created_by, created_at) FROM stdin;
\.


--
-- Data for Name: pos_payments; Type: TABLE DATA; Schema: public; Owner: erp_user
--

COPY public.pos_payments (id, bill_id, payment_mode, amount, reference_no, payment_date, created_at) FROM stdin;
\.


--
-- Data for Name: pos_sessions; Type: TABLE DATA; Schema: public; Owner: erp_user
--

COPY public.pos_sessions (id, session_date, terminal_id, opened_by, opening_cash, closed_by, closing_cash, expected_cash, cash_difference, total_sales, total_returns, total_cash, total_card, total_upi, total_credit, bill_count, status, z_report_url, opened_at, closed_at) FROM stdin;
d9667ea1-e9be-4f65-9e73-a18cb8767751	2026-05-29	MAIN	11111111-1111-1111-1111-111111111111	2000.00	\N	\N	\N	\N	0.00	0.00	0.00	0.00	0.00	0.00	0	OPEN	\N	2026-05-29 16:07:04.651174	\N
\.


--
-- Data for Name: production_orders; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.production_orders (id, order_no, product_id, bom_id, quantity, status, start_date, end_date, created_by, created_at) FROM stdin;
\.


--
-- Data for Name: products; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.products (id, code, name, generic_name, manufacturer, source, therapeutic_category, category, packing, uom, hsn, gst, min_stock_level, reorder_level, reorder_qty, rack, schedule_type, is_narcotic, is_temperature_sensitive, purchase_rate, selling_rate, ptr, pts, opening_stock, current_stock, maintain_batches, track_expiry, is_active, last_received_date, branch_distribution, valuation_method, default_godown_id, deleted_at, created_by, updated_by, created_at, updated_at, enable_batch_tracking, enable_serial_tracking, is_fast_moving, min_shelf_life_months, requires_quality_check, is_compliance_tracked, abc_class, turnover_ratio, is_slow_moving, mrp, company_id) FROM stdin;
33333333-3333-3333-3333-333333333331	\N	Dolo 650	Paracetamol 650mg	Micro Labs	TRADING	Analgesic/Antipyretic	\N	15x10	Strip	30049099	12.00	100	200	0	\N	OTC	f	f	0.00	0.00	0.00	0.00	0	0	t	t	t	\N	f	FIFO	\N	\N	\N	\N	2026-05-22 17:51:18.470608	2026-05-22 17:51:18.470608	t	f	f	\N	f	t	\N	\N	f	0.00	1
33333333-3333-3333-3333-333333333332	\N	Augmentin 625 Duo	Amoxicillin + Clavulanic Acid	GSK	TRADING	Antibiotic	\N	10x10	Strip	30049099	12.00	50	100	0	\N	H	f	f	0.00	0.00	0.00	0.00	0	0	t	t	t	\N	f	FIFO	\N	\N	\N	\N	2026-05-22 17:51:18.470608	2026-05-22 17:51:18.470608	t	f	f	\N	f	t	\N	\N	f	0.00	1
33333333-3333-3333-3333-333333333333	\N	Corex Syrup 100ml	Chlorpheniramine + Codeine	Pfizer	TRADING	Antitussive	\N	100ml	Bottle	30049099	12.00	20	50	0	\N	H	f	f	0.00	0.00	0.00	0.00	0	0	t	t	t	\N	f	FIFO	\N	\N	\N	\N	2026-05-22 17:51:18.470608	2026-05-22 17:51:18.470608	t	f	f	\N	f	t	\N	\N	f	0.00	1
33333333-3333-3333-3333-333333333334	\N	Pantocid DSR	Pantoprazole + Domperidone	Sun Pharma	TRADING	Antacid	\N	15x10	Strip	30049099	12.00	80	150	0	\N	OTC	f	f	0.00	0.00	0.00	0.00	0	0	t	t	t	\N	f	FIFO	\N	\N	\N	\N	2026-05-22 17:51:18.470608	2026-05-22 17:51:18.470608	t	f	f	\N	f	t	\N	\N	f	0.00	1
33333333-3333-3333-3333-333333333335	\N	Metapharsic MultiVit	Multivitamin Complex	Metapharsic	OWN_MANUFACTURING	Vitamin Supplement	\N	30s	Bottle	21069099	18.00	200	500	0	\N	OTC	f	f	0.00	0.00	0.00	0.00	0	0	t	t	t	\N	f	FIFO	\N	\N	\N	\N	2026-05-22 17:51:18.470608	2026-05-22 17:51:18.470608	t	f	f	\N	f	t	\N	\N	f	0.00	1
8c2abe12-1114-4dfa-b5bc-7ad5fa276f0d	\N	MetaMol 650	Paracetamol 650mg	Metapharsic Mfg	TRADING	\N	\N	\N	Strip	3004	12.00	50	100	0	\N	OTC	f	f	0.00	0.00	0.00	0.00	0	0	t	t	t	\N	f	FIFO	\N	\N	\N	\N	2026-05-29 11:46:18.209639	2026-05-29 11:46:18.209639	t	f	f	\N	f	t	\N	\N	f	0.00	1
24547ecb-5d6e-49a1-931e-cb188f20e682	\N	MetaClav 625	Amoxicillin 500mg + Clav 125mg	Metapharsic Mfg	TRADING	\N	\N	\N	Strip	3004	12.00	50	100	0	\N	OTC	f	f	0.00	0.00	0.00	0.00	0	0	t	t	t	\N	f	FIFO	\N	\N	\N	\N	2026-05-29 11:46:18.209639	2026-05-29 11:46:18.209639	t	f	f	\N	f	t	\N	\N	f	0.00	1
0334d868-6c8d-4e1d-b8df-cbc1533a8855	\N	MetaPan 40	Pantoprazole 40mg	Metapharsic Mfg	TRADING	\N	\N	\N	Strip	3004	12.00	50	100	0	\N	OTC	f	f	0.00	0.00	0.00	0.00	0	0	t	t	t	\N	f	FIFO	\N	\N	\N	\N	2026-05-29 11:46:18.209639	2026-05-29 11:46:18.209639	t	f	f	\N	f	t	\N	\N	f	0.00	1
\.


--
-- Data for Name: purchase_budgets; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.purchase_budgets (id, category_id, period_name, budgeted_amount, spent_amount, committed_amount, status, created_at) FROM stdin;
\.


--
-- Data for Name: purchase_invoice_items; Type: TABLE DATA; Schema: public; Owner: erp_user
--

COPY public.purchase_invoice_items (id, invoice_id, sr_no, product_id, product_name, hsn_code, batch_no, mfg_date, expiry_date, qty, unit, rate, mrp, discount_percent, taxable_value, gst_rate, cgst_rate, sgst_rate, igst_rate, cgst_amount, sgst_amount, igst_amount, line_total) FROM stdin;
\.


--
-- Data for Name: purchase_invoices; Type: TABLE DATA; Schema: public; Owner: erp_user
--

COPY public.purchase_invoices (id, voucher_no, vendor_invoice_no, invoice_type, invoice_date, due_date, party_id, place_of_supply, subtotal, discount_amount, taxable_amount, cgst, sgst, igst, tds_section, tds_rate, tds_amount, net_amount, paid_amount, outstanding, status, payment_status, voucher_id, approved_by, approved_at, created_by, created_at) FROM stdin;
\.


--
-- Data for Name: purchase_items; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.purchase_items (id, purchase_id, product_id, batch_number, expiry_date, quantity, purchase_rate, mrp, gst_percent, amount) FROM stdin;
4c2c34a6-b05e-410a-a7e2-7359408ce589	77777777-7777-7777-7777-777777777771	33333333-3333-3333-3333-333333333331	B-DOLO-002	2028-05-22	500	20.00	30.00	12.00	10000.00
e02fd036-b1b4-4464-a2cf-b33183bab8e0	77777777-7777-7777-7777-777777777771	33333333-3333-3333-3333-333333333332	B-AUG-002	2027-05-22	200	150.00	200.00	12.00	30000.00
694fe0c3-01ec-4005-ab3e-55294b054438	77777777-7777-7777-7777-777777777771	33333333-3333-3333-3333-333333333334	B-PAN-002	2029-05-22	100	100.00	150.00	12.00	10000.00
\.


--
-- Data for Name: purchase_order_items; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.purchase_order_items (id, po_id, product_id, quantity, unit_price, total_amount, created_at) FROM stdin;
\.


--
-- Data for Name: purchase_orders; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.purchase_orders (id, company_id, supplier_id, po_number, date, total_amount, status, created_by, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: purchases; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.purchases (id, supplier_id, invoice_number, date, total_amount, status, payment_status, created_at) FROM stdin;
77777777-7777-7777-7777-777777777771	55555555-5555-5555-5555-555555555551	PO-AP-9923	2026-05-12	50000.00	Received	Unpaid	2026-05-22 17:51:18.475526
\.


--
-- Data for Name: qc_parameters; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.qc_parameters (id, record_id, parameter, standard, result, status, created_at) FROM stdin;
\.


--
-- Data for Name: qc_records; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.qc_records (id, batch_id, batch_number, product_name, test_date, tested_by, final_status, coa_generated, remarks, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: qc_reports; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.qc_reports (id, production_order_id, batch_number, test_date, tester_name, status, overall_result, created_at) FROM stdin;
\.


--
-- Data for Name: qc_test_results; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.qc_test_results (id, qc_report_id, parameter_name, specification, result_value, status) FROM stdin;
\.


--
-- Data for Name: receipt_allocations; Type: TABLE DATA; Schema: public; Owner: erp_user
--

COPY public.receipt_allocations (id, receipt_id, invoice_id, allocated_amount, created_at) FROM stdin;
\.


--
-- Data for Name: receipt_vouchers; Type: TABLE DATA; Schema: public; Owner: erp_user
--

COPY public.receipt_vouchers (id, receipt_no, receipt_date, party_id, bank_account_id, payment_mode, amount, tds_amount, net_received, cheque_no, cheque_date, bank_name, utr_no, narration, status, voucher_id, created_by, created_at) FROM stdin;
\.


--
-- Data for Name: recurring_entries; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.recurring_entries (id, company_id, template_name, frequency, next_run_date, end_date, amount, debit_account_id, credit_account_id, narration, is_active, created_by, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: refresh_tokens; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.refresh_tokens (id, user_id, token_hash, expires_at, revoked, revoked_at, created_at, ip_address, user_agent) FROM stdin;
c0d98f35-fb24-4500-885b-c4acaca7f4ee	11111111-1111-1111-1111-111111111111	c9b96749953b2f86f2604ce0e34618b61d059f6b0f62d59a963d96c229bffe6f	2026-05-29 17:56:08.644	f	\N	2026-05-22 17:56:08.645813	\N	\N
3a881819-6fa6-408a-950a-1cfab6f59744	11111111-1111-1111-1111-111111111111	de550f813944a1c4fa7c7d2768f351c55713931d16e5577d4c50a43b4d985de9	2026-06-01 09:24:46.873	f	\N	2026-05-25 09:24:46.87631	\N	\N
7ce064f6-64fa-43cc-b03b-19d588e35e5a	11111111-1111-1111-1111-111111111111	5c3fcc984eaebaa48fa10d4ed8b56289206580caac051a5562a0e0ef955d664a	2026-06-01 09:25:49.644	f	\N	2026-05-25 09:25:49.645195	\N	\N
2327f58a-ff71-430f-87e6-68cae8c69c90	11111111-1111-1111-1111-111111111111	389caa54daf1d93b66bcf30baacdd4b3e865e202074703236c8479e10cf2b27e	2026-06-01 11:52:03.814	f	\N	2026-05-25 11:52:03.816855	\N	\N
b1c25540-a088-4561-a129-1d20f6bfc89b	11111111-1111-1111-1111-111111111111	f6eb76a8cccdbcd2779135701758570f14d9d714df4695a6ae80bea00a84c266	2026-06-01 11:52:33.468	f	\N	2026-05-25 11:52:33.470387	\N	\N
b7814edf-e67f-4fd0-a8a1-a0d9332c0583	11111111-1111-1111-1111-111111111111	7a7fe0269f4ca9dbd0708b73a69c2599d6da9ac8648e1eac67ec11cc80039455	2026-06-01 15:13:39.54	f	\N	2026-05-25 15:13:39.542657	\N	\N
4c9dfe46-fbf7-4cec-8ee3-89616297357d	11111111-1111-1111-1111-111111111111	12d48a899a86cc37c55b97937c46d0599e5352bc9d8f2a17079ca4f90f356e7b	2026-06-01 15:14:20.155	f	\N	2026-05-25 15:14:20.156291	\N	\N
dacf5986-647f-47b2-b537-4844480d01f3	11111111-1111-1111-1111-111111111111	813cfe17cfe1a0bf47d9d4760a2989361549393452c7b810f02ec5431f6c081b	2026-06-01 15:15:47.495	f	\N	2026-05-25 15:15:47.496448	\N	\N
07edc329-920a-4822-af1b-03c76636bd4e	11111111-1111-1111-1111-111111111111	ec4ab1f2e505a0ac911a144f3b8111d518d8c57dfaa325f69c813eef7b0eb87a	2026-06-01 15:17:48.45	f	\N	2026-05-25 15:17:48.453405	\N	\N
a5d2ad96-c055-4f96-ae51-1095284ccfd6	11111111-1111-1111-1111-111111111111	ff28eb742c95710c9e1dccb3ca1d7b4afc56f91de1e2f9fdefd4a7baf51e1524	2026-06-01 19:28:18.61	f	\N	2026-05-25 19:28:18.612369	\N	\N
8219d460-4d55-486a-a434-69a03699739b	11111111-1111-1111-1111-111111111111	54605a53bfd4d88a8735afd1f0e21e3fead69ff4ca0e96fd511c1746aeef08f3	2026-06-01 19:34:07.346	f	\N	2026-05-25 19:34:07.347166	\N	\N
e9bdac91-ea7f-478d-b10a-68e461aad290	11111111-1111-1111-1111-111111111111	018b0342362ccd490ba3008e82a8b2dd6593faa79a0cb2fdd1e4daf0d01f5dea	2026-06-02 04:40:38.572	f	\N	2026-05-26 04:40:38.573365	\N	\N
d4f589ab-4964-4cb3-878f-04d17e442129	11111111-1111-1111-1111-111111111111	77c248663ac6f526fcbed501825764a55df69d9a7f247e5c5c7d27595aa08a82	2026-06-02 04:42:24.724	f	\N	2026-05-26 04:42:24.725367	\N	\N
47d6932f-2b7a-4955-b213-ba585da2f839	11111111-1111-1111-1111-111111111111	9204fc6d45a16d7f232d70b9492a25493dd7bf23b0db1fdc4289b02eadeeeec4	2026-06-02 04:45:28.474	f	\N	2026-05-26 04:45:28.476359	\N	\N
2c6db1a6-1936-4c3f-a266-44d7ded2645e	11111111-1111-1111-1111-111111111111	acd84ea9bb2a8761ea553e365582f1639fa5868a930f6321a443a785f94f4f3a	2026-06-02 05:14:16.267	f	\N	2026-05-26 05:14:16.270684	\N	\N
e4d3782e-7016-41c5-877d-2881a22316da	11111111-1111-1111-1111-111111111111	c708a498d06d1044ef10909f90a248fa40f09249f0eeb826f881d064d710ab82	2026-06-05 19:24:34.743	f	\N	2026-05-29 19:24:34.745794	\N	\N
077437e3-c4d3-41db-9c15-bd3a835c7249	11111111-1111-1111-1111-111111111111	94397653778227f18e7932dffa54ac891063af5d9bcb178ecac2624757431541	2026-06-05 19:25:09.188	f	\N	2026-05-29 19:25:09.189681	\N	\N
6650a262-19b2-46a5-a44d-ac617488d069	11111111-1111-1111-1111-111111111111	91c5b21e859c04bdbe2227574a4b4c6eafdb3169a602ba1792546f0f1973481a	2026-06-05 19:25:57.418	f	\N	2026-05-29 19:25:57.419036	\N	\N
05af0d69-955b-4555-9b2c-e970272cdb5a	11111111-1111-1111-1111-111111111111	6c617f9f665fd2f5a732c12eb48969f44264a5f7f1f19e1978a258e39ccc0332	2026-06-06 03:17:52.066	f	\N	2026-05-30 03:17:52.067138	\N	\N
58ae3477-dbc1-4a68-9558-520f737d28c2	11111111-1111-1111-1111-111111111111	585d95ef73b64a37bf38f5eb61f9ed9dafa22be62dcdaeeae4e09284491b6487	2026-06-06 03:24:38.494	f	\N	2026-05-30 03:24:38.494671	\N	\N
9ccb2ace-31e0-4c72-b575-f6e200bb2a31	11111111-1111-1111-1111-111111111111	5fa3450f5af77029c8343fbedd7c4663207593bc7c4d6a7151b58e23cba71aa6	2026-06-06 03:49:06.494	f	\N	2026-05-30 03:49:06.495827	\N	\N
7c85243c-a275-4f0b-9ba3-2b18155e4f3e	11111111-1111-1111-1111-111111111111	2ab1428a046350badde9383084ab34fc50d77e9fbc8b454cf73f67e5c3418568	2026-06-06 03:54:44.855	f	\N	2026-05-30 03:54:44.856351	\N	\N
40778fb2-4747-4b02-bf26-890c53e5dd21	11111111-1111-1111-1111-111111111111	1b5affa5a785d25c5871c30bca33116325e4d560f315f6e6a5c5ba264bebc3ae	2026-06-06 03:57:07.76	f	\N	2026-05-30 03:57:07.761426	\N	\N
55464bdc-d1fb-49d2-984f-3990319006ea	11111111-1111-1111-1111-111111111111	89dd84276d69238214c77489873e97c39de8d54217a532b19a8dd94a74be339d	2026-06-06 03:59:01.996	f	\N	2026-05-30 03:59:01.996924	\N	\N
fafad435-9c7e-4f9f-b90e-95150351ca8e	11111111-1111-1111-1111-111111111111	0e538188bb6918ce515f3ccc9d63d6b93ef1794ded3226ef025515abaebaef4e	2026-06-06 04:16:50.831	f	\N	2026-05-30 04:16:50.832441	\N	\N
dc39c79a-a968-43af-b300-9f35f7a276ab	11111111-1111-1111-1111-111111111111	b7a208a700ef4cd40940faaccec6d0f400d3405a33c97ad585f85bf1f40ac2ab	2026-06-06 04:20:03.056	f	\N	2026-05-30 04:20:03.057381	\N	\N
2f4134f7-2b32-4786-b762-a2eb46528661	11111111-1111-1111-1111-111111111111	b465de62672ca8c1f21ffdd6d02cbce196ea760e96404c2e5def0bb8a6f06206	2026-06-06 04:21:05.845	f	\N	2026-05-30 04:21:05.84578	\N	\N
27339836-53d6-4a3f-9f11-72c265465fa5	11111111-1111-1111-1111-111111111111	b8cfc956479a49afc7f9406de3b9eea44c12fb20d0d01903bf74c6a9dc834ac8	2026-06-06 04:23:14.291	f	\N	2026-05-30 04:23:14.29263	\N	\N
ad53f606-003d-4a40-b4b5-f24729b6b68c	11111111-1111-1111-1111-111111111111	c75bd8a40de4309d7d75a5c5ede9006a2395961ecad6bf57a6d926554b5493e3	2026-06-06 04:23:50.113	f	\N	2026-05-30 04:23:50.114072	\N	\N
0fe500a1-e446-49b0-99c4-f265fb6253c0	11111111-1111-1111-1111-111111111111	b7bcdd159470c3bafde066fd4349170eaef483e9ff34238dea6dc34055b22108	2026-06-06 04:24:22.823	f	\N	2026-05-30 04:24:22.824321	\N	\N
181e5f74-8d87-4708-bfd3-3b1c7b1ca60c	11111111-1111-1111-1111-111111111111	f5551065aa99681a3dc4624932f4c125ca9aec6e8708d7d18292c3deed496338	2026-06-06 04:27:17.719	f	\N	2026-05-30 04:27:17.720112	\N	\N
7965a380-acee-463a-8a10-9ccb6b6709a2	11111111-1111-1111-1111-111111111111	ee79abfce9fa37061e4295373c72f3f128bb6ab74f410189a48a1e29b4481e25	2026-06-06 04:30:44.575	f	\N	2026-05-30 04:30:44.575795	\N	\N
163d4e17-3c89-4bd5-b53b-62cb024f7dbb	11111111-1111-1111-1111-111111111111	bb9303d1aac06490efbad46965a95d62eb18c8178928b93072c72d9e798bf3c9	2026-06-06 04:41:19.199	f	\N	2026-05-30 04:41:19.201082	\N	\N
0efac8c7-a06d-4150-8505-98c5038ca8e8	11111111-1111-1111-1111-111111111111	bc912d8127cfb779b8127abb3824c03a03f05750a4e12bc2efed2546f3481d80	2026-06-06 04:41:46.105	f	\N	2026-05-30 04:41:46.106062	\N	\N
92f56efb-7c0f-4b20-bd95-f948fef2480b	11111111-1111-1111-1111-111111111111	3444a10f7c7b8bf1fc4b28565bd294a5678e0d9d64cdf51565d14eb0e28f3339	2026-06-06 04:45:04.821	f	\N	2026-05-30 04:45:04.823476	\N	\N
b355af92-f339-4232-bf25-68e1f794e1c7	11111111-1111-1111-1111-111111111111	7c7ef1ce2c3e08e92f609b1a9319194d51b02134abba151768dfa894680bbf7c	2026-06-06 04:45:12.934	f	\N	2026-05-30 04:45:12.934985	\N	\N
69101f81-6338-460f-87c9-5ae619f7b955	11111111-1111-1111-1111-111111111111	2a991cb22346d06582144c7703bc4c8a3629a04a581c56768fbad22f9105906c	2026-06-06 04:49:38.431	f	\N	2026-05-30 04:49:38.431773	\N	\N
e9f9ff37-49bc-4a04-931e-4070697ac122	11111111-1111-1111-1111-111111111111	9d8c6885f808fe0edc12a77b8f172016a229b3955d039c54af3736a3406f5b5d	2026-06-06 04:50:58.227	f	\N	2026-05-30 04:50:58.227847	\N	\N
795ee088-0dfd-471d-b9b5-2af1d71af81c	11111111-1111-1111-1111-111111111111	25de762f0da0abacfb89d1946a704daac1ce3e578151e4dfc036d59bdbbcd939	2026-06-06 04:52:00.353	f	\N	2026-05-30 04:52:00.353934	\N	\N
c645086e-d517-4ba5-9906-a1c94ffc7b0f	11111111-1111-1111-1111-111111111111	97056a1f70f64804eaddf2c3ea8c765af644494858061e3190cc44fb816cd463	2026-06-06 04:59:52.33	f	\N	2026-05-30 04:59:52.332319	\N	\N
0ca20e01-76fc-4e1d-bebc-15f89f40b0fb	11111111-1111-1111-1111-111111111111	7d7e557f5a27eebbcae248a2624d475bee31af7eed9e9e808aed574d554a8cec	2026-06-06 05:02:06.816	f	\N	2026-05-30 05:02:06.817463	\N	\N
701dcf2f-009b-4886-b0d0-dd8166f8cf30	11111111-1111-1111-1111-111111111111	fe39f6d30d962ee295de54480ed0aceb1ca948effed8a2db9f53ced916c303fc	2026-06-06 05:08:34.635	f	\N	2026-05-30 05:08:34.636142	\N	\N
58ef27bb-adc2-495c-b40e-3a57a8c9e018	11111111-1111-1111-1111-111111111111	f3416093b155b7f56c82da818a2b693cddf8c7ff97097c6188318bed09baef20	2026-06-06 05:26:48.458	f	\N	2026-05-30 05:26:48.459012	\N	\N
d7cda2ca-5aef-4206-97ec-10789d6b81d0	11111111-1111-1111-1111-111111111111	2221e044bdedcf7d8901a9544b50d8322ea9e09e555c9549c8ccc97b44a806ca	2026-06-06 05:43:49.962	f	\N	2026-05-30 05:43:49.963252	\N	\N
5252e360-dcd7-43c1-8c68-41bef0328748	11111111-1111-1111-1111-111111111111	5457c068c426b6ae584c74a6ba979cfd74e6d33fe9cbd984f8a7d51cbafbab68	2026-06-06 05:54:44.896	f	\N	2026-05-30 05:54:44.896958	\N	\N
d2fc49da-4148-4bb5-97a8-32f87481fb81	11111111-1111-1111-1111-111111111111	08412c175c1fd1649cb6459bc88bedecf2474631d90b679de994120a1da190c5	2026-06-06 06:00:23.274	f	\N	2026-05-30 06:00:23.274796	\N	\N
5e84ee6a-38b5-4818-ac80-bb70a06b917a	11111111-1111-1111-1111-111111111111	3c3e34560f7b4e547d4fdb4cfb8f4f1ff7d19874122f5df160900493565cc075	2026-06-06 07:12:19.284	f	\N	2026-05-30 07:12:19.285577	\N	\N
688462c9-f44a-4544-9ceb-d32cb77c90de	11111111-1111-1111-1111-111111111111	e882085cd64340785d49d0253dd27b92defcf45184e34937ff105cb751dd1831	2026-06-06 07:56:23.188	f	\N	2026-05-30 07:56:23.190231	\N	\N
ac51a136-ceb2-4362-9fa3-58f7cb2871ab	11111111-1111-1111-1111-111111111111	e1fc894a41c15405f1d98731cb984b543448d715a7fc73660b8cf9be254f82b5	2026-06-06 09:30:10.584	f	\N	2026-05-30 09:30:10.586257	\N	\N
935ec913-feed-4909-a5ca-46f7a3149ed7	11111111-1111-1111-1111-111111111111	c056c670f627ef315c30ef79411717456a82857c204aebdefc0ad85e46ac8113	2026-06-06 09:33:10.503	f	\N	2026-05-30 09:33:10.504522	\N	\N
37769bd3-0904-447a-a17a-c65a2a0296c0	11111111-1111-1111-1111-111111111111	2b9dc1828a3bc10caeb2c4079026b01a98b0b48e0eb1cbe39cf27e094c07d147	2026-06-06 09:37:26.406	f	\N	2026-05-30 09:37:26.406979	\N	\N
55e84f86-59ea-49c5-bae8-6512c851004e	11111111-1111-1111-1111-111111111111	ce96a6113ba9979d699aa3b413533d955a19f487772b8c79a8a0b6da7441c3b9	2026-06-06 09:38:50.421	f	\N	2026-05-30 09:38:50.421979	\N	\N
64d006f2-92c1-43c9-b6db-8802c227e258	11111111-1111-1111-1111-111111111111	5eb2327fa4a2b7283c97a2329bbc66e387d507d87c6cfed7e0a263ae0b28cb06	2026-06-06 09:43:55.141	f	\N	2026-05-30 09:43:55.143826	\N	\N
bc0c6e91-1aea-4246-a75a-aac9a948ee01	11111111-1111-1111-1111-111111111111	24ffcd26dbc77ebf7a0a76858306ca0aa0953aa488d8f04ca55b769724c91b2c	2026-06-06 09:45:17.291	f	\N	2026-05-30 09:45:17.291834	\N	\N
255cb61f-3a93-4e62-b915-a93e67ca8612	11111111-1111-1111-1111-111111111111	41ebb658294f52bf73d21cfd227034af64016dae1234d043380001d780aa7131	2026-06-06 09:51:49.26	f	\N	2026-05-30 09:51:49.261348	\N	\N
0d0efd89-5e7c-475c-951a-d8a2ba1fb0b9	11111111-1111-1111-1111-111111111111	b454991bf026ecccd93ddbecc0a6a723af1ca8e151e640e8ad1a111eee10a59b	2026-06-06 09:52:58.944	f	\N	2026-05-30 09:52:58.946265	\N	\N
d4a5c202-041d-476d-816c-e2fc917e8221	11111111-1111-1111-1111-111111111111	cca4280a2271fc112131bca826eba903da160e6433563d0aed1d4e2bcdafd8e3	2026-06-06 09:56:14.514	f	\N	2026-05-30 09:56:14.515498	\N	\N
0e367ce3-e6bb-41f6-b0b4-04e7a0cea504	11111111-1111-1111-1111-111111111111	35b55185331647b381d73c10c49529d1bfde72a738e96343e7ec5d0763aab0f6	2026-06-06 09:56:35.594	f	\N	2026-05-30 09:56:35.595081	\N	\N
8da8ba59-8dba-4bf5-99d6-f91bac18862b	11111111-1111-1111-1111-111111111111	cf8d689796c9d6c5bb1bd13fc4334eed1ce90c9da21336d658e8749adbb3939c	2026-06-06 10:03:09.648	f	\N	2026-05-30 10:03:09.649089	\N	\N
d18bd90a-3364-45c5-8e7a-95041207ad2b	11111111-1111-1111-1111-111111111111	910fdfb9f19e918e881f2f4e2c4169ea3ac26c6863ea03dcc3f1260d39b9a7d4	2026-06-06 10:05:19.948	f	\N	2026-05-30 10:05:19.949483	\N	\N
df087289-f68e-48a6-a8ab-5cf604d806f9	11111111-1111-1111-1111-111111111111	0cfed5e248f2cee2987284c905b1703030a182677ce8bfab087383ee003ef6b1	2026-06-06 10:11:04.269	f	\N	2026-05-30 10:11:04.269892	\N	\N
d9565101-f41e-46a1-8a43-5611c510fde3	11111111-1111-1111-1111-111111111111	7560f82e7eff906a1614a07dfcf38f7834bdddfa45181fb3f4f8f256f02fc786	2026-06-06 10:16:46.601	f	\N	2026-05-30 10:16:46.602092	\N	\N
200eee9e-adec-45b6-8267-8285b84c2444	11111111-1111-1111-1111-111111111111	9e5500b5fe51120d96543fff416c116a4c33a7a423d792bb159e9060ffad829e	2026-06-06 10:22:11.798	f	\N	2026-05-30 10:22:11.800521	\N	\N
262a1aa8-818d-41c6-b567-f5bd4d0723a4	11111111-1111-1111-1111-111111111111	b37f4b594ed5728834f43fafe3933a323fd6d46c8a01c33dbdf2e61788b60bcf	2026-06-06 10:35:39.935	f	\N	2026-05-30 10:35:39.936389	\N	\N
ea685763-d81c-4b26-b6d6-1b750d99053c	11111111-1111-1111-1111-111111111111	1fd6e3a25a38c6dd8d1c842d898bb0147784416db017638ca07af28e1938cf75	2026-06-06 10:43:54.049	f	\N	2026-05-30 10:43:54.050566	\N	\N
7b63818a-8b9f-477a-8e8d-b4683d77d68b	11111111-1111-1111-1111-111111111111	4d036396349efee89ed2b5c30503550065407c07ce50a7c7965c760c081d5a58	2026-06-06 10:45:55.862	f	\N	2026-05-30 10:45:55.863005	\N	\N
745f48f8-7218-4c60-86a2-6b4a0457795f	11111111-1111-1111-1111-111111111111	1e5d78450c3c7f2f5e5964314f3e6baab9a1bb9ad2caf2c99178eb0c7c884ebc	2026-06-06 13:38:42.511	f	\N	2026-05-30 13:38:42.512869	\N	\N
b580874a-b3d9-481f-bcb6-4a35b134bfdc	11111111-1111-1111-1111-111111111111	7ee7643a80b0f1ef41fe7eb202ee8fc46df6cce1ce9bf73f7ab8eb7ef651ac4e	2026-06-06 13:44:16.333	f	\N	2026-05-30 13:44:16.334128	\N	\N
11c683e8-a889-4a06-b0cb-8ba4b5e5725f	11111111-1111-1111-1111-111111111111	ccaad3fc10e103b5da7937a348c0d758110c5f1bde101388da9ce0c4e642e8e5	2026-06-06 14:23:16.128	f	\N	2026-05-30 14:23:16.130211	\N	\N
acb003d8-0112-41a1-93d5-3ebb3f497193	11111111-1111-1111-1111-111111111111	6e5b6e6e83e6d3d4c508021990f1a9a29a98818722ef2d9e59b56b2553127ddb	2026-06-07 04:09:31.797	f	\N	2026-05-31 04:09:31.798844	\N	\N
183a0a27-75ff-4dea-8d4e-e6d52e0bb8ca	11111111-1111-1111-1111-111111111111	cd566cefd035ab5e5a5d026aa0787bca4d7ee2b8e4740b7bb165835a9ea0f54f	2026-06-07 04:15:34.085	f	\N	2026-05-31 04:15:34.085791	\N	\N
4494abba-c029-4ed6-830b-fd32b11dff6e	11111111-1111-1111-1111-111111111111	c0b9a360ff3077a180f719a5cfefd343dc2c4ef098bbbb66d67cb4b2c9a46cac	2026-06-07 04:22:42.041	f	\N	2026-05-31 04:22:42.041954	\N	\N
87b9887f-2824-4b92-98f3-1140235d82f4	11111111-1111-1111-1111-111111111111	a2795b39337d882dbbd47cfe2cbc18724b6f94c1b9a4a57ebf0040b422c6b21e	2026-06-07 04:24:12.158	f	\N	2026-05-31 04:24:12.159092	\N	\N
110d4642-ba85-485e-86cc-c6eea07d40ad	11111111-1111-1111-1111-111111111111	4a3eeb0622b21639e966290f151e973af63bd8dfc5b3e55c49cf15f203b152ff	2026-06-07 04:27:59.28	f	\N	2026-05-31 04:27:59.281902	\N	\N
0421d93f-a828-4b2b-b0a9-2a60f3b9a85f	11111111-1111-1111-1111-111111111111	ecd7cd6b90ccee6eb543380ca5fe053c1f1cc4d4ce4aa41bf8be612a9cca7c3e	2026-06-07 04:32:41.35	f	\N	2026-05-31 04:32:41.351157	\N	\N
618c7132-f492-4a7c-aba6-a0364216827f	11111111-1111-1111-1111-111111111111	1d610b84306e519b8751f27c5629c9ace2e7b6588a195623530d082d9008a726	2026-06-07 04:35:19.22	f	\N	2026-05-31 04:35:19.221521	\N	\N
379555eb-f6e3-4c1e-93df-5eba2c5ebbd8	11111111-1111-1111-1111-111111111111	999ce923ee0aab5e3f1e6641339af91ece528f445febf84dd6fa1407b75704df	2026-06-07 04:35:30.927	f	\N	2026-05-31 04:35:30.928306	\N	\N
3403e768-cd41-4531-9ee7-6a47ba07690c	11111111-1111-1111-1111-111111111111	263f8101aeafb1ca52cdc4f4c8f3d1b5f13eabcf7586840b392e8b7456d03525	2026-06-07 04:39:19.759	f	\N	2026-05-31 04:39:19.759871	\N	\N
61d0a629-58af-408a-9419-fbc6e39caada	11111111-1111-1111-1111-111111111111	5c4e44a40ba61bec8a1880e50fc892f431904bf2d5510bfa829935e4b02d904c	2026-06-07 04:45:08.825	f	\N	2026-05-31 04:45:08.827972	\N	\N
91e46536-f9b6-4ca1-bf1d-d774fe903000	11111111-1111-1111-1111-111111111111	5d4b624be60719b07cb395267a20c591fc45796cc4ce5eb63f6c2837276345d8	2026-06-07 04:49:57.886	f	\N	2026-05-31 04:49:57.887763	\N	\N
14960589-4493-46ca-bb0a-2c12c2f909b0	11111111-1111-1111-1111-111111111111	0a5266ca9414a300e7d0473a61c9b6ccbd022b562a57ac4415b54c2d24713ede	2026-06-07 05:01:01.697	f	\N	2026-05-31 05:01:01.698577	\N	\N
c87c08c7-1de2-4f27-a506-e1ada85d03a1	11111111-1111-1111-1111-111111111111	22c6302b3a04dd23823cc498afbc4b5315e0a016acbaa8f93896b726155e9dd7	2026-06-07 05:07:14.436	f	\N	2026-05-31 05:07:14.43692	\N	\N
85c32af4-2244-4ba6-9616-fb465b1ab7b1	11111111-1111-1111-1111-111111111111	787fde0ff879acc8fa6fa346409b1e86562a2fb3a537f9dad2a1b684ff9269a6	2026-06-07 05:20:30.523	f	\N	2026-05-31 05:20:30.523947	\N	\N
6de29f19-7144-4ffa-a231-0cb7f8b1f692	11111111-1111-1111-1111-111111111111	27c0570d6c016c9b60a55cdd8bcc5ed3bf70d5b2c66c9db857856a7a9cedc2f1	2026-06-07 05:23:42.052	f	\N	2026-05-31 05:23:42.053372	\N	\N
58e430da-41d7-4a53-8105-91c331b0fed4	11111111-1111-1111-1111-111111111111	248c6f8dccbb5fac77dab4fa851a5659ac900747f367a684c52f99ee7529c092	2026-06-07 05:26:30.261	f	\N	2026-05-31 05:26:30.262352	\N	\N
0d0ba22c-fdde-4293-aabd-69dabee5e079	11111111-1111-1111-1111-111111111111	21c04cbb6edef2097995d965cc87a9d211e4641808395c46ea744a197c3cc3ac	2026-06-07 06:09:23.992	f	\N	2026-05-31 06:09:23.993419	\N	\N
6357d4a5-6489-4900-8ad1-3f25f65f3b3c	11111111-1111-1111-1111-111111111111	bb9bfcfc9c0ab61243d2bbdb6512360708401fc9f6e0aa281031b098864ce0e9	2026-06-07 06:28:47.578	f	\N	2026-05-31 06:28:47.57943	\N	\N
7aba4a2f-c084-4692-9d14-6bcd8a96d11d	11111111-1111-1111-1111-111111111111	2ea3926c91c074fa65e31266bb2258d6a9205bb66aede8d44d1a3d43effa1927	2026-06-07 12:03:03.589	f	\N	2026-05-31 12:03:03.590277	\N	\N
\.


--
-- Data for Name: reserved_stock; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.reserved_stock (id, company_id, batch_id, order_id, order_type, order_number, qty_reserved, created_at) FROM stdin;
\.


--
-- Data for Name: return_note_items; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.return_note_items (id, return_id, product_id, batch_id, qty_returned, mrp, purchase_rate, return_reason, return_value, notes, created_at) FROM stdin;
\.


--
-- Data for Name: return_notes; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.return_notes (id, company_id, return_number, note_type, party_id, reference_invoice, reference_invoice_date, return_date, approval_date, received_date, total_qty, total_value, status, reason, rejection_reason, credit_note_id, debit_note_id, created_by, approved_by, received_by, created_at, approved_at, received_at) FROM stdin;
\.


--
-- Data for Name: rnd_experiments; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.rnd_experiments (id, formulation_id, test_name, start_date, end_date, assigned_to, status, result_data, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: rnd_formulations; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.rnd_formulations (id, product_name, dosage_form, version, stage, start_date, ingredients, target_cost, created_by, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: sales_invoice_items; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.sales_invoice_items (id, invoice_id, product_id, batch_id, quantity, free_quantity, mrp, rate, discount_percent, discount_amount, taxable_value, gst_percent, cgst_amount, sgst_amount, igst_amount, total_amount, sales_invoice_id, selling_rate) FROM stdin;
0f875795-ec04-4050-ac8f-d7ba3508ad8f	66666666-6666-6666-6666-666666666661	33333333-3333-3333-3333-333333333331	44444444-4444-4444-4444-444444444441	1	0	30.00	25.00	0.00	0.00	22.32	12.00	1.34	1.34	0.00	25.00	\N	\N
f0e8e08a-8967-4c7f-bbe9-6e4b2b27262a	66666666-6666-6666-6666-666666666661	33333333-3333-3333-3333-333333333332	44444444-4444-4444-4444-444444444442	1	0	200.00	180.00	0.00	0.00	160.71	12.00	9.64	9.64	0.00	180.00	\N	\N
826365d8-3b33-4c48-8989-57aa1fb56c33	66666666-6666-6666-6666-666666666662	33333333-3333-3333-3333-333333333334	44444444-4444-4444-4444-444444444444	10	0	150.00	130.00	0.00	0.00	1160.71	12.00	69.64	69.64	0.00	1300.00	\N	\N
2834e480-5229-483f-8241-cfdca36e90f1	66666666-6666-6666-6666-666666666662	33333333-3333-3333-3333-333333333332	44444444-4444-4444-4444-444444444442	10	0	200.00	180.00	0.00	0.00	1607.14	12.00	96.43	96.43	0.00	1800.00	\N	\N
\.


--
-- Data for Name: sales_invoices; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.sales_invoices (id, company_id, party_id, invoice_number, date, "time", customer_name, customer_mobile, doctor_name, payment_mode, sub_total, taxable_value, total_gst, total_discount, round_off, net_amount, status, created_by, created_at, updated_at, updated_by, invoice_no, invoice_date, net_payable, voucher_id) FROM stdin;
66666666-6666-6666-6666-666666666661	1	\N	INV-2026-0001	2026-05-20	17:51:18.474002	Walk-in Customer	9123456780	Dr. Ramesh	Cash	205.00	183.04	21.96	0.00	0.04	205.00	Completed	11111111-1111-1111-1111-111111111111	2026-05-22 17:51:18.474002	2026-05-22 17:51:18.474002	\N	\N	\N	\N	7897cb2c-8c6d-4f8d-9b20-2f76db2f0d38
66666666-6666-6666-6666-666666666662	1	\N	INV-2026-0002	2026-05-21	17:51:18.474002	City Hospital Pharmacy	9898989898	\N	Credit	3100.00	2767.86	332.14	0.00	0.14	3100.00	Completed	22222222-2222-2222-2222-222222222222	2026-05-22 17:51:18.474002	2026-05-22 17:51:18.474002	\N	\N	\N	\N	16166f7f-d7f0-459f-97b5-05b8a4e15088
\.


--
-- Data for Name: stock_ledger_detailed; Type: TABLE DATA; Schema: public; Owner: erp_user
--

COPY public.stock_ledger_detailed (id, company_id, product_id, batch_id, godown_id, transaction_id, transaction_type, reference_doc_id, reference_doc_type, quantity_in, quantity_out, unit_cost, valuation_method, value_in, value_out, cumulative_qty, cumulative_value, batch_expiry_date, cost_per_unit_at_time, created_by, approved_by, approval_date, remarks, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: stock_ledger_entries; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.stock_ledger_entries (id, company_id, godown_id, product_id, batch_id, movement_type, reference_type, reference_id, reference_number, in_qty, out_qty, running_balance, cost_per_unit, total_cost, movement_date, narration, created_by, created_at) FROM stdin;
\.


--
-- Data for Name: stock_movement_reasons; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.stock_movement_reasons (id, reason_code, reason_name, movement_category, description, status, created_at) FROM stdin;
b31e40d9-0e95-4218-b2d7-22b075c0776e	PURCHASE	Purchase Receipt	In	Stock received from supplier	Active	2026-05-22 17:51:17.533705
5830cb01-0b4a-4531-91f9-aafb036b0f7f	SALES	Sales/Dispatch	Out	Stock sold to customer	Active	2026-05-22 17:51:17.533705
26994ea8-db4e-4c49-bbfc-53a5a658d632	RETURN_SUPPLIER	Return to Supplier	Out	Stock returned to supplier	Active	2026-05-22 17:51:17.533705
4c99db10-9d4c-494f-a8a4-2c1f58bedfe5	RETURN_CUSTOMER	Customer Return	In	Stock returned by customer	Active	2026-05-22 17:51:17.533705
228cab91-ca9f-4725-ac88-cec448709e56	PRODUCTION	Production Output	In	Finished goods from production	Active	2026-05-22 17:51:17.533705
a1fda04f-513e-4c6c-8784-ba1602f63622	RAW_MATERIAL	Raw Material Consumption	Out	Raw material used in production	Active	2026-05-22 17:51:17.533705
c0f924af-aa86-4f10-b3b4-8cd9883b6eb1	DAMAGE	Damage/Loss	Out	Stock damaged or lost	Active	2026-05-22 17:51:17.533705
f69096fd-6c6c-4f51-9a33-a77b6a4b1f67	EXPIRY	Expiry Adjustment	Out	Expired stock adjustment	Active	2026-05-22 17:51:17.533705
c46d873d-8652-46cf-9e52-97ec53cbe3a1	SCRAP	Scrap/Waste	Out	Stock written off as scrap	Active	2026-05-22 17:51:17.533705
05c8c206-6b81-4b32-8c08-ecc27c9796a7	TRANSFER	Inter-Godown Transfer	Internal	Transfer between locations	Active	2026-05-22 17:51:17.533705
62052f88-2bbc-4870-a7bc-72ef7769b562	SAMPLE	Free Sample	Out	Free samples distributed	Active	2026-05-22 17:51:17.533705
ef48bac9-3f1b-48b0-8022-317fab249ded	THEFT	Theft/Pilferage	Out	Stock lost due to theft	Active	2026-05-22 17:51:17.533705
a39b3a02-bb02-46b2-b252-39c7f6ff62b2	COUNTING_ERROR	Counting Adjustment	Internal	Correction of counting errors	Active	2026-05-22 17:51:17.533705
c9d193c3-3231-47e8-bbe9-ad812da747ed	OPENING	Opening Stock	In	Initial/Opening stock entry	Active	2026-05-22 17:51:17.533705
e08c53c6-cc0c-4fca-b5f1-dcc1da4764e3	CLOSING	Closing Stock	Out	Period closing adjustment	Active	2026-05-22 17:51:17.533705
\.


--
-- Data for Name: stock_reconciliation; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.stock_reconciliation (id, company_id, godown_id, reconciliation_number, reconciliation_date, reconciliation_period_from, reconciliation_period_to, status, total_system_qty, total_physical_qty, total_variance_qty, total_variance_value, created_by, verified_by, approved_by, rejection_reason, created_at, verified_at, approved_at) FROM stdin;
\.


--
-- Data for Name: stock_reconciliation_items; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.stock_reconciliation_items (id, reconciliation_id, product_id, batch_id, system_qty, physical_qty, variance_qty, variance_reason, variance_value, notes, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: supplier_invoices; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.supplier_invoices (id, supplier_id, invoice_number, invoice_date, due_date, total_amount, tax_amount, status, created_at) FROM stdin;
\.


--
-- Data for Name: suppliers; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.suppliers (id, name, gstin) FROM stdin;
\.


--
-- Data for Name: tax_configurations; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.tax_configurations (id, tax_type, tax_name, rate, account_id, is_active, created_at) FROM stdin;
\.


--
-- Data for Name: tds_entries; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.tds_entries (id, company_id, invoice_id, tds_section, tds_rate, tds_amount, payment_date, created_by, created_at) FROM stdin;
\.


--
-- Data for Name: temperature_logs; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.temperature_logs (id, log_date, log_time, temperature, checked_by, equipment_name, status, remarks, created_at, created_by) FROM stdin;
\.


--
-- Data for Name: three_way_matches; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.three_way_matches (id, purchase_order_id, grn_id, invoice_id, match_status, variance_amount, remarks, verified_by, verified_at, created_at) FROM stdin;
\.


--
-- Data for Name: users; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.users (id, username, password_hash, name, role, created_at, email, two_factor_enabled, totp_secret, phone, last_login, last_login_ip, login_attempts, locked_until, otp_code, otp_expires_at, last_device_fingerprint, risk_score, created_by, updated_at) FROM stdin;
22222222-2222-2222-2222-222222222222	pharmacist1	$2a$10$vI8aWBnW3fID.ZQ4/zo1G.q1lRps.9cGLcZEiGDMVr5yUP1KUOYTa	John Doe	PHARMACIST	2026-05-22 17:51:18.469239	\N	f	\N	\N	\N	\N	0	\N	\N	\N	\N	0.00	\N	2026-05-22 17:51:18.469239
22222222-2222-2222-2222-222222222223	accountant	$2a$10$vI8aWBnW3fID.ZQ4/zo1G.q1lRps.9cGLcZEiGDMVr5yUP1KUOYTa	Jane Smith	ACCOUNTANT	2026-05-22 17:51:18.469239	\N	f	\N	\N	\N	\N	0	\N	\N	\N	\N	0.00	\N	2026-05-22 17:51:18.469239
11111111-1111-1111-1111-111111111111	admin	$2a$10$skNeZEDxC5y9TKw7K3anqeolGkofrZ7be7nV7D2UftrZFNiv7ZrDS	System Admin	ADMIN	2026-05-22 17:51:18.469239	metapharsic@gmail.com	f	\N	\N	2026-05-31 12:03:03.588802	::ffff:127.0.0.1	0	\N	\N	\N	fp_936774945	0.00	\N	2026-05-31 12:03:03.588802
\.


--
-- Data for Name: valuation_configurations; Type: TABLE DATA; Schema: public; Owner: erp_user
--

COPY public.valuation_configurations (id, company_id, default_method, method_by_product_category, round_to_nearest, rounding_method, closing_method, valuation_period, include_gst_in_valuation, enforce_batch_expiry, track_landed_cost, allow_negative_stock, require_approval_on_adjustment, require_approval_on_return, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: valuation_methods; Type: TABLE DATA; Schema: public; Owner: erp_user
--

COPY public.valuation_methods (id, code, name, description, enabled, is_default, created_at) FROM stdin;
1	FIFO	First In First Out	Oldest batches used first	t	f	2026-05-29 12:17:35.926217
2	LIFO	Last In First Out	Newest batches used first	t	f	2026-05-29 12:17:35.926217
3	WAC	Weighted Average Cost	Average cost across batches	t	t	2026-05-29 12:17:35.926217
\.


--
-- Data for Name: vendor_ratings; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.vendor_ratings (id, supplier_id, quality_score, delivery_score, price_score, service_score, overall_rating, on_time_delivery_rate, total_transactions, last_evaluated_at) FROM stdin;
\.


--
-- Data for Name: voucher_types; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.voucher_types (id, name, alias, type_of_voucher, abbreviation, method_of_voucher_numbering, use_effective_dates, make_optional_by_default, allow_narration, provide_narrations_for_each_ledger, print_after_saving, name_of_class, is_active, created_at, updated_at) FROM stdin;
65e93a89-581b-431e-bc3f-da215e79e320	Sales	\N	Sale	Sale	Automatic	f	f	t	f	f	\N	t	2026-05-22 17:51:18.396525	2026-05-22 17:51:18.396525
5174c5dd-22f4-4929-b4dd-7649bda43f22	Purchase	\N	Purchase	Purc	Automatic	f	f	t	f	f	\N	t	2026-05-22 17:51:18.39781	2026-05-22 17:51:18.39781
1409682f-a60e-490b-a5a0-0c15394d7144	Point of Sales	\N	Sale	POS	Automatic	f	f	t	f	t	\N	t	2026-05-22 17:51:18.398313	2026-05-22 17:51:18.398313
\.


--
-- Name: batch_valuation_history_id_seq; Type: SEQUENCE SET; Schema: public; Owner: erp_user
--

SELECT pg_catalog.setval('public.batch_valuation_history_id_seq', 1, false);


--
-- Name: compliance_notification_log_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.compliance_notification_log_id_seq', 1, false);


--
-- Name: compliance_notification_settings_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.compliance_notification_settings_id_seq', 1, true);


--
-- Name: crm_audit_log_id_seq; Type: SEQUENCE SET; Schema: public; Owner: erp_user
--

SELECT pg_catalog.setval('public.crm_audit_log_id_seq', 1, false);


--
-- Name: dms_audit_trail_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.dms_audit_trail_id_seq', 1, false);


--
-- Name: dms_versions_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.dms_versions_id_seq', 1, false);


--
-- Name: dms_workflows_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.dms_workflows_id_seq', 1, false);


--
-- Name: reconciliation_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.reconciliation_seq', 1, false);


--
-- Name: stock_ledger_detailed_id_seq; Type: SEQUENCE SET; Schema: public; Owner: erp_user
--

SELECT pg_catalog.setval('public.stock_ledger_detailed_id_seq', 1, false);


--
-- Name: valuation_methods_id_seq; Type: SEQUENCE SET; Schema: public; Owner: erp_user
--

SELECT pg_catalog.setval('public.valuation_methods_id_seq', 6, true);


--
-- Name: stg_chart_of_accounts stg_chart_of_accounts_pkey; Type: CONSTRAINT; Schema: accounts_staging; Owner: postgres
--

ALTER TABLE ONLY accounts_staging.stg_chart_of_accounts
    ADD CONSTRAINT stg_chart_of_accounts_pkey PRIMARY KEY (staging_id);


--
-- Name: stg_parties stg_parties_pkey; Type: CONSTRAINT; Schema: accounts_staging; Owner: postgres
--

ALTER TABLE ONLY accounts_staging.stg_parties
    ADD CONSTRAINT stg_parties_pkey PRIMARY KEY (staging_id);


--
-- Name: stg_voucher_entries stg_voucher_entries_pkey; Type: CONSTRAINT; Schema: accounts_staging; Owner: postgres
--

ALTER TABLE ONLY accounts_staging.stg_voucher_entries
    ADD CONSTRAINT stg_voucher_entries_pkey PRIMARY KEY (staging_id);


--
-- Name: stg_vouchers stg_vouchers_pkey; Type: CONSTRAINT; Schema: accounts_staging; Owner: postgres
--

ALTER TABLE ONLY accounts_staging.stg_vouchers
    ADD CONSTRAINT stg_vouchers_pkey PRIMARY KEY (staging_id);


--
-- Name: abc_analysis abc_analysis_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.abc_analysis
    ADD CONSTRAINT abc_analysis_pkey PRIMARY KEY (id);


--
-- Name: abc_classification abc_classification_abc_analysis_id_product_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.abc_classification
    ADD CONSTRAINT abc_classification_abc_analysis_id_product_id_key UNIQUE (abc_analysis_id, product_id);


--
-- Name: abc_classification abc_classification_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.abc_classification
    ADD CONSTRAINT abc_classification_pkey PRIMARY KEY (id);


--
-- Name: acc_anomalies acc_anomalies_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.acc_anomalies
    ADD CONSTRAINT acc_anomalies_pkey PRIMARY KEY (id);


--
-- Name: acc_bank_statement_lines acc_bank_statement_lines_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.acc_bank_statement_lines
    ADD CONSTRAINT acc_bank_statement_lines_pkey PRIMARY KEY (id);


--
-- Name: acc_bank_statements acc_bank_statements_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.acc_bank_statements
    ADD CONSTRAINT acc_bank_statements_pkey PRIMARY KEY (id);


--
-- Name: acc_cash_flow_forecast acc_cash_flow_forecast_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.acc_cash_flow_forecast
    ADD CONSTRAINT acc_cash_flow_forecast_pkey PRIMARY KEY (id);


--
-- Name: acc_close_checklist acc_close_checklist_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.acc_close_checklist
    ADD CONSTRAINT acc_close_checklist_pkey PRIMARY KEY (id);


--
-- Name: acc_dunning_log acc_dunning_log_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.acc_dunning_log
    ADD CONSTRAINT acc_dunning_log_pkey PRIMARY KEY (id);


--
-- Name: acc_dunning_rules acc_dunning_rules_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.acc_dunning_rules
    ADD CONSTRAINT acc_dunning_rules_pkey PRIMARY KEY (id);


--
-- Name: acc_fx_revaluation_log acc_fx_revaluation_log_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.acc_fx_revaluation_log
    ADD CONSTRAINT acc_fx_revaluation_log_pkey PRIMARY KEY (id);


--
-- Name: acc_payment_run_items acc_payment_run_items_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.acc_payment_run_items
    ADD CONSTRAINT acc_payment_run_items_pkey PRIMARY KEY (id);


--
-- Name: acc_payment_runs acc_payment_runs_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.acc_payment_runs
    ADD CONSTRAINT acc_payment_runs_pkey PRIMARY KEY (id);


--
-- Name: acc_periods acc_periods_financial_year_id_period_number_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.acc_periods
    ADD CONSTRAINT acc_periods_financial_year_id_period_number_key UNIQUE (financial_year_id, period_number);


--
-- Name: acc_periods acc_periods_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.acc_periods
    ADD CONSTRAINT acc_periods_pkey PRIMARY KEY (id);


--
-- Name: acc_ratios_cache acc_ratios_cache_as_of_date_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.acc_ratios_cache
    ADD CONSTRAINT acc_ratios_cache_as_of_date_key UNIQUE (as_of_date);


--
-- Name: acc_ratios_cache acc_ratios_cache_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.acc_ratios_cache
    ADD CONSTRAINT acc_ratios_cache_pkey PRIMARY KEY (id);


--
-- Name: acc_tally_sync_log acc_tally_sync_log_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.acc_tally_sync_log
    ADD CONSTRAINT acc_tally_sync_log_pkey PRIMARY KEY (id);


--
-- Name: api_keys api_keys_key_hash_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.api_keys
    ADD CONSTRAINT api_keys_key_hash_key UNIQUE (key_hash);


--
-- Name: api_keys api_keys_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.api_keys
    ADD CONSTRAINT api_keys_pkey PRIMARY KEY (id);


--
-- Name: approval_workflows approval_workflows_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.approval_workflows
    ADD CONSTRAINT approval_workflows_pkey PRIMARY KEY (id);


--
-- Name: asset_alerts asset_alerts_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.asset_alerts
    ADD CONSTRAINT asset_alerts_pkey PRIMARY KEY (id);


--
-- Name: asset_categories asset_categories_name_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.asset_categories
    ADD CONSTRAINT asset_categories_name_key UNIQUE (name);


--
-- Name: asset_categories asset_categories_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.asset_categories
    ADD CONSTRAINT asset_categories_pkey PRIMARY KEY (id);


--
-- Name: asset_insurance_policies asset_insurance_policies_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.asset_insurance_policies
    ADD CONSTRAINT asset_insurance_policies_pkey PRIMARY KEY (id);


--
-- Name: asset_maintenance_logs asset_maintenance_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.asset_maintenance_logs
    ADD CONSTRAINT asset_maintenance_logs_pkey PRIMARY KEY (id);


--
-- Name: asset_transfers asset_transfers_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.asset_transfers
    ADD CONSTRAINT asset_transfers_pkey PRIMARY KEY (id);


--
-- Name: audit_log_accounting audit_log_accounting_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.audit_log_accounting
    ADD CONSTRAINT audit_log_accounting_pkey PRIMARY KEY (id);


--
-- Name: audit_logs audit_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.audit_logs
    ADD CONSTRAINT audit_logs_pkey PRIMARY KEY (id);


--
-- Name: bank_reconciliation bank_reconciliation_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.bank_reconciliation
    ADD CONSTRAINT bank_reconciliation_pkey PRIMARY KEY (id);


--
-- Name: bank_reconciliations bank_reconciliations_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.bank_reconciliations
    ADD CONSTRAINT bank_reconciliations_pkey PRIMARY KEY (id);


--
-- Name: batch_valuation_history batch_valuation_history_batch_id_valuation_date_valuation_m_key; Type: CONSTRAINT; Schema: public; Owner: erp_user
--

ALTER TABLE ONLY public.batch_valuation_history
    ADD CONSTRAINT batch_valuation_history_batch_id_valuation_date_valuation_m_key UNIQUE (batch_id, valuation_date, valuation_method);


--
-- Name: batch_valuation_history batch_valuation_history_pkey; Type: CONSTRAINT; Schema: public; Owner: erp_user
--

ALTER TABLE ONLY public.batch_valuation_history
    ADD CONSTRAINT batch_valuation_history_pkey PRIMARY KEY (id);


--
-- Name: batches batches_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.batches
    ADD CONSTRAINT batches_pkey PRIMARY KEY (id);


--
-- Name: batches batches_product_id_batch_number_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.batches
    ADD CONSTRAINT batches_product_id_batch_number_key UNIQUE (product_id, batch_number);


--
-- Name: boms boms_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.boms
    ADD CONSTRAINT boms_pkey PRIMARY KEY (id);


--
-- Name: branches branches_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.branches
    ADD CONSTRAINT branches_pkey PRIMARY KEY (id);


--
-- Name: budgets budgets_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.budgets
    ADD CONSTRAINT budgets_pkey PRIMARY KEY (id);


--
-- Name: chart_of_accounts chart_of_accounts_account_code_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.chart_of_accounts
    ADD CONSTRAINT chart_of_accounts_account_code_key UNIQUE (account_code);


--
-- Name: chart_of_accounts chart_of_accounts_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.chart_of_accounts
    ADD CONSTRAINT chart_of_accounts_pkey PRIMARY KEY (id);


--
-- Name: company_document_history company_document_history_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.company_document_history
    ADD CONSTRAINT company_document_history_pkey PRIMARY KEY (id);


--
-- Name: company_documents company_documents_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.company_documents
    ADD CONSTRAINT company_documents_pkey PRIMARY KEY (id);


--
-- Name: compliance_audits compliance_audits_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.compliance_audits
    ADD CONSTRAINT compliance_audits_pkey PRIMARY KEY (id);


--
-- Name: compliance_checklist_items compliance_checklist_items_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.compliance_checklist_items
    ADD CONSTRAINT compliance_checklist_items_pkey PRIMARY KEY (id);


--
-- Name: compliance_checklist_templates compliance_checklist_templates_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.compliance_checklist_templates
    ADD CONSTRAINT compliance_checklist_templates_pkey PRIMARY KEY (id);


--
-- Name: compliance_checklists compliance_checklists_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.compliance_checklists
    ADD CONSTRAINT compliance_checklists_pkey PRIMARY KEY (id);


--
-- Name: compliance_notification_log compliance_notification_log_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.compliance_notification_log
    ADD CONSTRAINT compliance_notification_log_pkey PRIMARY KEY (id);


--
-- Name: compliance_notification_settings compliance_notification_settings_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.compliance_notification_settings
    ADD CONSTRAINT compliance_notification_settings_pkey PRIMARY KEY (id);


--
-- Name: cost_centers cost_centers_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.cost_centers
    ADD CONSTRAINT cost_centers_pkey PRIMARY KEY (id);


--
-- Name: crm_accounts crm_accounts_pkey; Type: CONSTRAINT; Schema: public; Owner: erp_user
--

ALTER TABLE ONLY public.crm_accounts
    ADD CONSTRAINT crm_accounts_pkey PRIMARY KEY (id);


--
-- Name: crm_activities crm_activities_pkey; Type: CONSTRAINT; Schema: public; Owner: erp_user
--

ALTER TABLE ONLY public.crm_activities
    ADD CONSTRAINT crm_activities_pkey PRIMARY KEY (id);


--
-- Name: crm_audit_log crm_audit_log_pkey; Type: CONSTRAINT; Schema: public; Owner: erp_user
--

ALTER TABLE ONLY public.crm_audit_log
    ADD CONSTRAINT crm_audit_log_pkey PRIMARY KEY (id);


--
-- Name: crm_badges crm_badges_pkey; Type: CONSTRAINT; Schema: public; Owner: erp_user
--

ALTER TABLE ONLY public.crm_badges
    ADD CONSTRAINT crm_badges_pkey PRIMARY KEY (id);


--
-- Name: crm_badges crm_badges_user_id_badge_key_key; Type: CONSTRAINT; Schema: public; Owner: erp_user
--

ALTER TABLE ONLY public.crm_badges
    ADD CONSTRAINT crm_badges_user_id_badge_key_key UNIQUE (user_id, badge_key);


--
-- Name: crm_campaign_recipients crm_campaign_recipients_pkey; Type: CONSTRAINT; Schema: public; Owner: erp_user
--

ALTER TABLE ONLY public.crm_campaign_recipients
    ADD CONSTRAINT crm_campaign_recipients_pkey PRIMARY KEY (id);


--
-- Name: crm_campaigns crm_campaigns_pkey; Type: CONSTRAINT; Schema: public; Owner: erp_user
--

ALTER TABLE ONLY public.crm_campaigns
    ADD CONSTRAINT crm_campaigns_pkey PRIMARY KEY (id);


--
-- Name: crm_comments crm_comments_pkey; Type: CONSTRAINT; Schema: public; Owner: erp_user
--

ALTER TABLE ONLY public.crm_comments
    ADD CONSTRAINT crm_comments_pkey PRIMARY KEY (id);


--
-- Name: crm_consents crm_consents_contact_id_channel_purpose_key; Type: CONSTRAINT; Schema: public; Owner: erp_user
--

ALTER TABLE ONLY public.crm_consents
    ADD CONSTRAINT crm_consents_contact_id_channel_purpose_key UNIQUE (contact_id, channel, purpose);


--
-- Name: crm_consents crm_consents_pkey; Type: CONSTRAINT; Schema: public; Owner: erp_user
--

ALTER TABLE ONLY public.crm_consents
    ADD CONSTRAINT crm_consents_pkey PRIMARY KEY (id);


--
-- Name: crm_contacts crm_contacts_pkey; Type: CONSTRAINT; Schema: public; Owner: erp_user
--

ALTER TABLE ONLY public.crm_contacts
    ADD CONSTRAINT crm_contacts_pkey PRIMARY KEY (id);


--
-- Name: crm_copilot_threads crm_copilot_threads_pkey; Type: CONSTRAINT; Schema: public; Owner: erp_user
--

ALTER TABLE ONLY public.crm_copilot_threads
    ADD CONSTRAINT crm_copilot_threads_pkey PRIMARY KEY (id);


--
-- Name: crm_custom_fields crm_custom_fields_object_type_api_name_key; Type: CONSTRAINT; Schema: public; Owner: erp_user
--

ALTER TABLE ONLY public.crm_custom_fields
    ADD CONSTRAINT crm_custom_fields_object_type_api_name_key UNIQUE (object_type, api_name);


--
-- Name: crm_custom_fields crm_custom_fields_pkey; Type: CONSTRAINT; Schema: public; Owner: erp_user
--

ALTER TABLE ONLY public.crm_custom_fields
    ADD CONSTRAINT crm_custom_fields_pkey PRIMARY KEY (id);


--
-- Name: crm_custom_objects crm_custom_objects_api_name_key; Type: CONSTRAINT; Schema: public; Owner: erp_user
--

ALTER TABLE ONLY public.crm_custom_objects
    ADD CONSTRAINT crm_custom_objects_api_name_key UNIQUE (api_name);


--
-- Name: crm_custom_objects crm_custom_objects_pkey; Type: CONSTRAINT; Schema: public; Owner: erp_user
--

ALTER TABLE ONLY public.crm_custom_objects
    ADD CONSTRAINT crm_custom_objects_pkey PRIMARY KEY (id);


--
-- Name: crm_embeddings crm_embeddings_entity_type_entity_id_key; Type: CONSTRAINT; Schema: public; Owner: erp_user
--

ALTER TABLE ONLY public.crm_embeddings
    ADD CONSTRAINT crm_embeddings_entity_type_entity_id_key UNIQUE (entity_type, entity_id);


--
-- Name: crm_embeddings crm_embeddings_pkey; Type: CONSTRAINT; Schema: public; Owner: erp_user
--

ALTER TABLE ONLY public.crm_embeddings
    ADD CONSTRAINT crm_embeddings_pkey PRIMARY KEY (id);


--
-- Name: crm_forecasts crm_forecasts_pkey; Type: CONSTRAINT; Schema: public; Owner: erp_user
--

ALTER TABLE ONLY public.crm_forecasts
    ADD CONSTRAINT crm_forecasts_pkey PRIMARY KEY (id);


--
-- Name: crm_gamification_points crm_gamification_points_pkey; Type: CONSTRAINT; Schema: public; Owner: erp_user
--

ALTER TABLE ONLY public.crm_gamification_points
    ADD CONSTRAINT crm_gamification_points_pkey PRIMARY KEY (id);


--
-- Name: crm_hcps crm_hcps_pkey; Type: CONSTRAINT; Schema: public; Owner: erp_user
--

ALTER TABLE ONLY public.crm_hcps
    ADD CONSTRAINT crm_hcps_pkey PRIMARY KEY (id);


--
-- Name: crm_kb_articles crm_kb_articles_pkey; Type: CONSTRAINT; Schema: public; Owner: erp_user
--

ALTER TABLE ONLY public.crm_kb_articles
    ADD CONSTRAINT crm_kb_articles_pkey PRIMARY KEY (id);


--
-- Name: crm_layouts crm_layouts_object_type_role_key; Type: CONSTRAINT; Schema: public; Owner: erp_user
--

ALTER TABLE ONLY public.crm_layouts
    ADD CONSTRAINT crm_layouts_object_type_role_key UNIQUE (object_type, role);


--
-- Name: crm_layouts crm_layouts_pkey; Type: CONSTRAINT; Schema: public; Owner: erp_user
--

ALTER TABLE ONLY public.crm_layouts
    ADD CONSTRAINT crm_layouts_pkey PRIMARY KEY (id);


--
-- Name: crm_leads crm_leads_pkey; Type: CONSTRAINT; Schema: public; Owner: erp_user
--

ALTER TABLE ONLY public.crm_leads
    ADD CONSTRAINT crm_leads_pkey PRIMARY KEY (id);


--
-- Name: crm_mentions crm_mentions_pkey; Type: CONSTRAINT; Schema: public; Owner: erp_user
--

ALTER TABLE ONLY public.crm_mentions
    ADD CONSTRAINT crm_mentions_pkey PRIMARY KEY (id);


--
-- Name: crm_notes crm_notes_pkey; Type: CONSTRAINT; Schema: public; Owner: erp_user
--

ALTER TABLE ONLY public.crm_notes
    ADD CONSTRAINT crm_notes_pkey PRIMARY KEY (id);


--
-- Name: crm_oauth_tokens crm_oauth_tokens_pkey; Type: CONSTRAINT; Schema: public; Owner: erp_user
--

ALTER TABLE ONLY public.crm_oauth_tokens
    ADD CONSTRAINT crm_oauth_tokens_pkey PRIMARY KEY (id);


--
-- Name: crm_oauth_tokens crm_oauth_tokens_user_id_provider_key; Type: CONSTRAINT; Schema: public; Owner: erp_user
--

ALTER TABLE ONLY public.crm_oauth_tokens
    ADD CONSTRAINT crm_oauth_tokens_user_id_provider_key UNIQUE (user_id, provider);


--
-- Name: crm_opportunities crm_opportunities_pkey; Type: CONSTRAINT; Schema: public; Owner: erp_user
--

ALTER TABLE ONLY public.crm_opportunities
    ADD CONSTRAINT crm_opportunities_pkey PRIMARY KEY (id);


--
-- Name: crm_permissions crm_permissions_pkey; Type: CONSTRAINT; Schema: public; Owner: erp_user
--

ALTER TABLE ONLY public.crm_permissions
    ADD CONSTRAINT crm_permissions_pkey PRIMARY KEY (id);


--
-- Name: crm_pipeline_stages crm_pipeline_stages_pkey; Type: CONSTRAINT; Schema: public; Owner: erp_user
--

ALTER TABLE ONLY public.crm_pipeline_stages
    ADD CONSTRAINT crm_pipeline_stages_pkey PRIMARY KEY (id);


--
-- Name: crm_pipelines crm_pipelines_pkey; Type: CONSTRAINT; Schema: public; Owner: erp_user
--

ALTER TABLE ONLY public.crm_pipelines
    ADD CONSTRAINT crm_pipelines_pkey PRIMARY KEY (id);


--
-- Name: crm_playbooks crm_playbooks_pkey; Type: CONSTRAINT; Schema: public; Owner: erp_user
--

ALTER TABLE ONLY public.crm_playbooks
    ADD CONSTRAINT crm_playbooks_pkey PRIMARY KEY (id);


--
-- Name: crm_predictions crm_predictions_pkey; Type: CONSTRAINT; Schema: public; Owner: erp_user
--

ALTER TABLE ONLY public.crm_predictions
    ADD CONSTRAINT crm_predictions_pkey PRIMARY KEY (id);


--
-- Name: crm_push_subscriptions crm_push_subscriptions_endpoint_key; Type: CONSTRAINT; Schema: public; Owner: erp_user
--

ALTER TABLE ONLY public.crm_push_subscriptions
    ADD CONSTRAINT crm_push_subscriptions_endpoint_key UNIQUE (endpoint);


--
-- Name: crm_push_subscriptions crm_push_subscriptions_pkey; Type: CONSTRAINT; Schema: public; Owner: erp_user
--

ALTER TABLE ONLY public.crm_push_subscriptions
    ADD CONSTRAINT crm_push_subscriptions_pkey PRIMARY KEY (id);


--
-- Name: crm_quotas crm_quotas_pkey; Type: CONSTRAINT; Schema: public; Owner: erp_user
--

ALTER TABLE ONLY public.crm_quotas
    ADD CONSTRAINT crm_quotas_pkey PRIMARY KEY (id);


--
-- Name: crm_quote_lines crm_quote_lines_pkey; Type: CONSTRAINT; Schema: public; Owner: erp_user
--

ALTER TABLE ONLY public.crm_quote_lines
    ADD CONSTRAINT crm_quote_lines_pkey PRIMARY KEY (id);


--
-- Name: crm_quotes crm_quotes_pkey; Type: CONSTRAINT; Schema: public; Owner: erp_user
--

ALTER TABLE ONLY public.crm_quotes
    ADD CONSTRAINT crm_quotes_pkey PRIMARY KEY (id);


--
-- Name: crm_quotes crm_quotes_quote_number_key; Type: CONSTRAINT; Schema: public; Owner: erp_user
--

ALTER TABLE ONLY public.crm_quotes
    ADD CONSTRAINT crm_quotes_quote_number_key UNIQUE (quote_number);


--
-- Name: crm_samples crm_samples_pkey; Type: CONSTRAINT; Schema: public; Owner: erp_user
--

ALTER TABLE ONLY public.crm_samples
    ADD CONSTRAINT crm_samples_pkey PRIMARY KEY (id);


--
-- Name: crm_scores crm_scores_entity_type_entity_id_key; Type: CONSTRAINT; Schema: public; Owner: erp_user
--

ALTER TABLE ONLY public.crm_scores
    ADD CONSTRAINT crm_scores_entity_type_entity_id_key UNIQUE (entity_type, entity_id);


--
-- Name: crm_scores crm_scores_pkey; Type: CONSTRAINT; Schema: public; Owner: erp_user
--

ALTER TABLE ONLY public.crm_scores
    ADD CONSTRAINT crm_scores_pkey PRIMARY KEY (id);


--
-- Name: crm_segments crm_segments_pkey; Type: CONSTRAINT; Schema: public; Owner: erp_user
--

ALTER TABLE ONLY public.crm_segments
    ADD CONSTRAINT crm_segments_pkey PRIMARY KEY (id);


--
-- Name: crm_sequence_enrolments crm_sequence_enrolments_pkey; Type: CONSTRAINT; Schema: public; Owner: erp_user
--

ALTER TABLE ONLY public.crm_sequence_enrolments
    ADD CONSTRAINT crm_sequence_enrolments_pkey PRIMARY KEY (id);


--
-- Name: crm_sequence_steps crm_sequence_steps_pkey; Type: CONSTRAINT; Schema: public; Owner: erp_user
--

ALTER TABLE ONLY public.crm_sequence_steps
    ADD CONSTRAINT crm_sequence_steps_pkey PRIMARY KEY (id);


--
-- Name: crm_sequences crm_sequences_pkey; Type: CONSTRAINT; Schema: public; Owner: erp_user
--

ALTER TABLE ONLY public.crm_sequences
    ADD CONSTRAINT crm_sequences_pkey PRIMARY KEY (id);


--
-- Name: crm_tasks crm_tasks_pkey; Type: CONSTRAINT; Schema: public; Owner: erp_user
--

ALTER TABLE ONLY public.crm_tasks
    ADD CONSTRAINT crm_tasks_pkey PRIMARY KEY (id);


--
-- Name: crm_templates crm_templates_pkey; Type: CONSTRAINT; Schema: public; Owner: erp_user
--

ALTER TABLE ONLY public.crm_templates
    ADD CONSTRAINT crm_templates_pkey PRIMARY KEY (id);


--
-- Name: crm_territories crm_territories_pkey; Type: CONSTRAINT; Schema: public; Owner: erp_user
--

ALTER TABLE ONLY public.crm_territories
    ADD CONSTRAINT crm_territories_pkey PRIMARY KEY (id);


--
-- Name: crm_webhooks crm_webhooks_pkey; Type: CONSTRAINT; Schema: public; Owner: erp_user
--

ALTER TABLE ONLY public.crm_webhooks
    ADD CONSTRAINT crm_webhooks_pkey PRIMARY KEY (id);


--
-- Name: dead_stock_analysis dead_stock_analysis_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.dead_stock_analysis
    ADD CONSTRAINT dead_stock_analysis_pkey PRIMARY KEY (id);


--
-- Name: dispatches dispatches_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.dispatches
    ADD CONSTRAINT dispatches_pkey PRIMARY KEY (id);


--
-- Name: dms_audit_trail dms_audit_trail_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.dms_audit_trail
    ADD CONSTRAINT dms_audit_trail_pkey PRIMARY KEY (id);


--
-- Name: dms_documents dms_documents_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.dms_documents
    ADD CONSTRAINT dms_documents_pkey PRIMARY KEY (id);


--
-- Name: dms_folders dms_folders_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.dms_folders
    ADD CONSTRAINT dms_folders_pkey PRIMARY KEY (id);


--
-- Name: dms_versions dms_versions_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.dms_versions
    ADD CONSTRAINT dms_versions_pkey PRIMARY KEY (id);


--
-- Name: dms_workflows dms_workflows_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.dms_workflows
    ADD CONSTRAINT dms_workflows_pkey PRIMARY KEY (id);


--
-- Name: document_categories document_categories_name_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.document_categories
    ADD CONSTRAINT document_categories_name_key UNIQUE (name);


--
-- Name: document_categories document_categories_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.document_categories
    ADD CONSTRAINT document_categories_pkey PRIMARY KEY (id);


--
-- Name: drug_licenses drug_licenses_license_number_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.drug_licenses
    ADD CONSTRAINT drug_licenses_license_number_key UNIQUE (license_number);


--
-- Name: drug_licenses drug_licenses_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.drug_licenses
    ADD CONSTRAINT drug_licenses_pkey PRIMARY KEY (id);


--
-- Name: e_invoices e_invoices_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.e_invoices
    ADD CONSTRAINT e_invoices_pkey PRIMARY KEY (id);


--
-- Name: employees employees_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.employees
    ADD CONSTRAINT employees_pkey PRIMARY KEY (id);


--
-- Name: erp_settings erp_settings_pkey; Type: CONSTRAINT; Schema: public; Owner: erp_user
--

ALTER TABLE ONLY public.erp_settings
    ADD CONSTRAINT erp_settings_pkey PRIMARY KEY (key);


--
-- Name: expenses expenses_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.expenses
    ADD CONSTRAINT expenses_pkey PRIMARY KEY (id);


--
-- Name: financial_audit_log financial_audit_log_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.financial_audit_log
    ADD CONSTRAINT financial_audit_log_pkey PRIMARY KEY (id);


--
-- Name: financial_years financial_years_company_id_year_label_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.financial_years
    ADD CONSTRAINT financial_years_company_id_year_label_key UNIQUE (company_id, year_label);


--
-- Name: financial_years financial_years_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.financial_years
    ADD CONSTRAINT financial_years_pkey PRIMARY KEY (id);


--
-- Name: fixed_assets fixed_assets_asset_code_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.fixed_assets
    ADD CONSTRAINT fixed_assets_asset_code_key UNIQUE (asset_code);


--
-- Name: fixed_assets fixed_assets_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.fixed_assets
    ADD CONSTRAINT fixed_assets_pkey PRIMARY KEY (id);


--
-- Name: fixed_assets fixed_assets_serial_no_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.fixed_assets
    ADD CONSTRAINT fixed_assets_serial_no_key UNIQUE (serial_no);


--
-- Name: forecast_demand forecast_demand_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.forecast_demand
    ADD CONSTRAINT forecast_demand_pkey PRIMARY KEY (id);


--
-- Name: forex_rates forex_rates_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.forex_rates
    ADD CONSTRAINT forex_rates_pkey PRIMARY KEY (id);


--
-- Name: general_ledger general_ledger_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.general_ledger
    ADD CONSTRAINT general_ledger_pkey PRIMARY KEY (id);


--
-- Name: godowns godowns_company_id_name_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.godowns
    ADD CONSTRAINT godowns_company_id_name_key UNIQUE (company_id, name);


--
-- Name: godowns godowns_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.godowns
    ADD CONSTRAINT godowns_pkey PRIMARY KEY (id);


--
-- Name: goods_received_notes goods_received_notes_grn_number_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.goods_received_notes
    ADD CONSTRAINT goods_received_notes_grn_number_key UNIQUE (grn_number);


--
-- Name: goods_received_notes goods_received_notes_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.goods_received_notes
    ADD CONSTRAINT goods_received_notes_pkey PRIMARY KEY (id);


--
-- Name: grn_items grn_items_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.grn_items
    ADD CONSTRAINT grn_items_pkey PRIMARY KEY (id);


--
-- Name: h1_register h1_register_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.h1_register
    ADD CONSTRAINT h1_register_pkey PRIMARY KEY (id);


--
-- Name: inventory_turnover_analysis inventory_turnover_analysis_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.inventory_turnover_analysis
    ADD CONSTRAINT inventory_turnover_analysis_pkey PRIMARY KEY (id);


--
-- Name: journal_voucher_entries journal_voucher_entries_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.journal_voucher_entries
    ADD CONSTRAINT journal_voucher_entries_pkey PRIMARY KEY (id);


--
-- Name: journal_vouchers journal_vouchers_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.journal_vouchers
    ADD CONSTRAINT journal_vouchers_pkey PRIMARY KEY (id);


--
-- Name: journal_vouchers journal_vouchers_voucher_no_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.journal_vouchers
    ADD CONSTRAINT journal_vouchers_voucher_no_key UNIQUE (voucher_no);


--
-- Name: kpi_dashboard_data kpi_dashboard_data_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.kpi_dashboard_data
    ADD CONSTRAINT kpi_dashboard_data_pkey PRIMARY KEY (id);


--
-- Name: lead_activities lead_activities_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.lead_activities
    ADD CONSTRAINT lead_activities_pkey PRIMARY KEY (id);


--
-- Name: lead_interactions lead_interactions_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.lead_interactions
    ADD CONSTRAINT lead_interactions_pkey PRIMARY KEY (id);


--
-- Name: leads leads_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.leads
    ADD CONSTRAINT leads_pkey PRIMARY KEY (id);


--
-- Name: medical_representatives medical_representatives_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.medical_representatives
    ADD CONSTRAINT medical_representatives_pkey PRIMARY KEY (id);


--
-- Name: order_items order_items_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.order_items
    ADD CONSTRAINT order_items_pkey PRIMARY KEY (id);


--
-- Name: orders orders_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.orders
    ADD CONSTRAINT orders_pkey PRIMARY KEY (id);


--
-- Name: parties parties_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.parties
    ADD CONSTRAINT parties_pkey PRIMARY KEY (id);


--
-- Name: password_history password_history_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.password_history
    ADD CONSTRAINT password_history_pkey PRIMARY KEY (id);


--
-- Name: payment_vouchers payment_vouchers_payment_no_key; Type: CONSTRAINT; Schema: public; Owner: erp_user
--

ALTER TABLE ONLY public.payment_vouchers
    ADD CONSTRAINT payment_vouchers_payment_no_key UNIQUE (payment_no);


--
-- Name: payment_vouchers payment_vouchers_pkey; Type: CONSTRAINT; Schema: public; Owner: erp_user
--

ALTER TABLE ONLY public.payment_vouchers
    ADD CONSTRAINT payment_vouchers_pkey PRIMARY KEY (id);


--
-- Name: pcd_activity_log pcd_activity_log_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.pcd_activity_log
    ADD CONSTRAINT pcd_activity_log_pkey PRIMARY KEY (id);


--
-- Name: pcd_broadcast_messages pcd_broadcast_messages_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.pcd_broadcast_messages
    ADD CONSTRAINT pcd_broadcast_messages_pkey PRIMARY KEY (id);


--
-- Name: pcd_commissions pcd_commissions_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.pcd_commissions
    ADD CONSTRAINT pcd_commissions_pkey PRIMARY KEY (id);


--
-- Name: pcd_mr_assignments pcd_mr_assignments_partner_id_mr_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.pcd_mr_assignments
    ADD CONSTRAINT pcd_mr_assignments_partner_id_mr_id_key UNIQUE (partner_id, mr_id);


--
-- Name: pcd_mr_assignments pcd_mr_assignments_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.pcd_mr_assignments
    ADD CONSTRAINT pcd_mr_assignments_pkey PRIMARY KEY (id);


--
-- Name: pcd_partner_documents pcd_partner_documents_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.pcd_partner_documents
    ADD CONSTRAINT pcd_partner_documents_pkey PRIMARY KEY (id);


--
-- Name: pcd_partners pcd_partners_drug_license_no_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.pcd_partners
    ADD CONSTRAINT pcd_partners_drug_license_no_key UNIQUE (drug_license_no);


--
-- Name: pcd_partners pcd_partners_gst_registration_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.pcd_partners
    ADD CONSTRAINT pcd_partners_gst_registration_key UNIQUE (gst_registration);


--
-- Name: pcd_partners pcd_partners_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.pcd_partners
    ADD CONSTRAINT pcd_partners_pkey PRIMARY KEY (id);


--
-- Name: pcd_partners pcd_partners_territory_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.pcd_partners
    ADD CONSTRAINT pcd_partners_territory_key UNIQUE (territory);


--
-- Name: pcd_receivables pcd_receivables_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.pcd_receivables
    ADD CONSTRAINT pcd_receivables_pkey PRIMARY KEY (id);


--
-- Name: pcd_schemes pcd_schemes_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.pcd_schemes
    ADD CONSTRAINT pcd_schemes_pkey PRIMARY KEY (id);


--
-- Name: pcd_targets pcd_targets_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.pcd_targets
    ADD CONSTRAINT pcd_targets_pkey PRIMARY KEY (id);


--
-- Name: pcd_transactions pcd_transactions_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.pcd_transactions
    ADD CONSTRAINT pcd_transactions_pkey PRIMARY KEY (id);


--
-- Name: pdc_cheques pdc_cheques_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.pdc_cheques
    ADD CONSTRAINT pdc_cheques_pkey PRIMARY KEY (id);


--
-- Name: pdc_register pdc_register_pkey; Type: CONSTRAINT; Schema: public; Owner: erp_user
--

ALTER TABLE ONLY public.pdc_register
    ADD CONSTRAINT pdc_register_pkey PRIMARY KEY (id);


--
-- Name: pos_bill_items pos_bill_items_pkey; Type: CONSTRAINT; Schema: public; Owner: erp_user
--

ALTER TABLE ONLY public.pos_bill_items
    ADD CONSTRAINT pos_bill_items_pkey PRIMARY KEY (id);


--
-- Name: pos_bills pos_bills_bill_no_key; Type: CONSTRAINT; Schema: public; Owner: erp_user
--

ALTER TABLE ONLY public.pos_bills
    ADD CONSTRAINT pos_bills_bill_no_key UNIQUE (bill_no);


--
-- Name: pos_bills pos_bills_pkey; Type: CONSTRAINT; Schema: public; Owner: erp_user
--

ALTER TABLE ONLY public.pos_bills
    ADD CONSTRAINT pos_bills_pkey PRIMARY KEY (id);


--
-- Name: pos_payments pos_payments_pkey; Type: CONSTRAINT; Schema: public; Owner: erp_user
--

ALTER TABLE ONLY public.pos_payments
    ADD CONSTRAINT pos_payments_pkey PRIMARY KEY (id);


--
-- Name: pos_sessions pos_sessions_pkey; Type: CONSTRAINT; Schema: public; Owner: erp_user
--

ALTER TABLE ONLY public.pos_sessions
    ADD CONSTRAINT pos_sessions_pkey PRIMARY KEY (id);


--
-- Name: production_orders production_orders_order_no_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.production_orders
    ADD CONSTRAINT production_orders_order_no_key UNIQUE (order_no);


--
-- Name: production_orders production_orders_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.production_orders
    ADD CONSTRAINT production_orders_pkey PRIMARY KEY (id);


--
-- Name: products products_code_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.products
    ADD CONSTRAINT products_code_key UNIQUE (code);


--
-- Name: products products_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.products
    ADD CONSTRAINT products_pkey PRIMARY KEY (id);


--
-- Name: purchase_budgets purchase_budgets_category_id_period_name_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.purchase_budgets
    ADD CONSTRAINT purchase_budgets_category_id_period_name_key UNIQUE (category_id, period_name);


--
-- Name: purchase_budgets purchase_budgets_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.purchase_budgets
    ADD CONSTRAINT purchase_budgets_pkey PRIMARY KEY (id);


--
-- Name: purchase_invoice_items purchase_invoice_items_pkey; Type: CONSTRAINT; Schema: public; Owner: erp_user
--

ALTER TABLE ONLY public.purchase_invoice_items
    ADD CONSTRAINT purchase_invoice_items_pkey PRIMARY KEY (id);


--
-- Name: purchase_invoices purchase_invoices_pkey; Type: CONSTRAINT; Schema: public; Owner: erp_user
--

ALTER TABLE ONLY public.purchase_invoices
    ADD CONSTRAINT purchase_invoices_pkey PRIMARY KEY (id);


--
-- Name: purchase_invoices purchase_invoices_voucher_no_key; Type: CONSTRAINT; Schema: public; Owner: erp_user
--

ALTER TABLE ONLY public.purchase_invoices
    ADD CONSTRAINT purchase_invoices_voucher_no_key UNIQUE (voucher_no);


--
-- Name: purchase_items purchase_items_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.purchase_items
    ADD CONSTRAINT purchase_items_pkey PRIMARY KEY (id);


--
-- Name: purchase_order_items purchase_order_items_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.purchase_order_items
    ADD CONSTRAINT purchase_order_items_pkey PRIMARY KEY (id);


--
-- Name: purchase_orders purchase_orders_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.purchase_orders
    ADD CONSTRAINT purchase_orders_pkey PRIMARY KEY (id);


--
-- Name: purchase_orders purchase_orders_po_number_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.purchase_orders
    ADD CONSTRAINT purchase_orders_po_number_key UNIQUE (po_number);


--
-- Name: purchases purchases_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.purchases
    ADD CONSTRAINT purchases_pkey PRIMARY KEY (id);


--
-- Name: qc_parameters qc_parameters_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.qc_parameters
    ADD CONSTRAINT qc_parameters_pkey PRIMARY KEY (id);


--
-- Name: qc_records qc_records_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.qc_records
    ADD CONSTRAINT qc_records_pkey PRIMARY KEY (id);


--
-- Name: qc_reports qc_reports_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.qc_reports
    ADD CONSTRAINT qc_reports_pkey PRIMARY KEY (id);


--
-- Name: qc_test_results qc_test_results_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.qc_test_results
    ADD CONSTRAINT qc_test_results_pkey PRIMARY KEY (id);


--
-- Name: receipt_allocations receipt_allocations_pkey; Type: CONSTRAINT; Schema: public; Owner: erp_user
--

ALTER TABLE ONLY public.receipt_allocations
    ADD CONSTRAINT receipt_allocations_pkey PRIMARY KEY (id);


--
-- Name: receipt_vouchers receipt_vouchers_pkey; Type: CONSTRAINT; Schema: public; Owner: erp_user
--

ALTER TABLE ONLY public.receipt_vouchers
    ADD CONSTRAINT receipt_vouchers_pkey PRIMARY KEY (id);


--
-- Name: receipt_vouchers receipt_vouchers_receipt_no_key; Type: CONSTRAINT; Schema: public; Owner: erp_user
--

ALTER TABLE ONLY public.receipt_vouchers
    ADD CONSTRAINT receipt_vouchers_receipt_no_key UNIQUE (receipt_no);


--
-- Name: recurring_entries recurring_entries_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.recurring_entries
    ADD CONSTRAINT recurring_entries_pkey PRIMARY KEY (id);


--
-- Name: refresh_tokens refresh_tokens_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.refresh_tokens
    ADD CONSTRAINT refresh_tokens_pkey PRIMARY KEY (id);


--
-- Name: refresh_tokens refresh_tokens_user_id_token_hash_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.refresh_tokens
    ADD CONSTRAINT refresh_tokens_user_id_token_hash_key UNIQUE (user_id, token_hash);


--
-- Name: reserved_stock reserved_stock_batch_id_order_id_order_type_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.reserved_stock
    ADD CONSTRAINT reserved_stock_batch_id_order_id_order_type_key UNIQUE (batch_id, order_id, order_type);


--
-- Name: reserved_stock reserved_stock_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.reserved_stock
    ADD CONSTRAINT reserved_stock_pkey PRIMARY KEY (id);


--
-- Name: return_note_items return_note_items_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.return_note_items
    ADD CONSTRAINT return_note_items_pkey PRIMARY KEY (id);


--
-- Name: return_notes return_notes_company_id_return_number_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.return_notes
    ADD CONSTRAINT return_notes_company_id_return_number_key UNIQUE (company_id, return_number);


--
-- Name: return_notes return_notes_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.return_notes
    ADD CONSTRAINT return_notes_pkey PRIMARY KEY (id);


--
-- Name: return_notes return_notes_return_number_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.return_notes
    ADD CONSTRAINT return_notes_return_number_key UNIQUE (return_number);


--
-- Name: rnd_experiments rnd_experiments_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.rnd_experiments
    ADD CONSTRAINT rnd_experiments_pkey PRIMARY KEY (id);


--
-- Name: rnd_formulations rnd_formulations_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.rnd_formulations
    ADD CONSTRAINT rnd_formulations_pkey PRIMARY KEY (id);


--
-- Name: sales_invoice_items sales_invoice_items_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.sales_invoice_items
    ADD CONSTRAINT sales_invoice_items_pkey PRIMARY KEY (id);


--
-- Name: sales_invoices sales_invoices_invoice_number_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.sales_invoices
    ADD CONSTRAINT sales_invoices_invoice_number_key UNIQUE (invoice_number);


--
-- Name: sales_invoices sales_invoices_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.sales_invoices
    ADD CONSTRAINT sales_invoices_pkey PRIMARY KEY (id);


--
-- Name: stock_ledger_detailed stock_ledger_detailed_pkey; Type: CONSTRAINT; Schema: public; Owner: erp_user
--

ALTER TABLE ONLY public.stock_ledger_detailed
    ADD CONSTRAINT stock_ledger_detailed_pkey PRIMARY KEY (id);


--
-- Name: stock_ledger_detailed stock_ledger_detailed_transaction_id_key; Type: CONSTRAINT; Schema: public; Owner: erp_user
--

ALTER TABLE ONLY public.stock_ledger_detailed
    ADD CONSTRAINT stock_ledger_detailed_transaction_id_key UNIQUE (transaction_id);


--
-- Name: stock_ledger_entries stock_ledger_entries_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.stock_ledger_entries
    ADD CONSTRAINT stock_ledger_entries_pkey PRIMARY KEY (id);


--
-- Name: stock_movement_reasons stock_movement_reasons_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.stock_movement_reasons
    ADD CONSTRAINT stock_movement_reasons_pkey PRIMARY KEY (id);


--
-- Name: stock_movement_reasons stock_movement_reasons_reason_code_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.stock_movement_reasons
    ADD CONSTRAINT stock_movement_reasons_reason_code_key UNIQUE (reason_code);


--
-- Name: stock_reconciliation stock_reconciliation_company_id_godown_id_reconciliation_da_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.stock_reconciliation
    ADD CONSTRAINT stock_reconciliation_company_id_godown_id_reconciliation_da_key UNIQUE (company_id, godown_id, reconciliation_date);


--
-- Name: stock_reconciliation_items stock_reconciliation_items_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.stock_reconciliation_items
    ADD CONSTRAINT stock_reconciliation_items_pkey PRIMARY KEY (id);


--
-- Name: stock_reconciliation stock_reconciliation_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.stock_reconciliation
    ADD CONSTRAINT stock_reconciliation_pkey PRIMARY KEY (id);


--
-- Name: stock_reconciliation stock_reconciliation_reconciliation_number_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.stock_reconciliation
    ADD CONSTRAINT stock_reconciliation_reconciliation_number_key UNIQUE (reconciliation_number);


--
-- Name: supplier_invoices supplier_invoices_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.supplier_invoices
    ADD CONSTRAINT supplier_invoices_pkey PRIMARY KEY (id);


--
-- Name: supplier_invoices supplier_invoices_supplier_id_invoice_number_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.supplier_invoices
    ADD CONSTRAINT supplier_invoices_supplier_id_invoice_number_key UNIQUE (supplier_id, invoice_number);


--
-- Name: suppliers suppliers_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.suppliers
    ADD CONSTRAINT suppliers_pkey PRIMARY KEY (id);


--
-- Name: tax_configurations tax_configurations_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.tax_configurations
    ADD CONSTRAINT tax_configurations_pkey PRIMARY KEY (id);


--
-- Name: tds_entries tds_entries_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.tds_entries
    ADD CONSTRAINT tds_entries_pkey PRIMARY KEY (id);


--
-- Name: temperature_logs temperature_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.temperature_logs
    ADD CONSTRAINT temperature_logs_pkey PRIMARY KEY (id);


--
-- Name: three_way_matches three_way_matches_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.three_way_matches
    ADD CONSTRAINT three_way_matches_pkey PRIMARY KEY (id);


--
-- Name: users users_email_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key UNIQUE (email);


--
-- Name: users users_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);


--
-- Name: users users_username_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_username_key UNIQUE (username);


--
-- Name: valuation_configurations valuation_configurations_company_id_key; Type: CONSTRAINT; Schema: public; Owner: erp_user
--

ALTER TABLE ONLY public.valuation_configurations
    ADD CONSTRAINT valuation_configurations_company_id_key UNIQUE (company_id);


--
-- Name: valuation_configurations valuation_configurations_pkey; Type: CONSTRAINT; Schema: public; Owner: erp_user
--

ALTER TABLE ONLY public.valuation_configurations
    ADD CONSTRAINT valuation_configurations_pkey PRIMARY KEY (id);


--
-- Name: valuation_methods valuation_methods_code_key; Type: CONSTRAINT; Schema: public; Owner: erp_user
--

ALTER TABLE ONLY public.valuation_methods
    ADD CONSTRAINT valuation_methods_code_key UNIQUE (code);


--
-- Name: valuation_methods valuation_methods_pkey; Type: CONSTRAINT; Schema: public; Owner: erp_user
--

ALTER TABLE ONLY public.valuation_methods
    ADD CONSTRAINT valuation_methods_pkey PRIMARY KEY (id);


--
-- Name: vendor_ratings vendor_ratings_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.vendor_ratings
    ADD CONSTRAINT vendor_ratings_pkey PRIMARY KEY (id);


--
-- Name: vendor_ratings vendor_ratings_supplier_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.vendor_ratings
    ADD CONSTRAINT vendor_ratings_supplier_id_key UNIQUE (supplier_id);


--
-- Name: voucher_types voucher_types_name_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.voucher_types
    ADD CONSTRAINT voucher_types_name_key UNIQUE (name);


--
-- Name: voucher_types voucher_types_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.voucher_types
    ADD CONSTRAINT voucher_types_pkey PRIMARY KEY (id);


--
-- Name: idx_stg_coa_batch; Type: INDEX; Schema: accounts_staging; Owner: postgres
--

CREATE INDEX idx_stg_coa_batch ON accounts_staging.stg_chart_of_accounts USING btree (batch_id);


--
-- Name: idx_stg_coa_code; Type: INDEX; Schema: accounts_staging; Owner: postgres
--

CREATE INDEX idx_stg_coa_code ON accounts_staging.stg_chart_of_accounts USING btree (account_code);


--
-- Name: idx_stg_coa_status; Type: INDEX; Schema: accounts_staging; Owner: postgres
--

CREATE INDEX idx_stg_coa_status ON accounts_staging.stg_chart_of_accounts USING btree (import_status);


--
-- Name: idx_stg_parties_batch; Type: INDEX; Schema: accounts_staging; Owner: postgres
--

CREATE INDEX idx_stg_parties_batch ON accounts_staging.stg_parties USING btree (batch_id);


--
-- Name: idx_stg_parties_gstin; Type: INDEX; Schema: accounts_staging; Owner: postgres
--

CREATE INDEX idx_stg_parties_gstin ON accounts_staging.stg_parties USING btree (gstin);


--
-- Name: idx_stg_parties_status; Type: INDEX; Schema: accounts_staging; Owner: postgres
--

CREATE INDEX idx_stg_parties_status ON accounts_staging.stg_parties USING btree (import_status);


--
-- Name: idx_stg_ventries_batch; Type: INDEX; Schema: accounts_staging; Owner: postgres
--

CREATE INDEX idx_stg_ventries_batch ON accounts_staging.stg_voucher_entries USING btree (batch_id);


--
-- Name: idx_stg_ventries_status; Type: INDEX; Schema: accounts_staging; Owner: postgres
--

CREATE INDEX idx_stg_ventries_status ON accounts_staging.stg_voucher_entries USING btree (import_status);


--
-- Name: idx_stg_ventries_vno; Type: INDEX; Schema: accounts_staging; Owner: postgres
--

CREATE INDEX idx_stg_ventries_vno ON accounts_staging.stg_voucher_entries USING btree (voucher_no);


--
-- Name: idx_stg_vouchers_batch; Type: INDEX; Schema: accounts_staging; Owner: postgres
--

CREATE INDEX idx_stg_vouchers_batch ON accounts_staging.stg_vouchers USING btree (batch_id);


--
-- Name: idx_stg_vouchers_no; Type: INDEX; Schema: accounts_staging; Owner: postgres
--

CREATE INDEX idx_stg_vouchers_no ON accounts_staging.stg_vouchers USING btree (voucher_no);


--
-- Name: idx_stg_vouchers_status; Type: INDEX; Schema: accounts_staging; Owner: postgres
--

CREATE INDEX idx_stg_vouchers_status ON accounts_staging.stg_vouchers USING btree (import_status);


--
-- Name: idx_acc_anomalies_status; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_acc_anomalies_status ON public.acc_anomalies USING btree (status, severity, detected_at);


--
-- Name: idx_acc_anomalies_type; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_acc_anomalies_type ON public.acc_anomalies USING btree (anomaly_type, detected_at);


--
-- Name: idx_acc_bank_stmt_account; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_acc_bank_stmt_account ON public.acc_bank_statements USING btree (account_id, statement_date);


--
-- Name: idx_acc_bank_stmt_lines_date; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_acc_bank_stmt_lines_date ON public.acc_bank_statement_lines USING btree (transaction_date);


--
-- Name: idx_acc_bank_stmt_lines_stmt; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_acc_bank_stmt_lines_stmt ON public.acc_bank_statement_lines USING btree (statement_id, match_status);


--
-- Name: idx_acc_cashflow_date; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_acc_cashflow_date ON public.acc_cash_flow_forecast USING btree (forecast_date, week_number);


--
-- Name: idx_acc_checklist_period; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_acc_checklist_period ON public.acc_close_checklist USING btree (period_id, is_completed);


--
-- Name: idx_acc_dunning_log_date; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_acc_dunning_log_date ON public.acc_dunning_log USING btree (executed_at);


--
-- Name: idx_acc_dunning_log_party; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_acc_dunning_log_party ON public.acc_dunning_log USING btree (party_id, executed_at);


--
-- Name: idx_acc_fx_reval_date; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_acc_fx_reval_date ON public.acc_fx_revaluation_log USING btree (revaluation_date, account_id);


--
-- Name: idx_acc_payment_run_items_run; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_acc_payment_run_items_run ON public.acc_payment_run_items USING btree (run_id, status);


--
-- Name: idx_acc_payment_runs_status; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_acc_payment_runs_status ON public.acc_payment_runs USING btree (status, payment_date);


--
-- Name: idx_acc_periods_dates; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_acc_periods_dates ON public.acc_periods USING btree (start_date, end_date);


--
-- Name: idx_acc_periods_fy_status; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_acc_periods_fy_status ON public.acc_periods USING btree (financial_year_id, status);


--
-- Name: idx_acc_tally_sync; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_acc_tally_sync ON public.acc_tally_sync_log USING btree (sync_direction, created_at);


--
-- Name: idx_alerts_status; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_alerts_status ON public.asset_alerts USING btree (status);


--
-- Name: idx_api_keys_user_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_api_keys_user_id ON public.api_keys USING btree (user_id);


--
-- Name: idx_assets_category; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_assets_category ON public.fixed_assets USING btree (category_id);


--
-- Name: idx_audit_logs_created_at; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_audit_logs_created_at ON public.audit_logs USING btree (created_at);


--
-- Name: idx_audit_logs_user_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_audit_logs_user_id ON public.audit_logs USING btree (user_id);


--
-- Name: idx_audit_table; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_audit_table ON public.audit_log_accounting USING btree (table_name);


--
-- Name: idx_batches_available_qty; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_batches_available_qty ON public.batches USING btree (product_id, available_qty);


--
-- Name: idx_batches_expiry; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_batches_expiry ON public.batches USING btree (expiry_date);


--
-- Name: idx_batches_godown_product; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_batches_godown_product ON public.batches USING btree (godown_id, product_id);


--
-- Name: idx_batches_product; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_batches_product ON public.batches USING btree (product_id);


--
-- Name: idx_batches_product_expiry; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_batches_product_expiry ON public.batches USING btree (product_id, expiry_date);


--
-- Name: idx_batches_status; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_batches_status ON public.batches USING btree (status);


--
-- Name: idx_branches_name; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_branches_name ON public.branches USING btree (name);


--
-- Name: idx_coa_company; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_coa_company ON public.chart_of_accounts USING btree (company_id);


--
-- Name: idx_coa_type; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_coa_type ON public.chart_of_accounts USING btree (account_type);


--
-- Name: idx_company_doc_expiry; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_company_doc_expiry ON public.company_documents USING btree (expiry_date);


--
-- Name: idx_company_documents_expiry; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_company_documents_expiry ON public.company_documents USING btree (expiry_date);


--
-- Name: idx_company_documents_expiry_status; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_company_documents_expiry_status ON public.company_documents USING btree (expiry_date, status);


--
-- Name: idx_company_documents_status; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_company_documents_status ON public.company_documents USING btree (status);


--
-- Name: idx_company_documents_type; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_company_documents_type ON public.company_documents USING btree (document_type);


--
-- Name: idx_crm_accounts_status; Type: INDEX; Schema: public; Owner: erp_user
--

CREATE INDEX idx_crm_accounts_status ON public.crm_accounts USING btree (status);


--
-- Name: idx_crm_accounts_territory; Type: INDEX; Schema: public; Owner: erp_user
--

CREATE INDEX idx_crm_accounts_territory ON public.crm_accounts USING btree (territory);


--
-- Name: idx_crm_activities_account; Type: INDEX; Schema: public; Owner: erp_user
--

CREATE INDEX idx_crm_activities_account ON public.crm_activities USING btree (account_id);


--
-- Name: idx_crm_activities_date; Type: INDEX; Schema: public; Owner: erp_user
--

CREATE INDEX idx_crm_activities_date ON public.crm_activities USING btree (created_at DESC);


--
-- Name: idx_crm_activities_type; Type: INDEX; Schema: public; Owner: erp_user
--

CREATE INDEX idx_crm_activities_type ON public.crm_activities USING btree (activity_type);


--
-- Name: idx_crm_audit_log_entity; Type: INDEX; Schema: public; Owner: erp_user
--

CREATE INDEX idx_crm_audit_log_entity ON public.crm_audit_log USING btree (entity_type, entity_id);


--
-- Name: idx_crm_campaign_recipients_campaign; Type: INDEX; Schema: public; Owner: erp_user
--

CREATE INDEX idx_crm_campaign_recipients_campaign ON public.crm_campaign_recipients USING btree (campaign_id);


--
-- Name: idx_crm_contacts_account; Type: INDEX; Schema: public; Owner: erp_user
--

CREATE INDEX idx_crm_contacts_account ON public.crm_contacts USING btree (account_id);


--
-- Name: idx_crm_contacts_whatsapp; Type: INDEX; Schema: public; Owner: erp_user
--

CREATE INDEX idx_crm_contacts_whatsapp ON public.crm_contacts USING btree (whatsapp);


--
-- Name: idx_crm_embeddings_vector; Type: INDEX; Schema: public; Owner: erp_user
--

CREATE INDEX idx_crm_embeddings_vector ON public.crm_embeddings USING ivfflat (embedding public.vector_cosine_ops) WITH (lists='100');


--
-- Name: idx_crm_opportunities_owner; Type: INDEX; Schema: public; Owner: erp_user
--

CREATE INDEX idx_crm_opportunities_owner ON public.crm_opportunities USING btree (owner_id);


--
-- Name: idx_crm_opportunities_stage; Type: INDEX; Schema: public; Owner: erp_user
--

CREATE INDEX idx_crm_opportunities_stage ON public.crm_opportunities USING btree (stage);


--
-- Name: idx_crm_scores_entity; Type: INDEX; Schema: public; Owner: erp_user
--

CREATE INDEX idx_crm_scores_entity ON public.crm_scores USING btree (entity_type, entity_id);


--
-- Name: idx_crm_tasks_assigned; Type: INDEX; Schema: public; Owner: erp_user
--

CREATE INDEX idx_crm_tasks_assigned ON public.crm_tasks USING btree (assigned_to);


--
-- Name: idx_crm_tasks_due; Type: INDEX; Schema: public; Owner: erp_user
--

CREATE INDEX idx_crm_tasks_due ON public.crm_tasks USING btree (due_date);


--
-- Name: idx_crm_tasks_status; Type: INDEX; Schema: public; Owner: erp_user
--

CREATE INDEX idx_crm_tasks_status ON public.crm_tasks USING btree (status);


--
-- Name: idx_dispatches_customer; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_dispatches_customer ON public.dispatches USING btree (customer_name);


--
-- Name: idx_dispatches_date; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_dispatches_date ON public.dispatches USING btree (dispatch_date);


--
-- Name: idx_dispatches_invoice; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_dispatches_invoice ON public.dispatches USING btree (invoice_no);


--
-- Name: idx_dispatches_lr; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_dispatches_lr ON public.dispatches USING btree (lr_number);


--
-- Name: idx_dispatches_status; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_dispatches_status ON public.dispatches USING btree (status);


--
-- Name: idx_dms_audit_doc; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_dms_audit_doc ON public.dms_audit_trail USING btree (document_id);


--
-- Name: idx_dms_audit_doc_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_dms_audit_doc_id ON public.dms_audit_trail USING btree (document_id);


--
-- Name: idx_dms_doc_category; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_dms_doc_category ON public.dms_documents USING btree (category);


--
-- Name: idx_dms_doc_status; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_dms_doc_status ON public.dms_documents USING btree (status);


--
-- Name: idx_dms_expiry; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_dms_expiry ON public.dms_documents USING btree (expiry_date);


--
-- Name: idx_dms_folder; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_dms_folder ON public.dms_documents USING btree (folder_id);


--
-- Name: idx_dms_status; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_dms_status ON public.dms_documents USING btree (status);


--
-- Name: idx_dms_versions_doc; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_dms_versions_doc ON public.dms_versions USING btree (document_id);


--
-- Name: idx_doc_history_doc; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_doc_history_doc ON public.company_document_history USING btree (document_id);


--
-- Name: idx_document_categories_active; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_document_categories_active ON public.document_categories USING btree (is_active);


--
-- Name: idx_document_categories_sort; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_document_categories_sort ON public.document_categories USING btree (sort_order);


--
-- Name: idx_drug_licenses_expiry; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_drug_licenses_expiry ON public.drug_licenses USING btree (expiry_date);


--
-- Name: idx_employees_company; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_employees_company ON public.employees USING btree (company_id);


--
-- Name: idx_employees_name; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_employees_name ON public.employees USING btree (name);


--
-- Name: idx_employees_status; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_employees_status ON public.employees USING btree (status);


--
-- Name: idx_gl_acc_date_credit; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_gl_acc_date_credit ON public.general_ledger USING btree (account_id, transaction_date, credit);


--
-- Name: idx_gl_acc_date_debit; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_gl_acc_date_debit ON public.general_ledger USING btree (account_id, transaction_date, debit);


--
-- Name: idx_gl_account; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_gl_account ON public.general_ledger USING btree (account_id);


--
-- Name: idx_gl_account_date; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_gl_account_date ON public.general_ledger USING btree (account_id, transaction_date);


--
-- Name: idx_gl_date; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_gl_date ON public.general_ledger USING btree (transaction_date);


--
-- Name: idx_godowns_company_active; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_godowns_company_active ON public.godowns USING btree (company_id, status);


--
-- Name: idx_h1_created_by; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_h1_created_by ON public.h1_register USING btree (created_by);


--
-- Name: idx_h1_register_date; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_h1_register_date ON public.h1_register USING btree (entry_date);


--
-- Name: idx_h1_register_drug; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_h1_register_drug ON public.h1_register USING btree (drug_name);


--
-- Name: idx_insurance_expiry; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_insurance_expiry ON public.asset_insurance_policies USING btree (expiry_date);


--
-- Name: idx_interactions_lead; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_interactions_lead ON public.lead_interactions USING btree (lead_id);


--
-- Name: idx_invoices_date; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_invoices_date ON public.sales_invoices USING btree (date);


--
-- Name: idx_jv_date; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_jv_date ON public.journal_vouchers USING btree (voucher_date);


--
-- Name: idx_jv_status; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_jv_status ON public.journal_vouchers USING btree (status);


--
-- Name: idx_jve_voucher; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_jve_voucher ON public.journal_voucher_entries USING btree (voucher_id);


--
-- Name: idx_lead_activities_lead_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_lead_activities_lead_id ON public.lead_activities USING btree (lead_id);


--
-- Name: idx_lead_activities_performed_at; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_lead_activities_performed_at ON public.lead_activities USING btree (performed_at);


--
-- Name: idx_leads_assigned_to; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_leads_assigned_to ON public.leads USING btree (assigned_to);


--
-- Name: idx_leads_priority; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_leads_priority ON public.leads USING btree (priority);


--
-- Name: idx_leads_status; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_leads_status ON public.leads USING btree (status);


--
-- Name: idx_maintenance_asset; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_maintenance_asset ON public.asset_maintenance_logs USING btree (asset_id);


--
-- Name: idx_mrs_status; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_mrs_status ON public.medical_representatives USING btree (status);


--
-- Name: idx_mv_accounts_dashboard; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX idx_mv_accounts_dashboard ON public.mv_accounts_dashboard USING btree (((last_refreshed IS NOT NULL)));


--
-- Name: idx_order_items_order; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_order_items_order ON public.order_items USING btree (order_id);


--
-- Name: idx_orders_date; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_orders_date ON public.orders USING btree (order_date);


--
-- Name: idx_orders_distributor; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_orders_distributor ON public.orders USING btree (distributor_id);


--
-- Name: idx_orders_status; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_orders_status ON public.orders USING btree (status);


--
-- Name: idx_parties_mobile; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_parties_mobile ON public.parties USING btree (mobile);


--
-- Name: idx_parties_name; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_parties_name ON public.parties USING btree (name);


--
-- Name: idx_parties_name_trgm; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_parties_name_trgm ON public.parties USING gin (name public.gin_trgm_ops) WHERE (pg_get_expr(NULL::pg_node_tree, NULL::oid) IS NULL);


--
-- Name: idx_parties_type_status; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_parties_type_status ON public.parties USING btree (type, status);


--
-- Name: idx_password_history_user_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_password_history_user_id ON public.password_history USING btree (user_id);


--
-- Name: idx_pcd_commissions_partner_period; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_pcd_commissions_partner_period ON public.pcd_commissions USING btree (partner_id, period_start);


--
-- Name: idx_pcd_mr_assignments_partner; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_pcd_mr_assignments_partner ON public.pcd_mr_assignments USING btree (partner_id);


--
-- Name: idx_pcd_partner_documents_partner; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_pcd_partner_documents_partner ON public.pcd_partner_documents USING btree (partner_id);


--
-- Name: idx_pcd_partners_grade; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_pcd_partners_grade ON public.pcd_partners USING btree (partner_grade);


--
-- Name: idx_pcd_partners_status; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_pcd_partners_status ON public.pcd_partners USING btree (status);


--
-- Name: idx_pcd_partners_territory; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_pcd_partners_territory ON public.pcd_partners USING btree (territory);


--
-- Name: idx_pcd_receivables_partner_status; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_pcd_receivables_partner_status ON public.pcd_receivables USING btree (partner_id, status);


--
-- Name: idx_pcd_schemes_validity; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_pcd_schemes_validity ON public.pcd_schemes USING btree (validity_start, validity_end);


--
-- Name: idx_pcd_targets_partner_period; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_pcd_targets_partner_period ON public.pcd_targets USING btree (partner_id, period_start);


--
-- Name: idx_pcd_transactions_partner_date; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_pcd_transactions_partner_date ON public.pcd_transactions USING btree (partner_id, order_date);


--
-- Name: idx_pdc_date; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_pdc_date ON public.pdc_cheques USING btree (cheque_date);


--
-- Name: idx_pdc_party; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_pdc_party ON public.pdc_cheques USING btree (party_id);


--
-- Name: idx_pdc_status; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_pdc_status ON public.pdc_cheques USING btree (status);


--
-- Name: idx_pos_bill_items_bill; Type: INDEX; Schema: public; Owner: erp_user
--

CREATE INDEX idx_pos_bill_items_bill ON public.pos_bill_items USING btree (bill_id);


--
-- Name: idx_pos_bills_date; Type: INDEX; Schema: public; Owner: erp_user
--

CREATE INDEX idx_pos_bills_date ON public.pos_bills USING btree (bill_date DESC);


--
-- Name: idx_pos_bills_party; Type: INDEX; Schema: public; Owner: erp_user
--

CREATE INDEX idx_pos_bills_party ON public.pos_bills USING btree (party_id);


--
-- Name: idx_pos_bills_session; Type: INDEX; Schema: public; Owner: erp_user
--

CREATE INDEX idx_pos_bills_session ON public.pos_bills USING btree (session_id);


--
-- Name: idx_pos_sessions_status; Type: INDEX; Schema: public; Owner: erp_user
--

CREATE INDEX idx_pos_sessions_status ON public.pos_sessions USING btree (status);


--
-- Name: idx_pos_sessions_user; Type: INDEX; Schema: public; Owner: erp_user
--

CREATE INDEX idx_pos_sessions_user ON public.pos_sessions USING btree (opened_by);


--
-- Name: idx_products_is_active; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_products_is_active ON public.products USING btree (is_active);


--
-- Name: idx_products_name; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_products_name ON public.products USING btree (name);


--
-- Name: idx_qc_parameters_record; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_qc_parameters_record ON public.qc_parameters USING btree (record_id);


--
-- Name: idx_qc_records_batch; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_qc_records_batch ON public.qc_records USING btree (batch_id);


--
-- Name: idx_qc_records_batch_number; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_qc_records_batch_number ON public.qc_records USING btree (batch_number);


--
-- Name: idx_qc_records_status; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_qc_records_status ON public.qc_records USING btree (final_status);


--
-- Name: idx_qc_report_status; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_qc_report_status ON public.qc_reports USING btree (status);


--
-- Name: idx_recc_next_run; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_recc_next_run ON public.recurring_entries USING btree (next_run_date) WHERE (is_active = true);


--
-- Name: idx_reconciliation_company; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_reconciliation_company ON public.stock_reconciliation USING btree (company_id);


--
-- Name: idx_reconciliation_godown; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_reconciliation_godown ON public.stock_reconciliation USING btree (godown_id, reconciliation_date);


--
-- Name: idx_reconciliation_items_product; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_reconciliation_items_product ON public.stock_reconciliation_items USING btree (product_id, batch_id);


--
-- Name: idx_reconciliation_status; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_reconciliation_status ON public.stock_reconciliation USING btree (status);


--
-- Name: idx_refresh_tokens_expires_at; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_refresh_tokens_expires_at ON public.refresh_tokens USING btree (expires_at);


--
-- Name: idx_refresh_tokens_user_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_refresh_tokens_user_id ON public.refresh_tokens USING btree (user_id);


--
-- Name: idx_reserved_batch_qty; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_reserved_batch_qty ON public.reserved_stock USING btree (batch_id, qty_reserved);


--
-- Name: idx_reserved_order; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_reserved_order ON public.reserved_stock USING btree (order_id, order_type);


--
-- Name: idx_reserved_stock_company; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_reserved_stock_company ON public.reserved_stock USING btree (company_id);


--
-- Name: idx_return_items_product_batch; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_return_items_product_batch ON public.return_note_items USING btree (product_id, batch_id);


--
-- Name: idx_return_notes_company; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_return_notes_company ON public.return_notes USING btree (company_id);


--
-- Name: idx_return_notes_party; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_return_notes_party ON public.return_notes USING btree (party_id, return_date);


--
-- Name: idx_return_notes_status; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_return_notes_status ON public.return_notes USING btree (status);


--
-- Name: idx_rnd_experiments_formulation; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_rnd_experiments_formulation ON public.rnd_experiments USING btree (formulation_id);


--
-- Name: idx_rnd_experiments_status; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_rnd_experiments_status ON public.rnd_experiments USING btree (status);


--
-- Name: idx_rnd_formulations_product; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_rnd_formulations_product ON public.rnd_formulations USING btree (product_name);


--
-- Name: idx_rnd_formulations_stage; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_rnd_formulations_stage ON public.rnd_formulations USING btree (stage);


--
-- Name: idx_stock_ledger_company; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_stock_ledger_company ON public.stock_ledger_entries USING btree (company_id);


--
-- Name: idx_stock_ledger_detailed_batch; Type: INDEX; Schema: public; Owner: erp_user
--

CREATE INDEX idx_stock_ledger_detailed_batch ON public.stock_ledger_detailed USING btree (batch_id);


--
-- Name: idx_stock_ledger_detailed_product; Type: INDEX; Schema: public; Owner: erp_user
--

CREATE INDEX idx_stock_ledger_detailed_product ON public.stock_ledger_detailed USING btree (product_id);


--
-- Name: idx_temp_created_by; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_temp_created_by ON public.temperature_logs USING btree (created_by);


--
-- Name: idx_temp_logs_date; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_temp_logs_date ON public.temperature_logs USING btree (log_date);


--
-- Name: idx_three_way_invoice; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_three_way_invoice ON public.three_way_matches USING btree (invoice_id);


--
-- Name: idx_three_way_po; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_three_way_po ON public.three_way_matches USING btree (purchase_order_id);


--
-- Name: idx_transfers_asset; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_transfers_asset ON public.asset_transfers USING btree (asset_id);


--
-- Name: compliance_audits trg_audits_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER trg_audits_updated_at BEFORE UPDATE ON public.compliance_audits FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: company_documents trg_company_doc_status; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER trg_company_doc_status BEFORE INSERT OR UPDATE ON public.company_documents FOR EACH ROW EXECUTE FUNCTION public.sync_company_doc_status();


--
-- Name: financial_years trg_create_periods; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER trg_create_periods AFTER INSERT ON public.financial_years FOR EACH ROW EXECUTE FUNCTION public.fn_create_periods_for_year();


--
-- Name: dms_documents trg_dms_status; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER trg_dms_status BEFORE INSERT OR UPDATE ON public.dms_documents FOR EACH ROW EXECUTE FUNCTION public.sync_dms_status();


--
-- Name: drug_licenses trg_license_expiry_sync; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER trg_license_expiry_sync BEFORE INSERT OR UPDATE ON public.drug_licenses FOR EACH ROW EXECUTE FUNCTION public.sync_license_expiry_status();


--
-- Name: general_ledger trg_update_account_balance; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER trg_update_account_balance AFTER INSERT ON public.general_ledger FOR EACH ROW EXECUTE FUNCTION public.fn_update_account_balance();


--
-- Name: stock_reconciliation trigger_generate_reconciliation_number; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER trigger_generate_reconciliation_number BEFORE INSERT ON public.stock_reconciliation FOR EACH ROW EXECUTE FUNCTION public.generate_reconciliation_number();


--
-- Name: godowns trigger_update_godowns_timestamp; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER trigger_update_godowns_timestamp BEFORE UPDATE ON public.godowns FOR EACH ROW EXECUTE FUNCTION public.update_godowns_timestamp();


--
-- Name: abc_classification abc_classification_abc_analysis_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.abc_classification
    ADD CONSTRAINT abc_classification_abc_analysis_id_fkey FOREIGN KEY (abc_analysis_id) REFERENCES public.abc_analysis(id);


--
-- Name: abc_classification abc_classification_product_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.abc_classification
    ADD CONSTRAINT abc_classification_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products(id);


--
-- Name: acc_anomalies acc_anomalies_gl_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.acc_anomalies
    ADD CONSTRAINT acc_anomalies_gl_id_fkey FOREIGN KEY (gl_id) REFERENCES public.general_ledger(id);


--
-- Name: acc_anomalies acc_anomalies_voucher_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.acc_anomalies
    ADD CONSTRAINT acc_anomalies_voucher_id_fkey FOREIGN KEY (voucher_id) REFERENCES public.journal_vouchers(id);


--
-- Name: acc_bank_statement_lines acc_bank_statement_lines_matched_gl_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.acc_bank_statement_lines
    ADD CONSTRAINT acc_bank_statement_lines_matched_gl_id_fkey FOREIGN KEY (matched_gl_id) REFERENCES public.general_ledger(id);


--
-- Name: acc_bank_statement_lines acc_bank_statement_lines_matched_voucher_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.acc_bank_statement_lines
    ADD CONSTRAINT acc_bank_statement_lines_matched_voucher_id_fkey FOREIGN KEY (matched_voucher_id) REFERENCES public.journal_vouchers(id);


--
-- Name: acc_bank_statement_lines acc_bank_statement_lines_statement_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.acc_bank_statement_lines
    ADD CONSTRAINT acc_bank_statement_lines_statement_id_fkey FOREIGN KEY (statement_id) REFERENCES public.acc_bank_statements(id) ON DELETE CASCADE;


--
-- Name: acc_bank_statements acc_bank_statements_account_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.acc_bank_statements
    ADD CONSTRAINT acc_bank_statements_account_id_fkey FOREIGN KEY (account_id) REFERENCES public.chart_of_accounts(id);


--
-- Name: acc_close_checklist acc_close_checklist_period_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.acc_close_checklist
    ADD CONSTRAINT acc_close_checklist_period_id_fkey FOREIGN KEY (period_id) REFERENCES public.acc_periods(id) ON DELETE CASCADE;


--
-- Name: acc_dunning_log acc_dunning_log_rule_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.acc_dunning_log
    ADD CONSTRAINT acc_dunning_log_rule_id_fkey FOREIGN KEY (rule_id) REFERENCES public.acc_dunning_rules(id);


--
-- Name: acc_fx_revaluation_log acc_fx_revaluation_log_account_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.acc_fx_revaluation_log
    ADD CONSTRAINT acc_fx_revaluation_log_account_id_fkey FOREIGN KEY (account_id) REFERENCES public.chart_of_accounts(id);


--
-- Name: acc_fx_revaluation_log acc_fx_revaluation_log_voucher_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.acc_fx_revaluation_log
    ADD CONSTRAINT acc_fx_revaluation_log_voucher_id_fkey FOREIGN KEY (voucher_id) REFERENCES public.journal_vouchers(id);


--
-- Name: acc_payment_run_items acc_payment_run_items_run_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.acc_payment_run_items
    ADD CONSTRAINT acc_payment_run_items_run_id_fkey FOREIGN KEY (run_id) REFERENCES public.acc_payment_runs(id) ON DELETE CASCADE;


--
-- Name: acc_payment_run_items acc_payment_run_items_voucher_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.acc_payment_run_items
    ADD CONSTRAINT acc_payment_run_items_voucher_id_fkey FOREIGN KEY (voucher_id) REFERENCES public.journal_vouchers(id);


--
-- Name: acc_payment_runs acc_payment_runs_bank_account_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.acc_payment_runs
    ADD CONSTRAINT acc_payment_runs_bank_account_id_fkey FOREIGN KEY (bank_account_id) REFERENCES public.chart_of_accounts(id);


--
-- Name: api_keys api_keys_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.api_keys
    ADD CONSTRAINT api_keys_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: asset_alerts asset_alerts_asset_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.asset_alerts
    ADD CONSTRAINT asset_alerts_asset_id_fkey FOREIGN KEY (asset_id) REFERENCES public.fixed_assets(id) ON DELETE CASCADE;


--
-- Name: asset_insurance_policies asset_insurance_policies_asset_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.asset_insurance_policies
    ADD CONSTRAINT asset_insurance_policies_asset_id_fkey FOREIGN KEY (asset_id) REFERENCES public.fixed_assets(id) ON DELETE CASCADE;


--
-- Name: asset_maintenance_logs asset_maintenance_logs_asset_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.asset_maintenance_logs
    ADD CONSTRAINT asset_maintenance_logs_asset_id_fkey FOREIGN KEY (asset_id) REFERENCES public.fixed_assets(id) ON DELETE CASCADE;


--
-- Name: asset_maintenance_logs asset_maintenance_logs_vendor_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.asset_maintenance_logs
    ADD CONSTRAINT asset_maintenance_logs_vendor_id_fkey FOREIGN KEY (vendor_id) REFERENCES public.parties(id);


--
-- Name: asset_transfers asset_transfers_approved_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.asset_transfers
    ADD CONSTRAINT asset_transfers_approved_by_fkey FOREIGN KEY (approved_by) REFERENCES public.users(id);


--
-- Name: asset_transfers asset_transfers_asset_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.asset_transfers
    ADD CONSTRAINT asset_transfers_asset_id_fkey FOREIGN KEY (asset_id) REFERENCES public.fixed_assets(id) ON DELETE CASCADE;


--
-- Name: audit_log_accounting audit_log_accounting_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.audit_log_accounting
    ADD CONSTRAINT audit_log_accounting_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id);


--
-- Name: audit_logs audit_logs_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.audit_logs
    ADD CONSTRAINT audit_logs_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: bank_reconciliation bank_reconciliation_bank_account_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.bank_reconciliation
    ADD CONSTRAINT bank_reconciliation_bank_account_id_fkey FOREIGN KEY (bank_account_id) REFERENCES public.chart_of_accounts(id);


--
-- Name: bank_reconciliation bank_reconciliation_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.bank_reconciliation
    ADD CONSTRAINT bank_reconciliation_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id);


--
-- Name: bank_reconciliations bank_reconciliations_account_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.bank_reconciliations
    ADD CONSTRAINT bank_reconciliations_account_id_fkey FOREIGN KEY (account_id) REFERENCES public.chart_of_accounts(id);


--
-- Name: batch_valuation_history batch_valuation_history_batch_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: erp_user
--

ALTER TABLE ONLY public.batch_valuation_history
    ADD CONSTRAINT batch_valuation_history_batch_id_fkey FOREIGN KEY (batch_id) REFERENCES public.batches(id);


--
-- Name: batches batches_godown_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.batches
    ADD CONSTRAINT batches_godown_id_fkey FOREIGN KEY (godown_id) REFERENCES public.godowns(id);


--
-- Name: batches batches_product_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.batches
    ADD CONSTRAINT batches_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products(id) ON DELETE CASCADE;


--
-- Name: boms boms_product_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.boms
    ADD CONSTRAINT boms_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products(id);


--
-- Name: budgets budgets_account_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.budgets
    ADD CONSTRAINT budgets_account_id_fkey FOREIGN KEY (account_id) REFERENCES public.chart_of_accounts(id);


--
-- Name: budgets budgets_cost_center_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.budgets
    ADD CONSTRAINT budgets_cost_center_id_fkey FOREIGN KEY (cost_center_id) REFERENCES public.cost_centers(id);


--
-- Name: budgets budgets_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.budgets
    ADD CONSTRAINT budgets_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id);


--
-- Name: chart_of_accounts chart_of_accounts_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.chart_of_accounts
    ADD CONSTRAINT chart_of_accounts_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id);


--
-- Name: chart_of_accounts chart_of_accounts_parent_account_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.chart_of_accounts
    ADD CONSTRAINT chart_of_accounts_parent_account_id_fkey FOREIGN KEY (parent_account_id) REFERENCES public.chart_of_accounts(id);


--
-- Name: company_document_history company_document_history_document_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.company_document_history
    ADD CONSTRAINT company_document_history_document_id_fkey FOREIGN KEY (document_id) REFERENCES public.company_documents(id) ON DELETE CASCADE;


--
-- Name: compliance_checklist_items compliance_checklist_items_audit_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.compliance_checklist_items
    ADD CONSTRAINT compliance_checklist_items_audit_id_fkey FOREIGN KEY (audit_id) REFERENCES public.compliance_audits(id) ON DELETE CASCADE;


--
-- Name: compliance_notification_log compliance_notification_log_license_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.compliance_notification_log
    ADD CONSTRAINT compliance_notification_log_license_id_fkey FOREIGN KEY (license_id) REFERENCES public.drug_licenses(id) ON DELETE CASCADE;


--
-- Name: cost_centers cost_centers_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.cost_centers
    ADD CONSTRAINT cost_centers_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id);


--
-- Name: cost_centers cost_centers_manager_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.cost_centers
    ADD CONSTRAINT cost_centers_manager_id_fkey FOREIGN KEY (manager_id) REFERENCES public.users(id);


--
-- Name: crm_activities crm_activities_account_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: erp_user
--

ALTER TABLE ONLY public.crm_activities
    ADD CONSTRAINT crm_activities_account_id_fkey FOREIGN KEY (account_id) REFERENCES public.crm_accounts(id) ON DELETE SET NULL;


--
-- Name: crm_activities crm_activities_contact_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: erp_user
--

ALTER TABLE ONLY public.crm_activities
    ADD CONSTRAINT crm_activities_contact_id_fkey FOREIGN KEY (contact_id) REFERENCES public.crm_contacts(id) ON DELETE SET NULL;


--
-- Name: crm_activities crm_activities_opportunity_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: erp_user
--

ALTER TABLE ONLY public.crm_activities
    ADD CONSTRAINT crm_activities_opportunity_id_fkey FOREIGN KEY (opportunity_id) REFERENCES public.crm_opportunities(id) ON DELETE SET NULL;


--
-- Name: crm_campaign_recipients crm_campaign_recipients_campaign_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: erp_user
--

ALTER TABLE ONLY public.crm_campaign_recipients
    ADD CONSTRAINT crm_campaign_recipients_campaign_id_fkey FOREIGN KEY (campaign_id) REFERENCES public.crm_campaigns(id) ON DELETE CASCADE;


--
-- Name: crm_campaign_recipients crm_campaign_recipients_contact_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: erp_user
--

ALTER TABLE ONLY public.crm_campaign_recipients
    ADD CONSTRAINT crm_campaign_recipients_contact_id_fkey FOREIGN KEY (contact_id) REFERENCES public.crm_contacts(id);


--
-- Name: crm_consents crm_consents_contact_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: erp_user
--

ALTER TABLE ONLY public.crm_consents
    ADD CONSTRAINT crm_consents_contact_id_fkey FOREIGN KEY (contact_id) REFERENCES public.crm_contacts(id) ON DELETE CASCADE;


--
-- Name: crm_contacts crm_contacts_account_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: erp_user
--

ALTER TABLE ONLY public.crm_contacts
    ADD CONSTRAINT crm_contacts_account_id_fkey FOREIGN KEY (account_id) REFERENCES public.crm_accounts(id) ON DELETE SET NULL;


--
-- Name: crm_hcps crm_hcps_contact_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: erp_user
--

ALTER TABLE ONLY public.crm_hcps
    ADD CONSTRAINT crm_hcps_contact_id_fkey FOREIGN KEY (contact_id) REFERENCES public.crm_contacts(id) ON DELETE CASCADE;


--
-- Name: crm_leads crm_leads_converted_account_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: erp_user
--

ALTER TABLE ONLY public.crm_leads
    ADD CONSTRAINT crm_leads_converted_account_id_fkey FOREIGN KEY (converted_account_id) REFERENCES public.crm_accounts(id);


--
-- Name: crm_leads crm_leads_converted_contact_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: erp_user
--

ALTER TABLE ONLY public.crm_leads
    ADD CONSTRAINT crm_leads_converted_contact_id_fkey FOREIGN KEY (converted_contact_id) REFERENCES public.crm_contacts(id);


--
-- Name: crm_opportunities crm_opportunities_account_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: erp_user
--

ALTER TABLE ONLY public.crm_opportunities
    ADD CONSTRAINT crm_opportunities_account_id_fkey FOREIGN KEY (account_id) REFERENCES public.crm_accounts(id) ON DELETE SET NULL;


--
-- Name: crm_opportunities crm_opportunities_contact_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: erp_user
--

ALTER TABLE ONLY public.crm_opportunities
    ADD CONSTRAINT crm_opportunities_contact_id_fkey FOREIGN KEY (contact_id) REFERENCES public.crm_contacts(id) ON DELETE SET NULL;


--
-- Name: crm_opportunities crm_opportunities_pipeline_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: erp_user
--

ALTER TABLE ONLY public.crm_opportunities
    ADD CONSTRAINT crm_opportunities_pipeline_id_fkey FOREIGN KEY (pipeline_id) REFERENCES public.crm_pipelines(id);


--
-- Name: crm_pipeline_stages crm_pipeline_stages_pipeline_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: erp_user
--

ALTER TABLE ONLY public.crm_pipeline_stages
    ADD CONSTRAINT crm_pipeline_stages_pipeline_id_fkey FOREIGN KEY (pipeline_id) REFERENCES public.crm_pipelines(id) ON DELETE CASCADE;


--
-- Name: crm_quote_lines crm_quote_lines_quote_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: erp_user
--

ALTER TABLE ONLY public.crm_quote_lines
    ADD CONSTRAINT crm_quote_lines_quote_id_fkey FOREIGN KEY (quote_id) REFERENCES public.crm_quotes(id) ON DELETE CASCADE;


--
-- Name: crm_quotes crm_quotes_account_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: erp_user
--

ALTER TABLE ONLY public.crm_quotes
    ADD CONSTRAINT crm_quotes_account_id_fkey FOREIGN KEY (account_id) REFERENCES public.crm_accounts(id) ON DELETE SET NULL;


--
-- Name: crm_quotes crm_quotes_contact_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: erp_user
--

ALTER TABLE ONLY public.crm_quotes
    ADD CONSTRAINT crm_quotes_contact_id_fkey FOREIGN KEY (contact_id) REFERENCES public.crm_contacts(id) ON DELETE SET NULL;


--
-- Name: crm_quotes crm_quotes_opportunity_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: erp_user
--

ALTER TABLE ONLY public.crm_quotes
    ADD CONSTRAINT crm_quotes_opportunity_id_fkey FOREIGN KEY (opportunity_id) REFERENCES public.crm_opportunities(id) ON DELETE SET NULL;


--
-- Name: crm_samples crm_samples_account_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: erp_user
--

ALTER TABLE ONLY public.crm_samples
    ADD CONSTRAINT crm_samples_account_id_fkey FOREIGN KEY (account_id) REFERENCES public.crm_accounts(id) ON DELETE SET NULL;


--
-- Name: crm_samples crm_samples_contact_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: erp_user
--

ALTER TABLE ONLY public.crm_samples
    ADD CONSTRAINT crm_samples_contact_id_fkey FOREIGN KEY (contact_id) REFERENCES public.crm_contacts(id) ON DELETE SET NULL;


--
-- Name: crm_sequence_enrolments crm_sequence_enrolments_contact_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: erp_user
--

ALTER TABLE ONLY public.crm_sequence_enrolments
    ADD CONSTRAINT crm_sequence_enrolments_contact_id_fkey FOREIGN KEY (contact_id) REFERENCES public.crm_contacts(id);


--
-- Name: crm_sequence_enrolments crm_sequence_enrolments_sequence_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: erp_user
--

ALTER TABLE ONLY public.crm_sequence_enrolments
    ADD CONSTRAINT crm_sequence_enrolments_sequence_id_fkey FOREIGN KEY (sequence_id) REFERENCES public.crm_sequences(id);


--
-- Name: crm_sequence_steps crm_sequence_steps_sequence_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: erp_user
--

ALTER TABLE ONLY public.crm_sequence_steps
    ADD CONSTRAINT crm_sequence_steps_sequence_id_fkey FOREIGN KEY (sequence_id) REFERENCES public.crm_sequences(id) ON DELETE CASCADE;


--
-- Name: crm_sequence_steps crm_sequence_steps_template_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: erp_user
--

ALTER TABLE ONLY public.crm_sequence_steps
    ADD CONSTRAINT crm_sequence_steps_template_id_fkey FOREIGN KEY (template_id) REFERENCES public.crm_templates(id);


--
-- Name: crm_tasks crm_tasks_account_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: erp_user
--

ALTER TABLE ONLY public.crm_tasks
    ADD CONSTRAINT crm_tasks_account_id_fkey FOREIGN KEY (account_id) REFERENCES public.crm_accounts(id) ON DELETE SET NULL;


--
-- Name: crm_tasks crm_tasks_contact_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: erp_user
--

ALTER TABLE ONLY public.crm_tasks
    ADD CONSTRAINT crm_tasks_contact_id_fkey FOREIGN KEY (contact_id) REFERENCES public.crm_contacts(id) ON DELETE SET NULL;


--
-- Name: crm_tasks crm_tasks_opportunity_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: erp_user
--

ALTER TABLE ONLY public.crm_tasks
    ADD CONSTRAINT crm_tasks_opportunity_id_fkey FOREIGN KEY (opportunity_id) REFERENCES public.crm_opportunities(id) ON DELETE SET NULL;


--
-- Name: crm_territories crm_territories_parent_territory_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: erp_user
--

ALTER TABLE ONLY public.crm_territories
    ADD CONSTRAINT crm_territories_parent_territory_id_fkey FOREIGN KEY (parent_territory_id) REFERENCES public.crm_territories(id);


--
-- Name: dead_stock_analysis dead_stock_analysis_batch_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.dead_stock_analysis
    ADD CONSTRAINT dead_stock_analysis_batch_id_fkey FOREIGN KEY (batch_id) REFERENCES public.batches(id);


--
-- Name: dead_stock_analysis dead_stock_analysis_product_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.dead_stock_analysis
    ADD CONSTRAINT dead_stock_analysis_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products(id);


--
-- Name: dms_audit_trail dms_audit_trail_document_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.dms_audit_trail
    ADD CONSTRAINT dms_audit_trail_document_id_fkey FOREIGN KEY (document_id) REFERENCES public.dms_documents(id) ON DELETE CASCADE;


--
-- Name: dms_audit_trail dms_audit_trail_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.dms_audit_trail
    ADD CONSTRAINT dms_audit_trail_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id);


--
-- Name: dms_documents dms_documents_author_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.dms_documents
    ADD CONSTRAINT dms_documents_author_id_fkey FOREIGN KEY (author_id) REFERENCES public.users(id);


--
-- Name: dms_documents dms_documents_folder_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.dms_documents
    ADD CONSTRAINT dms_documents_folder_id_fkey FOREIGN KEY (folder_id) REFERENCES public.dms_folders(id) ON DELETE SET NULL;


--
-- Name: dms_folders dms_folders_parent_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.dms_folders
    ADD CONSTRAINT dms_folders_parent_id_fkey FOREIGN KEY (parent_id) REFERENCES public.dms_folders(id) ON DELETE SET NULL;


--
-- Name: dms_versions dms_versions_document_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.dms_versions
    ADD CONSTRAINT dms_versions_document_id_fkey FOREIGN KEY (document_id) REFERENCES public.dms_documents(id) ON DELETE CASCADE;


--
-- Name: dms_versions dms_versions_uploaded_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.dms_versions
    ADD CONSTRAINT dms_versions_uploaded_by_fkey FOREIGN KEY (uploaded_by) REFERENCES public.users(id);


--
-- Name: dms_workflows dms_workflows_document_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.dms_workflows
    ADD CONSTRAINT dms_workflows_document_id_fkey FOREIGN KEY (document_id) REFERENCES public.dms_documents(id) ON DELETE CASCADE;


--
-- Name: e_invoices e_invoices_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.e_invoices
    ADD CONSTRAINT e_invoices_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id);


--
-- Name: employees employees_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.employees
    ADD CONSTRAINT employees_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id);


--
-- Name: financial_years financial_years_closed_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.financial_years
    ADD CONSTRAINT financial_years_closed_by_fkey FOREIGN KEY (closed_by) REFERENCES public.users(id);


--
-- Name: fixed_assets fixed_assets_account_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.fixed_assets
    ADD CONSTRAINT fixed_assets_account_id_fkey FOREIGN KEY (account_id) REFERENCES public.chart_of_accounts(id);


--
-- Name: fixed_assets fixed_assets_category_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.fixed_assets
    ADD CONSTRAINT fixed_assets_category_id_fkey FOREIGN KEY (category_id) REFERENCES public.asset_categories(id);


--
-- Name: fixed_assets fixed_assets_vendor_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.fixed_assets
    ADD CONSTRAINT fixed_assets_vendor_id_fkey FOREIGN KEY (vendor_id) REFERENCES public.parties(id);


--
-- Name: forecast_demand forecast_demand_product_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.forecast_demand
    ADD CONSTRAINT forecast_demand_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products(id);


--
-- Name: general_ledger general_ledger_account_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.general_ledger
    ADD CONSTRAINT general_ledger_account_id_fkey FOREIGN KEY (account_id) REFERENCES public.chart_of_accounts(id);


--
-- Name: general_ledger general_ledger_party_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.general_ledger
    ADD CONSTRAINT general_ledger_party_id_fkey FOREIGN KEY (party_id) REFERENCES public.parties(id);


--
-- Name: general_ledger general_ledger_voucher_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.general_ledger
    ADD CONSTRAINT general_ledger_voucher_id_fkey FOREIGN KEY (voucher_id) REFERENCES public.journal_vouchers(id);


--
-- Name: godowns godowns_manager_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.godowns
    ADD CONSTRAINT godowns_manager_id_fkey FOREIGN KEY (manager_id) REFERENCES public.users(id);


--
-- Name: goods_received_notes goods_received_notes_purchase_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.goods_received_notes
    ADD CONSTRAINT goods_received_notes_purchase_order_id_fkey FOREIGN KEY (purchase_order_id) REFERENCES public.purchase_orders(id) ON DELETE CASCADE;


--
-- Name: goods_received_notes goods_received_notes_received_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.goods_received_notes
    ADD CONSTRAINT goods_received_notes_received_by_fkey FOREIGN KEY (received_by) REFERENCES public.users(id);


--
-- Name: grn_items grn_items_grn_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.grn_items
    ADD CONSTRAINT grn_items_grn_id_fkey FOREIGN KEY (grn_id) REFERENCES public.goods_received_notes(id) ON DELETE CASCADE;


--
-- Name: grn_items grn_items_po_item_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.grn_items
    ADD CONSTRAINT grn_items_po_item_id_fkey FOREIGN KEY (po_item_id) REFERENCES public.purchase_order_items(id);


--
-- Name: grn_items grn_items_product_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.grn_items
    ADD CONSTRAINT grn_items_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products(id);


--
-- Name: h1_register h1_register_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.h1_register
    ADD CONSTRAINT h1_register_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: inventory_turnover_analysis inventory_turnover_analysis_product_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.inventory_turnover_analysis
    ADD CONSTRAINT inventory_turnover_analysis_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products(id);


--
-- Name: journal_voucher_entries journal_voucher_entries_account_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.journal_voucher_entries
    ADD CONSTRAINT journal_voucher_entries_account_id_fkey FOREIGN KEY (account_id) REFERENCES public.chart_of_accounts(id);


--
-- Name: journal_voucher_entries journal_voucher_entries_voucher_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.journal_voucher_entries
    ADD CONSTRAINT journal_voucher_entries_voucher_id_fkey FOREIGN KEY (voucher_id) REFERENCES public.journal_vouchers(id) ON DELETE CASCADE;


--
-- Name: journal_vouchers journal_vouchers_approved_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.journal_vouchers
    ADD CONSTRAINT journal_vouchers_approved_by_fkey FOREIGN KEY (approved_by) REFERENCES public.users(id);


--
-- Name: journal_vouchers journal_vouchers_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.journal_vouchers
    ADD CONSTRAINT journal_vouchers_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id);


--
-- Name: journal_vouchers journal_vouchers_original_voucher_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.journal_vouchers
    ADD CONSTRAINT journal_vouchers_original_voucher_id_fkey FOREIGN KEY (original_voucher_id) REFERENCES public.journal_vouchers(id);


--
-- Name: journal_vouchers journal_vouchers_party_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.journal_vouchers
    ADD CONSTRAINT journal_vouchers_party_id_fkey FOREIGN KEY (party_id) REFERENCES public.parties(id);


--
-- Name: journal_vouchers journal_vouchers_posted_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.journal_vouchers
    ADD CONSTRAINT journal_vouchers_posted_by_fkey FOREIGN KEY (posted_by) REFERENCES public.users(id);


--
-- Name: lead_activities lead_activities_lead_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.lead_activities
    ADD CONSTRAINT lead_activities_lead_id_fkey FOREIGN KEY (lead_id) REFERENCES public.leads(id) ON DELETE CASCADE;


--
-- Name: lead_activities lead_activities_performed_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.lead_activities
    ADD CONSTRAINT lead_activities_performed_by_fkey FOREIGN KEY (performed_by) REFERENCES public.users(id);


--
-- Name: lead_interactions lead_interactions_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.lead_interactions
    ADD CONSTRAINT lead_interactions_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id);


--
-- Name: lead_interactions lead_interactions_lead_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.lead_interactions
    ADD CONSTRAINT lead_interactions_lead_id_fkey FOREIGN KEY (lead_id) REFERENCES public.leads(id) ON DELETE CASCADE;


--
-- Name: leads leads_assigned_to_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.leads
    ADD CONSTRAINT leads_assigned_to_fkey FOREIGN KEY (assigned_to) REFERENCES public.users(id);


--
-- Name: order_items order_items_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.order_items
    ADD CONSTRAINT order_items_order_id_fkey FOREIGN KEY (order_id) REFERENCES public.orders(id) ON DELETE CASCADE;


--
-- Name: order_items order_items_product_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.order_items
    ADD CONSTRAINT order_items_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products(id);


--
-- Name: orders orders_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.orders
    ADD CONSTRAINT orders_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id);


--
-- Name: orders orders_distributor_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.orders
    ADD CONSTRAINT orders_distributor_id_fkey FOREIGN KEY (distributor_id) REFERENCES public.parties(id) ON DELETE CASCADE;


--
-- Name: password_history password_history_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.password_history
    ADD CONSTRAINT password_history_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: payment_vouchers payment_vouchers_bank_account_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: erp_user
--

ALTER TABLE ONLY public.payment_vouchers
    ADD CONSTRAINT payment_vouchers_bank_account_id_fkey FOREIGN KEY (bank_account_id) REFERENCES public.chart_of_accounts(id);


--
-- Name: payment_vouchers payment_vouchers_party_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: erp_user
--

ALTER TABLE ONLY public.payment_vouchers
    ADD CONSTRAINT payment_vouchers_party_id_fkey FOREIGN KEY (party_id) REFERENCES public.parties(id);


--
-- Name: payment_vouchers payment_vouchers_voucher_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: erp_user
--

ALTER TABLE ONLY public.payment_vouchers
    ADD CONSTRAINT payment_vouchers_voucher_id_fkey FOREIGN KEY (voucher_id) REFERENCES public.journal_vouchers(id);


--
-- Name: pcd_activity_log pcd_activity_log_partner_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.pcd_activity_log
    ADD CONSTRAINT pcd_activity_log_partner_id_fkey FOREIGN KEY (partner_id) REFERENCES public.pcd_partners(id) ON DELETE SET NULL;


--
-- Name: pcd_commissions pcd_commissions_partner_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.pcd_commissions
    ADD CONSTRAINT pcd_commissions_partner_id_fkey FOREIGN KEY (partner_id) REFERENCES public.pcd_partners(id) ON DELETE CASCADE;


--
-- Name: pcd_mr_assignments pcd_mr_assignments_partner_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.pcd_mr_assignments
    ADD CONSTRAINT pcd_mr_assignments_partner_id_fkey FOREIGN KEY (partner_id) REFERENCES public.pcd_partners(id) ON DELETE CASCADE;


--
-- Name: pcd_partner_documents pcd_partner_documents_partner_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.pcd_partner_documents
    ADD CONSTRAINT pcd_partner_documents_partner_id_fkey FOREIGN KEY (partner_id) REFERENCES public.pcd_partners(id) ON DELETE CASCADE;


--
-- Name: pcd_receivables pcd_receivables_partner_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.pcd_receivables
    ADD CONSTRAINT pcd_receivables_partner_id_fkey FOREIGN KEY (partner_id) REFERENCES public.pcd_partners(id) ON DELETE CASCADE;


--
-- Name: pcd_targets pcd_targets_partner_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.pcd_targets
    ADD CONSTRAINT pcd_targets_partner_id_fkey FOREIGN KEY (partner_id) REFERENCES public.pcd_partners(id) ON DELETE CASCADE;


--
-- Name: pcd_transactions pcd_transactions_partner_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.pcd_transactions
    ADD CONSTRAINT pcd_transactions_partner_id_fkey FOREIGN KEY (partner_id) REFERENCES public.pcd_partners(id) ON DELETE CASCADE;


--
-- Name: pcd_transactions pcd_transactions_scheme_applied_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.pcd_transactions
    ADD CONSTRAINT pcd_transactions_scheme_applied_id_fkey FOREIGN KEY (scheme_applied_id) REFERENCES public.pcd_schemes(id);


--
-- Name: pdc_cheques pdc_cheques_bank_account_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.pdc_cheques
    ADD CONSTRAINT pdc_cheques_bank_account_id_fkey FOREIGN KEY (bank_account_id) REFERENCES public.chart_of_accounts(id);


--
-- Name: pdc_cheques pdc_cheques_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.pdc_cheques
    ADD CONSTRAINT pdc_cheques_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id);


--
-- Name: pdc_cheques pdc_cheques_journal_voucher_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.pdc_cheques
    ADD CONSTRAINT pdc_cheques_journal_voucher_id_fkey FOREIGN KEY (journal_voucher_id) REFERENCES public.journal_vouchers(id);


--
-- Name: pdc_cheques pdc_cheques_party_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.pdc_cheques
    ADD CONSTRAINT pdc_cheques_party_id_fkey FOREIGN KEY (party_id) REFERENCES public.parties(id);


--
-- Name: pdc_register pdc_register_party_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: erp_user
--

ALTER TABLE ONLY public.pdc_register
    ADD CONSTRAINT pdc_register_party_id_fkey FOREIGN KEY (party_id) REFERENCES public.parties(id);


--
-- Name: pdc_register pdc_register_payment_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: erp_user
--

ALTER TABLE ONLY public.pdc_register
    ADD CONSTRAINT pdc_register_payment_id_fkey FOREIGN KEY (payment_id) REFERENCES public.payment_vouchers(id);


--
-- Name: pdc_register pdc_register_receipt_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: erp_user
--

ALTER TABLE ONLY public.pdc_register
    ADD CONSTRAINT pdc_register_receipt_id_fkey FOREIGN KEY (receipt_id) REFERENCES public.receipt_vouchers(id);


--
-- Name: pos_bill_items pos_bill_items_batch_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: erp_user
--

ALTER TABLE ONLY public.pos_bill_items
    ADD CONSTRAINT pos_bill_items_batch_id_fkey FOREIGN KEY (batch_id) REFERENCES public.batches(id);


--
-- Name: pos_bill_items pos_bill_items_bill_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: erp_user
--

ALTER TABLE ONLY public.pos_bill_items
    ADD CONSTRAINT pos_bill_items_bill_id_fkey FOREIGN KEY (bill_id) REFERENCES public.pos_bills(id) ON DELETE CASCADE;


--
-- Name: pos_bill_items pos_bill_items_product_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: erp_user
--

ALTER TABLE ONLY public.pos_bill_items
    ADD CONSTRAINT pos_bill_items_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products(id);


--
-- Name: pos_bills pos_bills_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: erp_user
--

ALTER TABLE ONLY public.pos_bills
    ADD CONSTRAINT pos_bills_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id);


--
-- Name: pos_bills pos_bills_party_fkey2; Type: FK CONSTRAINT; Schema: public; Owner: erp_user
--

ALTER TABLE ONLY public.pos_bills
    ADD CONSTRAINT pos_bills_party_fkey2 FOREIGN KEY (party_id) REFERENCES public.parties(id);


--
-- Name: pos_bills pos_bills_party_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: erp_user
--

ALTER TABLE ONLY public.pos_bills
    ADD CONSTRAINT pos_bills_party_id_fkey FOREIGN KEY (party_id) REFERENCES public.parties(id);


--
-- Name: pos_bills pos_bills_session_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: erp_user
--

ALTER TABLE ONLY public.pos_bills
    ADD CONSTRAINT pos_bills_session_id_fkey FOREIGN KEY (session_id) REFERENCES public.pos_sessions(id);


--
-- Name: pos_bills pos_bills_voucher_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: erp_user
--

ALTER TABLE ONLY public.pos_bills
    ADD CONSTRAINT pos_bills_voucher_id_fkey FOREIGN KEY (voucher_id) REFERENCES public.journal_vouchers(id);


--
-- Name: pos_payments pos_payments_bill_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: erp_user
--

ALTER TABLE ONLY public.pos_payments
    ADD CONSTRAINT pos_payments_bill_id_fkey FOREIGN KEY (bill_id) REFERENCES public.pos_bills(id) ON DELETE CASCADE;


--
-- Name: pos_sessions pos_sessions_opened_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: erp_user
--

ALTER TABLE ONLY public.pos_sessions
    ADD CONSTRAINT pos_sessions_opened_by_fkey FOREIGN KEY (opened_by) REFERENCES public.users(id);


--
-- Name: production_orders production_orders_bom_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.production_orders
    ADD CONSTRAINT production_orders_bom_id_fkey FOREIGN KEY (bom_id) REFERENCES public.boms(id);


--
-- Name: production_orders production_orders_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.production_orders
    ADD CONSTRAINT production_orders_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id);


--
-- Name: production_orders production_orders_product_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.production_orders
    ADD CONSTRAINT production_orders_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products(id);


--
-- Name: purchase_invoice_items purchase_invoice_items_invoice_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: erp_user
--

ALTER TABLE ONLY public.purchase_invoice_items
    ADD CONSTRAINT purchase_invoice_items_invoice_id_fkey FOREIGN KEY (invoice_id) REFERENCES public.purchase_invoices(id) ON DELETE CASCADE;


--
-- Name: purchase_invoices purchase_invoices_party_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: erp_user
--

ALTER TABLE ONLY public.purchase_invoices
    ADD CONSTRAINT purchase_invoices_party_id_fkey FOREIGN KEY (party_id) REFERENCES public.parties(id);


--
-- Name: purchase_invoices purchase_invoices_voucher_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: erp_user
--

ALTER TABLE ONLY public.purchase_invoices
    ADD CONSTRAINT purchase_invoices_voucher_id_fkey FOREIGN KEY (voucher_id) REFERENCES public.journal_vouchers(id);


--
-- Name: purchase_items purchase_items_product_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.purchase_items
    ADD CONSTRAINT purchase_items_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products(id);


--
-- Name: purchase_items purchase_items_purchase_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.purchase_items
    ADD CONSTRAINT purchase_items_purchase_id_fkey FOREIGN KEY (purchase_id) REFERENCES public.purchases(id) ON DELETE CASCADE;


--
-- Name: purchase_order_items purchase_order_items_po_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.purchase_order_items
    ADD CONSTRAINT purchase_order_items_po_id_fkey FOREIGN KEY (po_id) REFERENCES public.purchase_orders(id) ON DELETE CASCADE;


--
-- Name: purchase_order_items purchase_order_items_product_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.purchase_order_items
    ADD CONSTRAINT purchase_order_items_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products(id);


--
-- Name: purchase_orders purchase_orders_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.purchase_orders
    ADD CONSTRAINT purchase_orders_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id);


--
-- Name: purchase_orders purchase_orders_supplier_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.purchase_orders
    ADD CONSTRAINT purchase_orders_supplier_id_fkey FOREIGN KEY (supplier_id) REFERENCES public.parties(id);


--
-- Name: purchases purchases_supplier_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.purchases
    ADD CONSTRAINT purchases_supplier_id_fkey FOREIGN KEY (supplier_id) REFERENCES public.parties(id);


--
-- Name: qc_parameters qc_parameters_record_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.qc_parameters
    ADD CONSTRAINT qc_parameters_record_id_fkey FOREIGN KEY (record_id) REFERENCES public.qc_records(id) ON DELETE CASCADE;


--
-- Name: qc_records qc_records_batch_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.qc_records
    ADD CONSTRAINT qc_records_batch_id_fkey FOREIGN KEY (batch_id) REFERENCES public.batches(id) ON DELETE SET NULL;


--
-- Name: qc_records qc_records_tested_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.qc_records
    ADD CONSTRAINT qc_records_tested_by_fkey FOREIGN KEY (tested_by) REFERENCES public.users(id);


--
-- Name: qc_reports qc_reports_production_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.qc_reports
    ADD CONSTRAINT qc_reports_production_order_id_fkey FOREIGN KEY (production_order_id) REFERENCES public.production_orders(id);


--
-- Name: qc_test_results qc_test_results_qc_report_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.qc_test_results
    ADD CONSTRAINT qc_test_results_qc_report_id_fkey FOREIGN KEY (qc_report_id) REFERENCES public.qc_reports(id) ON DELETE CASCADE;


--
-- Name: receipt_allocations receipt_allocations_invoice_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: erp_user
--

ALTER TABLE ONLY public.receipt_allocations
    ADD CONSTRAINT receipt_allocations_invoice_id_fkey FOREIGN KEY (invoice_id) REFERENCES public.sales_invoices(id);


--
-- Name: receipt_allocations receipt_allocations_receipt_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: erp_user
--

ALTER TABLE ONLY public.receipt_allocations
    ADD CONSTRAINT receipt_allocations_receipt_id_fkey FOREIGN KEY (receipt_id) REFERENCES public.receipt_vouchers(id) ON DELETE CASCADE;


--
-- Name: receipt_vouchers receipt_vouchers_bank_account_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: erp_user
--

ALTER TABLE ONLY public.receipt_vouchers
    ADD CONSTRAINT receipt_vouchers_bank_account_id_fkey FOREIGN KEY (bank_account_id) REFERENCES public.chart_of_accounts(id);


--
-- Name: receipt_vouchers receipt_vouchers_party_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: erp_user
--

ALTER TABLE ONLY public.receipt_vouchers
    ADD CONSTRAINT receipt_vouchers_party_id_fkey FOREIGN KEY (party_id) REFERENCES public.parties(id);


--
-- Name: receipt_vouchers receipt_vouchers_voucher_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: erp_user
--

ALTER TABLE ONLY public.receipt_vouchers
    ADD CONSTRAINT receipt_vouchers_voucher_id_fkey FOREIGN KEY (voucher_id) REFERENCES public.journal_vouchers(id);


--
-- Name: recurring_entries recurring_entries_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.recurring_entries
    ADD CONSTRAINT recurring_entries_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id);


--
-- Name: recurring_entries recurring_entries_credit_account_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.recurring_entries
    ADD CONSTRAINT recurring_entries_credit_account_id_fkey FOREIGN KEY (credit_account_id) REFERENCES public.chart_of_accounts(id);


--
-- Name: recurring_entries recurring_entries_debit_account_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.recurring_entries
    ADD CONSTRAINT recurring_entries_debit_account_id_fkey FOREIGN KEY (debit_account_id) REFERENCES public.chart_of_accounts(id);


--
-- Name: refresh_tokens refresh_tokens_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.refresh_tokens
    ADD CONSTRAINT refresh_tokens_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: reserved_stock reserved_stock_batch_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.reserved_stock
    ADD CONSTRAINT reserved_stock_batch_id_fkey FOREIGN KEY (batch_id) REFERENCES public.batches(id) ON DELETE CASCADE;


--
-- Name: return_note_items return_note_items_batch_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.return_note_items
    ADD CONSTRAINT return_note_items_batch_id_fkey FOREIGN KEY (batch_id) REFERENCES public.batches(id) ON DELETE CASCADE;


--
-- Name: return_note_items return_note_items_product_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.return_note_items
    ADD CONSTRAINT return_note_items_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products(id) ON DELETE CASCADE;


--
-- Name: return_note_items return_note_items_return_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.return_note_items
    ADD CONSTRAINT return_note_items_return_id_fkey FOREIGN KEY (return_id) REFERENCES public.return_notes(id) ON DELETE CASCADE;


--
-- Name: return_notes return_notes_approved_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.return_notes
    ADD CONSTRAINT return_notes_approved_by_fkey FOREIGN KEY (approved_by) REFERENCES public.users(id);


--
-- Name: return_notes return_notes_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.return_notes
    ADD CONSTRAINT return_notes_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id);


--
-- Name: return_notes return_notes_party_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.return_notes
    ADD CONSTRAINT return_notes_party_id_fkey FOREIGN KEY (party_id) REFERENCES public.parties(id) ON DELETE SET NULL;


--
-- Name: return_notes return_notes_received_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.return_notes
    ADD CONSTRAINT return_notes_received_by_fkey FOREIGN KEY (received_by) REFERENCES public.users(id);


--
-- Name: rnd_experiments rnd_experiments_formulation_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.rnd_experiments
    ADD CONSTRAINT rnd_experiments_formulation_id_fkey FOREIGN KEY (formulation_id) REFERENCES public.rnd_formulations(id) ON DELETE CASCADE;


--
-- Name: rnd_formulations rnd_formulations_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.rnd_formulations
    ADD CONSTRAINT rnd_formulations_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id);


--
-- Name: sales_invoice_items sales_invoice_items_batch_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.sales_invoice_items
    ADD CONSTRAINT sales_invoice_items_batch_id_fkey FOREIGN KEY (batch_id) REFERENCES public.batches(id);


--
-- Name: sales_invoice_items sales_invoice_items_invoice_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.sales_invoice_items
    ADD CONSTRAINT sales_invoice_items_invoice_id_fkey FOREIGN KEY (invoice_id) REFERENCES public.sales_invoices(id) ON DELETE CASCADE;


--
-- Name: sales_invoice_items sales_invoice_items_product_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.sales_invoice_items
    ADD CONSTRAINT sales_invoice_items_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products(id);


--
-- Name: sales_invoice_items sales_invoice_items_sales_invoice_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.sales_invoice_items
    ADD CONSTRAINT sales_invoice_items_sales_invoice_id_fkey FOREIGN KEY (sales_invoice_id) REFERENCES public.sales_invoices(id) ON DELETE CASCADE;


--
-- Name: sales_invoices sales_invoices_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.sales_invoices
    ADD CONSTRAINT sales_invoices_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id);


--
-- Name: sales_invoices sales_invoices_party_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.sales_invoices
    ADD CONSTRAINT sales_invoices_party_id_fkey FOREIGN KEY (party_id) REFERENCES public.parties(id);


--
-- Name: sales_invoices sales_invoices_updated_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.sales_invoices
    ADD CONSTRAINT sales_invoices_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES public.users(id);


--
-- Name: sales_invoices sales_invoices_voucher_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.sales_invoices
    ADD CONSTRAINT sales_invoices_voucher_id_fkey FOREIGN KEY (voucher_id) REFERENCES public.journal_vouchers(id);


--
-- Name: stock_ledger_detailed stock_ledger_detailed_batch_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: erp_user
--

ALTER TABLE ONLY public.stock_ledger_detailed
    ADD CONSTRAINT stock_ledger_detailed_batch_id_fkey FOREIGN KEY (batch_id) REFERENCES public.batches(id);


--
-- Name: stock_ledger_detailed stock_ledger_detailed_product_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: erp_user
--

ALTER TABLE ONLY public.stock_ledger_detailed
    ADD CONSTRAINT stock_ledger_detailed_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products(id);


--
-- Name: stock_ledger_entries stock_ledger_entries_batch_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.stock_ledger_entries
    ADD CONSTRAINT stock_ledger_entries_batch_id_fkey FOREIGN KEY (batch_id) REFERENCES public.batches(id);


--
-- Name: stock_ledger_entries stock_ledger_entries_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.stock_ledger_entries
    ADD CONSTRAINT stock_ledger_entries_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id);


--
-- Name: stock_ledger_entries stock_ledger_entries_product_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.stock_ledger_entries
    ADD CONSTRAINT stock_ledger_entries_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products(id);


--
-- Name: stock_reconciliation stock_reconciliation_approved_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.stock_reconciliation
    ADD CONSTRAINT stock_reconciliation_approved_by_fkey FOREIGN KEY (approved_by) REFERENCES public.users(id);


--
-- Name: stock_reconciliation stock_reconciliation_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.stock_reconciliation
    ADD CONSTRAINT stock_reconciliation_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id);


--
-- Name: stock_reconciliation stock_reconciliation_godown_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.stock_reconciliation
    ADD CONSTRAINT stock_reconciliation_godown_id_fkey FOREIGN KEY (godown_id) REFERENCES public.godowns(id) ON DELETE CASCADE;


--
-- Name: stock_reconciliation_items stock_reconciliation_items_batch_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.stock_reconciliation_items
    ADD CONSTRAINT stock_reconciliation_items_batch_id_fkey FOREIGN KEY (batch_id) REFERENCES public.batches(id) ON DELETE CASCADE;


--
-- Name: stock_reconciliation_items stock_reconciliation_items_product_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.stock_reconciliation_items
    ADD CONSTRAINT stock_reconciliation_items_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products(id) ON DELETE CASCADE;


--
-- Name: stock_reconciliation_items stock_reconciliation_items_reconciliation_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.stock_reconciliation_items
    ADD CONSTRAINT stock_reconciliation_items_reconciliation_id_fkey FOREIGN KEY (reconciliation_id) REFERENCES public.stock_reconciliation(id) ON DELETE CASCADE;


--
-- Name: stock_reconciliation stock_reconciliation_verified_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.stock_reconciliation
    ADD CONSTRAINT stock_reconciliation_verified_by_fkey FOREIGN KEY (verified_by) REFERENCES public.users(id);


--
-- Name: supplier_invoices supplier_invoices_supplier_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.supplier_invoices
    ADD CONSTRAINT supplier_invoices_supplier_id_fkey FOREIGN KEY (supplier_id) REFERENCES public.suppliers(id);


--
-- Name: tax_configurations tax_configurations_account_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.tax_configurations
    ADD CONSTRAINT tax_configurations_account_id_fkey FOREIGN KEY (account_id) REFERENCES public.chart_of_accounts(id);


--
-- Name: tds_entries tds_entries_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.tds_entries
    ADD CONSTRAINT tds_entries_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id);


--
-- Name: temperature_logs temperature_logs_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.temperature_logs
    ADD CONSTRAINT temperature_logs_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: three_way_matches three_way_matches_grn_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.three_way_matches
    ADD CONSTRAINT three_way_matches_grn_id_fkey FOREIGN KEY (grn_id) REFERENCES public.goods_received_notes(id);


--
-- Name: three_way_matches three_way_matches_invoice_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.three_way_matches
    ADD CONSTRAINT three_way_matches_invoice_id_fkey FOREIGN KEY (invoice_id) REFERENCES public.supplier_invoices(id);


--
-- Name: three_way_matches three_way_matches_purchase_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.three_way_matches
    ADD CONSTRAINT three_way_matches_purchase_order_id_fkey FOREIGN KEY (purchase_order_id) REFERENCES public.purchase_orders(id);


--
-- Name: three_way_matches three_way_matches_verified_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.three_way_matches
    ADD CONSTRAINT three_way_matches_verified_by_fkey FOREIGN KEY (verified_by) REFERENCES public.users(id);


--
-- Name: vendor_ratings vendor_ratings_supplier_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.vendor_ratings
    ADD CONSTRAINT vendor_ratings_supplier_id_fkey FOREIGN KEY (supplier_id) REFERENCES public.suppliers(id);


--
-- Name: SCHEMA public; Type: ACL; Schema: -; Owner: pg_database_owner
--

GRANT ALL ON SCHEMA public TO erp_user;


--
-- Name: TABLE abc_analysis; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.abc_analysis TO erp_user;


--
-- Name: TABLE abc_classification; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.abc_classification TO erp_user;


--
-- Name: TABLE acc_anomalies; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.acc_anomalies TO erp_user;


--
-- Name: TABLE acc_bank_statement_lines; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.acc_bank_statement_lines TO erp_user;


--
-- Name: TABLE acc_bank_statements; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.acc_bank_statements TO erp_user;


--
-- Name: TABLE acc_cash_flow_forecast; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.acc_cash_flow_forecast TO erp_user;


--
-- Name: TABLE acc_close_checklist; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.acc_close_checklist TO erp_user;


--
-- Name: TABLE acc_dunning_log; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.acc_dunning_log TO erp_user;


--
-- Name: TABLE acc_dunning_rules; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.acc_dunning_rules TO erp_user;


--
-- Name: TABLE acc_fx_revaluation_log; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.acc_fx_revaluation_log TO erp_user;


--
-- Name: TABLE acc_payment_run_items; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.acc_payment_run_items TO erp_user;


--
-- Name: TABLE acc_payment_runs; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.acc_payment_runs TO erp_user;


--
-- Name: TABLE acc_periods; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.acc_periods TO erp_user;


--
-- Name: TABLE acc_ratios_cache; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.acc_ratios_cache TO erp_user;


--
-- Name: TABLE acc_tally_sync_log; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.acc_tally_sync_log TO erp_user;


--
-- Name: TABLE api_keys; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.api_keys TO erp_user;


--
-- Name: TABLE approval_workflows; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.approval_workflows TO erp_user;


--
-- Name: TABLE asset_alerts; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.asset_alerts TO erp_user;


--
-- Name: TABLE asset_categories; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.asset_categories TO erp_user;


--
-- Name: TABLE asset_insurance_policies; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.asset_insurance_policies TO erp_user;


--
-- Name: TABLE asset_maintenance_logs; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.asset_maintenance_logs TO erp_user;


--
-- Name: TABLE asset_transfers; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.asset_transfers TO erp_user;


--
-- Name: TABLE audit_log_accounting; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.audit_log_accounting TO erp_user;


--
-- Name: TABLE audit_logs; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.audit_logs TO erp_user;


--
-- Name: TABLE bank_reconciliation; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.bank_reconciliation TO erp_user;


--
-- Name: TABLE bank_reconciliations; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.bank_reconciliations TO erp_user;


--
-- Name: TABLE batches; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.batches TO erp_user;


--
-- Name: TABLE boms; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.boms TO erp_user;


--
-- Name: TABLE branches; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.branches TO erp_user;


--
-- Name: TABLE budgets; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.budgets TO erp_user;


--
-- Name: TABLE chart_of_accounts; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.chart_of_accounts TO erp_user;


--
-- Name: TABLE company_document_history; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.company_document_history TO erp_user;


--
-- Name: TABLE company_documents; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.company_documents TO erp_user;


--
-- Name: TABLE compliance_audits; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.compliance_audits TO erp_user;


--
-- Name: TABLE compliance_checklist_items; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.compliance_checklist_items TO erp_user;


--
-- Name: TABLE compliance_checklist_templates; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.compliance_checklist_templates TO erp_user;


--
-- Name: TABLE compliance_checklists; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.compliance_checklists TO erp_user;


--
-- Name: TABLE compliance_notification_log; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.compliance_notification_log TO erp_user;


--
-- Name: SEQUENCE compliance_notification_log_id_seq; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON SEQUENCE public.compliance_notification_log_id_seq TO erp_user;


--
-- Name: TABLE compliance_notification_settings; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.compliance_notification_settings TO erp_user;


--
-- Name: SEQUENCE compliance_notification_settings_id_seq; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON SEQUENCE public.compliance_notification_settings_id_seq TO erp_user;


--
-- Name: TABLE cost_centers; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.cost_centers TO erp_user;


--
-- Name: TABLE dead_stock_analysis; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.dead_stock_analysis TO erp_user;


--
-- Name: TABLE dispatches; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.dispatches TO erp_user;


--
-- Name: TABLE dms_audit_trail; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.dms_audit_trail TO erp_user;


--
-- Name: SEQUENCE dms_audit_trail_id_seq; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON SEQUENCE public.dms_audit_trail_id_seq TO erp_user;


--
-- Name: TABLE dms_documents; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.dms_documents TO erp_user;


--
-- Name: TABLE dms_folders; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.dms_folders TO erp_user;


--
-- Name: TABLE dms_versions; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.dms_versions TO erp_user;


--
-- Name: SEQUENCE dms_versions_id_seq; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON SEQUENCE public.dms_versions_id_seq TO erp_user;


--
-- Name: TABLE dms_workflows; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.dms_workflows TO erp_user;


--
-- Name: SEQUENCE dms_workflows_id_seq; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON SEQUENCE public.dms_workflows_id_seq TO erp_user;


--
-- Name: TABLE document_categories; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.document_categories TO erp_user;


--
-- Name: TABLE drug_licenses; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.drug_licenses TO erp_user;


--
-- Name: TABLE e_invoices; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.e_invoices TO erp_user;


--
-- Name: TABLE employees; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.employees TO erp_user;


--
-- Name: TABLE expenses; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.expenses TO erp_user;


--
-- Name: TABLE financial_audit_log; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.financial_audit_log TO erp_user;


--
-- Name: TABLE financial_years; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.financial_years TO erp_user;


--
-- Name: TABLE fixed_assets; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.fixed_assets TO erp_user;


--
-- Name: TABLE forecast_demand; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.forecast_demand TO erp_user;


--
-- Name: TABLE forex_rates; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.forex_rates TO erp_user;


--
-- Name: TABLE general_ledger; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.general_ledger TO erp_user;


--
-- Name: TABLE godowns; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.godowns TO erp_user;


--
-- Name: TABLE goods_received_notes; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.goods_received_notes TO erp_user;


--
-- Name: TABLE grn_items; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.grn_items TO erp_user;


--
-- Name: TABLE h1_register; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.h1_register TO erp_user;


--
-- Name: TABLE inventory_turnover_analysis; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.inventory_turnover_analysis TO erp_user;


--
-- Name: TABLE journal_voucher_entries; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.journal_voucher_entries TO erp_user;


--
-- Name: TABLE journal_vouchers; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.journal_vouchers TO erp_user;


--
-- Name: TABLE kpi_dashboard_data; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.kpi_dashboard_data TO erp_user;


--
-- Name: TABLE lead_activities; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.lead_activities TO erp_user;


--
-- Name: TABLE lead_interactions; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.lead_interactions TO erp_user;


--
-- Name: TABLE leads; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.leads TO erp_user;


--
-- Name: TABLE medical_representatives; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.medical_representatives TO erp_user;


--
-- Name: TABLE mv_accounts_dashboard; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.mv_accounts_dashboard TO erp_user;


--
-- Name: TABLE order_items; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.order_items TO erp_user;


--
-- Name: TABLE orders; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.orders TO erp_user;


--
-- Name: TABLE p2; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.p2 TO erp_user;


--
-- Name: TABLE p3; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.p3 TO erp_user;


--
-- Name: TABLE p4; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.p4 TO erp_user;


--
-- Name: TABLE parties; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.parties TO erp_user;


--
-- Name: TABLE password_history; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.password_history TO erp_user;


--
-- Name: TABLE pcd_activity_log; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.pcd_activity_log TO erp_user;


--
-- Name: TABLE pcd_broadcast_messages; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.pcd_broadcast_messages TO erp_user;


--
-- Name: TABLE pcd_commissions; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.pcd_commissions TO erp_user;


--
-- Name: TABLE pcd_mr_assignments; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.pcd_mr_assignments TO erp_user;


--
-- Name: TABLE pcd_partner_documents; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.pcd_partner_documents TO erp_user;


--
-- Name: TABLE pcd_partners; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.pcd_partners TO erp_user;


--
-- Name: TABLE pcd_receivables; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.pcd_receivables TO erp_user;


--
-- Name: TABLE pcd_schemes; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.pcd_schemes TO erp_user;


--
-- Name: TABLE pcd_targets; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.pcd_targets TO erp_user;


--
-- Name: TABLE pcd_transactions; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.pcd_transactions TO erp_user;


--
-- Name: TABLE pdc_cheques; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.pdc_cheques TO erp_user;


--
-- Name: TABLE production_orders; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.production_orders TO erp_user;


--
-- Name: TABLE products; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.products TO erp_user;


--
-- Name: TABLE purchase_budgets; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.purchase_budgets TO erp_user;


--
-- Name: TABLE purchase_items; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.purchase_items TO erp_user;


--
-- Name: TABLE purchase_order_items; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.purchase_order_items TO erp_user;


--
-- Name: TABLE purchase_orders; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.purchase_orders TO erp_user;


--
-- Name: TABLE purchases; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.purchases TO erp_user;


--
-- Name: TABLE qc_parameters; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.qc_parameters TO erp_user;


--
-- Name: TABLE qc_records; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.qc_records TO erp_user;


--
-- Name: TABLE qc_reports; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.qc_reports TO erp_user;


--
-- Name: TABLE qc_test_results; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.qc_test_results TO erp_user;


--
-- Name: SEQUENCE reconciliation_seq; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON SEQUENCE public.reconciliation_seq TO erp_user;


--
-- Name: TABLE recurring_entries; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.recurring_entries TO erp_user;


--
-- Name: TABLE refresh_tokens; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.refresh_tokens TO erp_user;


--
-- Name: TABLE reserved_stock; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.reserved_stock TO erp_user;


--
-- Name: TABLE return_note_items; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.return_note_items TO erp_user;


--
-- Name: TABLE return_notes; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.return_notes TO erp_user;


--
-- Name: TABLE rnd_experiments; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.rnd_experiments TO erp_user;


--
-- Name: TABLE rnd_formulations; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.rnd_formulations TO erp_user;


--
-- Name: TABLE sales_invoice_items; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.sales_invoice_items TO erp_user;


--
-- Name: TABLE sales_invoices; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.sales_invoices TO erp_user;


--
-- Name: TABLE stock_ledger_entries; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.stock_ledger_entries TO erp_user;


--
-- Name: TABLE stock_movement_reasons; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.stock_movement_reasons TO erp_user;


--
-- Name: TABLE stock_reconciliation; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.stock_reconciliation TO erp_user;


--
-- Name: TABLE stock_reconciliation_items; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.stock_reconciliation_items TO erp_user;


--
-- Name: TABLE supplier_invoices; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.supplier_invoices TO erp_user;


--
-- Name: TABLE suppliers; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.suppliers TO erp_user;


--
-- Name: TABLE tax_configurations; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.tax_configurations TO erp_user;


--
-- Name: TABLE tds_entries; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.tds_entries TO erp_user;


--
-- Name: TABLE temperature_logs; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.temperature_logs TO erp_user;


--
-- Name: TABLE three_way_matches; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.three_way_matches TO erp_user;


--
-- Name: TABLE users; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.users TO erp_user;


--
-- Name: TABLE vendor_ratings; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.vendor_ratings TO erp_user;


--
-- Name: TABLE voucher_types; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.voucher_types TO erp_user;


--
-- Name: TABLE vw_profit_loss; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.vw_profit_loss TO erp_user;


--
-- Name: TABLE vw_trial_balance; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.vw_trial_balance TO erp_user;


--
-- Name: DEFAULT PRIVILEGES FOR SEQUENCES; Type: DEFAULT ACL; Schema: public; Owner: postgres
--

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON SEQUENCES TO erp_user;


--
-- Name: DEFAULT PRIVILEGES FOR TABLES; Type: DEFAULT ACL; Schema: public; Owner: postgres
--

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON TABLES TO erp_user;


--
-- Name: mv_accounts_dashboard; Type: MATERIALIZED VIEW DATA; Schema: public; Owner: postgres
--

REFRESH MATERIALIZED VIEW public.mv_accounts_dashboard;


--
-- PostgreSQL database dump complete
--

\unrestrict ZiUFcoa7Dw3ay4dCYKdnUHduBQ7a3wg5FvzP2fjvlOHBKiGanJEBSF8guLQthTN


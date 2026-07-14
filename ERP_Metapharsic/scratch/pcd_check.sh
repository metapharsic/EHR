#!/bin/bash
export PGPASSWORD=erp_secure_2026
DB_CMD="psql -h localhost -U erp_user -d metapharsic_erp"

echo "=== PCD Tables ==="
$DB_CMD -c "SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND (tablename LIKE 'pcd_%' OR tablename = 'medical_representatives') ORDER BY tablename;"

echo ""
echo "=== Row Counts ==="
for table in pcd_partners medical_representatives pcd_commissions pcd_receivables pcd_schemes pcd_targets pcd_transactions; do
    echo -n "$table: "
    $DB_CMD -t -c "SELECT COUNT(*) FROM $table;" 2>/dev/null || echo "Table does not exist"
done

echo ""
echo "=== PCD Partners ==="
$DB_CMD -c "SELECT id, name, territory, contact_number, status, latitude, longitude FROM pcd_partners LIMIT 5;"

echo ""
echo "=== Medical Representatives (MRs) ==="
$DB_CMD -c "SELECT id, name, contact, headquarters, assigned_area, status FROM medical_representatives LIMIT 5;"

echo ""
echo "=== PCD Schemes ==="
$DB_CMD -c "SELECT id, name, scheme_code, scheme_type, validity_end, discount_percentage FROM pcd_schemes LIMIT 5;"

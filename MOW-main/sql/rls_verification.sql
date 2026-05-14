-- Phase 1 Trust Foundation: RLS verification helper
-- Run this in Supabase SQL editor to inspect RLS posture.
-- This does not change data.

select
  n.nspname as schema_name,
  c.relname as table_name,
  c.relrowsecurity as rls_enabled,
  c.relforcerowsecurity as rls_forced
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public'
  and c.relkind in ('r', 'v')
  and c.relname like 'field_ops_%'
order by c.relname;

select
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
from pg_policies
where schemaname = 'public'
  and tablename like 'field_ops_%'
order by tablename, policyname;

select
  table_name,
  column_name,
  data_type,
  is_nullable
from information_schema.columns
where table_schema = 'public'
  and table_name in (
    'field_ops_buildings',
    'field_ops_spaces',
    'field_ops_assets',
    'field_ops_projects',
    'field_ops_vendors',
    'field_ops_vehicles',
    'field_ops_fuel_receipts',
    'field_ops_work_orders',
    'field_ops_budget_items',
    'field_ops_documents',
    'field_ops_import_reviews'
  )
  and column_name in (
    'id',
    'workspace_id',
    'created_at',
    'updated_at',
    'archived_at',
    'archived_by',
    'created_by',
    'submitted_by',
    'reviewed_by'
  )
order by table_name, column_name;

-- Expected result:
-- 1. RLS should be enabled for every base table.
-- 2. Workspace-owned tables should have workspace_id.
-- 3. Archive-capable tables should have archived_at.
-- 4. Submitter intake tables should track submitter/created identity.
-- 5. Policies should distinguish Owner/Admin operational access from Submitter intake access.

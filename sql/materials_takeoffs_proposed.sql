-- Proposed Materials / Takeoffs foundation schema.
-- Run only after reviewing RLS and table ownership in Supabase.
-- First app pass stages material lists through field_ops_import_reviews
-- and approves into field_ops_budget_items, so this migration is not required
-- for the current UI to keep running.

create table if not exists public.field_ops_materials (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.field_ops_workspaces(id) on delete cascade,
  vendor_id uuid references public.field_ops_vendors(id) on delete set null,
  name text not null,
  category text,
  default_unit text not null default 'each',
  estimated_unit_cost numeric(12,2),
  sku text,
  notes text,
  archived_at timestamptz,
  archived_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.field_ops_takeoffs (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.field_ops_workspaces(id) on delete cascade,
  project_id uuid references public.field_ops_projects(id) on delete set null,
  work_order_id uuid references public.field_ops_work_orders(id) on delete set null,
  vendor_id uuid references public.field_ops_vendors(id) on delete set null,
  document_id uuid references public.field_ops_documents(id) on delete set null,
  title text not null,
  status text not null default 'draft',
  approval_status text not null default 'needs_review',
  estimated_total numeric(12,2) not null default 0,
  actual_total numeric(12,2),
  notes text,
  created_by uuid references auth.users(id),
  approved_by uuid references auth.users(id),
  approved_at timestamptz,
  archived_at timestamptz,
  archived_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.field_ops_material_line_items (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.field_ops_workspaces(id) on delete cascade,
  takeoff_id uuid references public.field_ops_takeoffs(id) on delete cascade,
  material_id uuid references public.field_ops_materials(id) on delete set null,
  project_id uuid references public.field_ops_projects(id) on delete set null,
  work_order_id uuid references public.field_ops_work_orders(id) on delete set null,
  vendor_id uuid references public.field_ops_vendors(id) on delete set null,
  document_id uuid references public.field_ops_documents(id) on delete set null,
  description text not null,
  quantity numeric(12,3) not null default 1,
  unit text not null default 'each',
  estimated_unit_cost numeric(12,2) not null default 0,
  estimated_total numeric(12,2) generated always as (quantity * estimated_unit_cost) stored,
  actual_cost numeric(12,2),
  approval_status text not null default 'needs_review',
  notes text,
  archived_at timestamptz,
  archived_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.field_ops_purchase_requests (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.field_ops_workspaces(id) on delete cascade,
  takeoff_id uuid references public.field_ops_takeoffs(id) on delete set null,
  budget_item_id uuid references public.field_ops_budget_items(id) on delete set null,
  requested_by uuid references auth.users(id),
  approved_by uuid references auth.users(id),
  status text not null default 'submitted',
  estimated_total numeric(12,2) not null default 0,
  actual_total numeric(12,2),
  notes text,
  archived_at timestamptz,
  archived_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.field_ops_takeoffs enable row level security;
alter table public.field_ops_materials enable row level security;
alter table public.field_ops_material_line_items enable row level security;
alter table public.field_ops_purchase_requests enable row level security;

-- RLS policy direction:
-- Owner/Admin: full workspace-scoped CRUD.
-- Submitter/contractor: insert-only into submitted purchase/takeoff intake,
-- and select only records they created. Mirror existing field_ops_import_reviews
-- membership checks before enabling these in production.

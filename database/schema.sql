-- =========================================================
-- AI-Powered Smart Data Entry System — PostgreSQL schema
-- Designed for Supabase. Run this in the Supabase SQL editor,
-- or via `supabase db push` / psql against your project.
-- =========================================================

create extension if not exists "uuid-ossp";

-- ---------------------------------------------------------
-- documents
-- One row per uploaded file, tracking it through the
-- upload -> OCR -> AI extraction -> review -> approval pipeline.
-- ---------------------------------------------------------
create table if not exists documents (
    id              uuid primary key default uuid_generate_v4(),
    file_name       text not null,
    file_type       text not null check (file_type in ('pdf', 'jpg', 'jpeg', 'png')),
    file_url        text,
    document_type   text not null default 'general_document'
                        check (document_type in
                            ('invoice', 'receipt', 'customer_form', 'purchase_order', 'general_document')),
    status          text not null default 'uploaded'
                        check (status in
                            ('uploaded', 'processing', 'processed', 'needs_review', 'approved', 'rejected', 'failed')),
    error_message   text,
    uploaded_by     uuid references auth.users(id),
    created_at      timestamptz not null default now(),
    updated_at      timestamptz not null default now()
);

create index if not exists idx_documents_status on documents(status);
create index if not exists idx_documents_document_type on documents(document_type);
create index if not exists idx_documents_created_at on documents(created_at desc);

-- ---------------------------------------------------------
-- extracted_fields
-- Structured output of the AI extraction layer for a document,
-- editable by the human reviewer before approval.
-- ---------------------------------------------------------
create table if not exists extracted_fields (
    id                  uuid primary key default uuid_generate_v4(),
    document_id         uuid not null references documents(id) on delete cascade,
    field_name          text not null,
    field_value         text,
    confidence_score    numeric(4, 3) not null default 0 check (confidence_score >= 0 and confidence_score <= 1),
    requires_review     boolean not null default false,
    created_at          timestamptz not null default now(),
    updated_at          timestamptz not null default now(),
    unique (document_id, field_name)
);

create index if not exists idx_extracted_fields_document_id on extracted_fields(document_id);
create index if not exists idx_extracted_fields_requires_review on extracted_fields(requires_review);

-- ---------------------------------------------------------
-- processing_logs
-- Audit trail of each pipeline stage for a document — useful for
-- debugging failed OCR/AI runs and for the analytics view.
-- ---------------------------------------------------------
create table if not exists processing_logs (
    id              uuid primary key default uuid_generate_v4(),
    document_id     uuid not null references documents(id) on delete cascade,
    stage           text not null check (stage in ('upload', 'ocr', 'ai_extraction', 'validation')),
    status          text not null check (status in ('success', 'warning', 'failed')),
    message         text,
    created_at      timestamptz not null default now()
);

create index if not exists idx_processing_logs_document_id on processing_logs(document_id);

-- ---------------------------------------------------------
-- document_templates
-- Field schema per document type, editable so new templates can be
-- added without a code deploy. (The backend also ships built-in
-- defaults in routes/templates.py; this table lets them be customized.)
-- ---------------------------------------------------------
create table if not exists document_templates (
    id              text primary key,
    name            text not null,
    description     text,
    icon            text,
    field_schema    jsonb not null default '[]'::jsonb,
    created_at      timestamptz not null default now(),
    updated_at      timestamptz not null default now()
);

-- ---------------------------------------------------------
-- updated_at trigger helper
-- ---------------------------------------------------------
create or replace function set_updated_at()
returns trigger as $$
begin
    new.updated_at = now();
    return new;
end;
$$ language plpgsql;

drop trigger if exists trg_documents_updated_at on documents;
create trigger trg_documents_updated_at
    before update on documents
    for each row execute function set_updated_at();

drop trigger if exists trg_extracted_fields_updated_at on extracted_fields;
create trigger trg_extracted_fields_updated_at
    before update on extracted_fields
    for each row execute function set_updated_at();

-- ---------------------------------------------------------
-- Row Level Security
-- Users (via Supabase Auth) can only see and modify their own
-- documents. The service role key used by the backend bypasses RLS.
-- ---------------------------------------------------------
alter table documents enable row level security;
alter table extracted_fields enable row level security;
alter table processing_logs enable row level security;

create policy "Users can view their own documents"
    on documents for select
    using (auth.uid() = uploaded_by);

create policy "Users can insert their own documents"
    on documents for insert
    with check (auth.uid() = uploaded_by);

create policy "Users can update their own documents"
    on documents for update
    using (auth.uid() = uploaded_by);

create policy "Users can view fields on their own documents"
    on extracted_fields for select
    using (exists (
        select 1 from documents
        where documents.id = extracted_fields.document_id
        and documents.uploaded_by = auth.uid()
    ));

create policy "Users can view logs on their own documents"
    on processing_logs for select
    using (exists (
        select 1 from documents
        where documents.id = processing_logs.document_id
        and documents.uploaded_by = auth.uid()
    ));

-- ---------------------------------------------------------
-- Seed default templates (safe to re-run)
-- ---------------------------------------------------------
insert into document_templates (id, name, description, icon, field_schema) values
    ('invoice', 'Invoice', 'Vendor invoices with line items and totals.', '🧾',
     '[{"name":"invoice_number","type":"text","required":true},
       {"name":"customer_name","type":"text","required":true},
       {"name":"invoice_date","type":"date","required":true},
       {"name":"due_date","type":"date","required":false},
       {"name":"total","type":"currency","required":true},
       {"name":"email","type":"email","required":false}]'::jsonb),
    ('receipt', 'Receipt', 'Point-of-sale receipts from retail purchases.', '🧻',
     '[{"name":"merchant_name","type":"text","required":true},
       {"name":"purchase_date","type":"date","required":true},
       {"name":"total","type":"currency","required":true},
       {"name":"payment_method","type":"text","required":false}]'::jsonb),
    ('customer_form', 'Customer Form', 'Intake forms filled out by customers.', '🗂️',
     '[{"name":"customer_name","type":"text","required":true},
       {"name":"phone","type":"text","required":true},
       {"name":"email","type":"email","required":false},
       {"name":"address","type":"text","required":false}]'::jsonb),
    ('purchase_order', 'Purchase Order', 'Purchase orders issued to suppliers.', '📦',
     '[{"name":"po_number","type":"text","required":true},
       {"name":"supplier_name","type":"text","required":true},
       {"name":"quantity","type":"number","required":true},
       {"name":"unit_price","type":"currency","required":true},
       {"name":"total","type":"currency","required":true}]'::jsonb),
    ('general_document', 'General Document', 'Any document that does not fit a specific template.', '📄',
     '[{"name":"title","type":"text","required":true},
       {"name":"document_date","type":"date","required":false}]'::jsonb)
on conflict (id) do nothing;

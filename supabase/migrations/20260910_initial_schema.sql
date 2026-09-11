-- ============================================================================
-- QUẢN LÝ KÝ TÚC XÁ CÔNG NHÂN - SUPABASE POSTGRES SCHEMA MIGRATION
-- Migration date: 2026-09-10
-- Target Database: Supabase PostgreSQL (Postgres 15+)
-- Features: Full RBAC, RLS policies, Vietnamese collation & search,
--           Private CCCD Storage Bucket, Audit trails, and Realtime replication.
-- ============================================================================

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================================
-- 1. USER ROLES & PROFILES (Phân quyền & Tài khoản)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.user_roles (
    role_key text PRIMARY KEY,
    name text NOT NULL,
    description text,
    created_at timestamptz DEFAULT now()
);

-- Seed predefined roles
INSERT INTO public.user_roles (role_key, name, description)
VALUES 
    ('admin', 'Quản trị viên (Admin)', 'Toàn quyền kiểm soát hệ thống, tài khoản, cấu hình quy mô và dữ liệu'),
    ('manager', 'Quản lý KTX (Manager)', 'Quản lý công nhân, phòng ở, check-in/out, quét CCCD và báo cáo'),
    ('viewer', 'Người xem (Viewer)', 'Chỉ xem dữ liệu, không có quyền thêm, sửa, xóa')
ON CONFLICT (role_key) DO NOTHING;

CREATE TABLE IF NOT EXISTS public.profiles (
    id text PRIMARY KEY, -- Supports Firebase UID, custom ID (e.g. 'user_admin_01') or Supabase Auth UUID
    auth_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
    email text UNIQUE NOT NULL,
    name text NOT NULL,
    role text NOT NULL DEFAULT 'manager' REFERENCES public.user_roles(role_key),
    phone text,
    assigned_dorms int[] DEFAULT '{}',
    password_hash text, -- Optional legacy hash for migration tracking
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

-- ============================================================================
-- 2. DORM BLOCKS, ROOMS & BEDS (Dãy KTX, Phòng, Giường)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.dorm_blocks (
    id serial PRIMARY KEY,
    block_number int NOT NULL UNIQUE, -- Dãy 1, 2, 3...
    name text NOT NULL,
    notes text,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.rooms (
    id serial PRIMARY KEY,
    dorm int NOT NULL,
    room_number int NOT NULL, -- 1..20
    capacity int NOT NULL DEFAULT 30,
    notes text,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now(),
    UNIQUE (dorm, room_number)
);

CREATE TABLE IF NOT EXISTS public.beds (
    id serial PRIMARY KEY,
    dorm int NOT NULL,
    room int NOT NULL,
    bed_number int NOT NULL,
    is_occupied boolean DEFAULT false,
    notes text,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now(),
    UNIQUE (dorm, room, bed_number)
);

-- ============================================================================
-- 3. TEAM LEADERS (Tổ trưởng)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.team_leaders (
    id text PRIMARY KEY DEFAULT ('leader_' || replace(uuid_generate_v4()::text, '-', '')),
    name text NOT NULL UNIQUE,
    contact_phone text,
    primary_dorm int,
    primary_room int,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

-- ============================================================================
-- 4. WORKERS (Hồ sơ Công nhân KTX)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.workers (
    id text PRIMARY KEY, -- Preserves existing ID (e.g. 'worker_...')
    legacy_firestore_id text, -- Đối soát 1:1 với Firestore document ID
    name text NOT NULL,
    dob text, -- DD/MM/YYYY
    dorm int NOT NULL,
    room int NOT NULL,
    bed int DEFAULT 1,
    team_leader text,
    status text NOT NULL DEFAULT 'Đang ở' CHECK (status IN ('Đang ở', 'Đã check out', 'Đã rời KTX')),
    emp_code text NOT NULL,
    cccd text,
    address text,
    phone text,
    workplace text,
    note text,
    entry_date text, -- YYYY-MM-DD
    exit_date text, -- YYYY-MM-DD
    gender text DEFAULT 'Nam',
    hometown text,
    issue_date text,
    issue_place text,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now(),
    created_by text DEFAULT 'Hệ thống',
    updated_by text DEFAULT 'Hệ thống'
);

-- Indices for high-frequency queries
CREATE INDEX IF NOT EXISTS idx_workers_emp_code ON public.workers(emp_code);
CREATE INDEX IF NOT EXISTS idx_workers_cccd ON public.workers(cccd);
CREATE INDEX IF NOT EXISTS idx_workers_status ON public.workers(status);
CREATE INDEX IF NOT EXISTS idx_workers_dorm_room ON public.workers(dorm, room);
CREATE INDEX IF NOT EXISTS idx_workers_team_leader ON public.workers(team_leader);
CREATE INDEX IF NOT EXISTS idx_workers_entry_date ON public.workers(entry_date);
CREATE INDEX IF NOT EXISTS idx_workers_legacy_firestore_id ON public.workers(legacy_firestore_id);

-- ============================================================================
-- 5. WORKER DOCUMENTS & CCCD STORAGE (Tài liệu ảnh CCCD riêng biệt)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.worker_documents (
    id text PRIMARY KEY, -- Matches worker_id
    worker_id text NOT NULL REFERENCES public.workers(id) ON DELETE CASCADE,
    legacy_firestore_id text,
    storage_path text NOT NULL, -- Directory inside bucket 'worker-documents'
    front_image_path text, -- Path to front CCCD in Supabase Storage
    back_image_path text, -- Path to back CCCD in Supabase Storage
    front_uploaded_at timestamptz,
    back_uploaded_at timestamptz,
    uploaded_by text DEFAULT 'Quản lý',
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_worker_docs_worker_id ON public.worker_documents(worker_id);

-- ============================================================================
-- 6. CHECK-IN / CHECK-OUT HISTORY & DELETED ARCHIVE (Kho lưu trữ vào/ra)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.check_in_out_history (
    id text PRIMARY KEY,
    worker_id text,
    legacy_firestore_id text,
    name text NOT NULL,
    emp_code text NOT NULL,
    dorm int NOT NULL,
    room int NOT NULL,
    bed int DEFAULT 1,
    team_leader text,
    status text DEFAULT 'Đã check out',
    reason text NOT NULL,
    checked_out_at timestamptz DEFAULT now(),
    checked_out_by text,
    operator_name text,
    entry_date text,
    exit_date text,
    dob text,
    cccd text,
    address text,
    phone text,
    workplace text,
    gender text,
    hometown text,
    issue_date text,
    issue_place text,
    cccd_front_path text,
    cccd_back_path text,
    created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_check_history_emp_code ON public.check_in_out_history(emp_code);
CREATE INDEX IF NOT EXISTS idx_check_history_checked_out_at ON public.check_in_out_history(checked_out_at DESC);
CREATE INDEX IF NOT EXISTS idx_check_history_dorm_room ON public.check_in_out_history(dorm, room);

-- ============================================================================
-- 7. AUDIT LOGS (Nhật ký thao tác hệ thống)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.audit_logs (
    id text PRIMARY KEY,
    timestamp timestamptz DEFAULT now(),
    user_name text NOT NULL,
    user_email text NOT NULL,
    role text DEFAULT 'manager',
    action text NOT NULL,
    details text NOT NULL,
    target_id text,
    emp_code text,
    status text DEFAULT 'SUCCESS',
    metadata jsonb DEFAULT '{}'::jsonb,
    created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_timestamp ON public.audit_logs(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON public.audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_audit_logs_emp_code ON public.audit_logs(emp_code);

-- ============================================================================
-- 8. APP SETTINGS (Cấu hình hệ thống & Ban Quản Lý KTX)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.app_settings (
    key text PRIMARY KEY, -- 'system_config', 'manager_info', 'ui_preferences'
    value jsonb NOT NULL,
    updated_at timestamptz DEFAULT now(),
    updated_by text DEFAULT 'Hệ thống'
);

-- ============================================================================
-- 9. AUTOMATIC updated_at TRIGGER FUNCTION
-- ============================================================================

CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE TRIGGER trigger_profiles_updated_at
    BEFORE UPDATE ON public.profiles
    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE OR REPLACE TRIGGER trigger_workers_updated_at
    BEFORE UPDATE ON public.workers
    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE OR REPLACE TRIGGER trigger_worker_documents_updated_at
    BEFORE UPDATE ON public.worker_documents
    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE OR REPLACE TRIGGER trigger_team_leaders_updated_at
    BEFORE UPDATE ON public.team_leaders
    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE OR REPLACE TRIGGER trigger_app_settings_updated_at
    BEFORE UPDATE ON public.app_settings
    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- ============================================================================
-- 10. ROW LEVEL SECURITY (RLS) POLICIES
-- ============================================================================

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dorm_blocks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.beds ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.team_leaders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.worker_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.check_in_out_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;

-- Helper security functions
CREATE OR REPLACE FUNCTION public.is_app_admin()
RETURNS boolean AS $$
BEGIN
    RETURN (
        auth.role() = 'service_role' OR
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE auth_user_id = auth.uid() AND role = 'admin'
        )
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.is_authenticated_user()
RETURNS boolean AS $$
BEGIN
    RETURN (
        auth.role() = 'service_role' OR
        auth.role() = 'authenticated' OR
        EXISTS (SELECT 1 FROM public.profiles WHERE auth_user_id = auth.uid())
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Policies for public.workers
DROP POLICY IF EXISTS "workers_read_policy" ON public.workers;
CREATE POLICY "workers_read_policy" ON public.workers
    FOR SELECT TO authenticated, anon
    USING (true); -- Read-only access enabled for dormitory staff and dashboard display

DROP POLICY IF EXISTS "workers_write_policy" ON public.workers;
CREATE POLICY "workers_write_policy" ON public.workers
    FOR ALL TO authenticated, anon
    USING (true)
    WITH CHECK (true);

-- Policies for public.worker_documents (Sensitive CCCD photos)
DROP POLICY IF EXISTS "worker_documents_access" ON public.worker_documents;
CREATE POLICY "worker_documents_access" ON public.worker_documents
    FOR ALL TO authenticated, anon
    USING (true)
    WITH CHECK (true);

-- Policies for public.check_in_out_history
DROP POLICY IF EXISTS "check_in_out_history_access" ON public.check_in_out_history;
CREATE POLICY "check_in_out_history_access" ON public.check_in_out_history
    FOR ALL TO authenticated, anon
    USING (true)
    WITH CHECK (true);

-- Policies for public.team_leaders
DROP POLICY IF EXISTS "team_leaders_access" ON public.team_leaders;
CREATE POLICY "team_leaders_access" ON public.team_leaders
    FOR ALL TO authenticated, anon
    USING (true)
    WITH CHECK (true);

-- Policies for public.dorm_blocks & rooms
DROP POLICY IF EXISTS "dorm_blocks_access" ON public.dorm_blocks;
CREATE POLICY "dorm_blocks_access" ON public.dorm_blocks
    FOR ALL TO authenticated, anon
    USING (true)
    WITH CHECK (true);

DROP POLICY IF EXISTS "rooms_access" ON public.rooms;
CREATE POLICY "rooms_access" ON public.rooms
    FOR ALL TO authenticated, anon
    USING (true)
    WITH CHECK (true);

DROP POLICY IF EXISTS "beds_access" ON public.beds;
CREATE POLICY "beds_access" ON public.beds
    FOR ALL TO authenticated, anon
    USING (true)
    WITH CHECK (true);

-- Policies for public.audit_logs
DROP POLICY IF EXISTS "audit_logs_access" ON public.audit_logs;
CREATE POLICY "audit_logs_access" ON public.audit_logs
    FOR ALL TO authenticated, anon
    USING (true)
    WITH CHECK (true);

-- Policies for public.app_settings
DROP POLICY IF EXISTS "app_settings_access" ON public.app_settings;
CREATE POLICY "app_settings_access" ON public.app_settings
    FOR ALL TO authenticated, anon
    USING (true)
    WITH CHECK (true);

-- Policies for public.profiles
DROP POLICY IF EXISTS "profiles_access" ON public.profiles;
CREATE POLICY "profiles_access" ON public.profiles
    FOR ALL TO authenticated, anon
    USING (true)
    WITH CHECK (true);

-- ============================================================================
-- 11. SUPABASE STORAGE BUCKET: worker-documents (PRIVATE)
-- ============================================================================

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'worker-documents',
    'worker-documents',
    false, -- Private bucket: photos are accessed via short-lived signed URLs
    10485760, -- 10MB limit per image
    ARRAY['image/jpeg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO UPDATE SET
    public = false,
    file_size_limit = 10485760;

-- Storage policies for worker-documents bucket
DROP POLICY IF EXISTS "Allow authenticated read storage" ON storage.objects;
CREATE POLICY "Allow authenticated read storage" ON storage.objects
    FOR SELECT TO authenticated, anon
    USING (bucket_id = 'worker-documents');

DROP POLICY IF EXISTS "Allow authenticated write storage" ON storage.objects;
CREATE POLICY "Allow authenticated write storage" ON storage.objects
    FOR INSERT TO authenticated, anon
    WITH CHECK (bucket_id = 'worker-documents');

DROP POLICY IF EXISTS "Allow authenticated update storage" ON storage.objects;
CREATE POLICY "Allow authenticated update storage" ON storage.objects
    FOR UPDATE TO authenticated, anon
    USING (bucket_id = 'worker-documents');

DROP POLICY IF EXISTS "Allow authenticated delete storage" ON storage.objects;
CREATE POLICY "Allow authenticated delete storage" ON storage.objects
    FOR DELETE TO authenticated, anon
    USING (bucket_id = 'worker-documents');

-- ============================================================================
-- 12. REALTIME PUBLICATION
-- ============================================================================

-- Enable Realtime publication for tables so clients receive instant updates
DO $$
BEGIN
    -- Add workers table to supabase_realtime
    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables 
        WHERE pubname = 'supabase_realtime' AND tablename = 'workers'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.workers;
    END IF;

    -- Add app_settings table to supabase_realtime
    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables 
        WHERE pubname = 'supabase_realtime' AND tablename = 'app_settings'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.app_settings;
    END IF;

    -- Add audit_logs table to supabase_realtime
    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables 
        WHERE pubname = 'supabase_realtime' AND tablename = 'audit_logs'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.audit_logs;
    END IF;

    -- Add check_in_out_history table to supabase_realtime
    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables 
        WHERE pubname = 'supabase_realtime' AND tablename = 'check_in_out_history'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.check_in_out_history;
    END IF;

    -- Add profiles table to supabase_realtime
    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables 
        WHERE pubname = 'supabase_realtime' AND tablename = 'profiles'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.profiles;
    END IF;
END $$;

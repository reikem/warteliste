-- ============================================================
-- Warteliste — Supabase Schema
-- Base de datos: warteliste
-- Proyecto: https://vmgvnxzcfqhmjexfkthk.supabase.co
-- Ejecutar en: Supabase Dashboard → SQL Editor
-- ============================================================

-- ── Extensiones ───────────────────────────────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ── Limpiar tablas si existen (re-ejecución segura) ──────────────────────────
DROP TABLE IF EXISTS audit_logs          CASCADE;
DROP TABLE IF EXISTS sessions            CASCADE;
DROP TABLE IF EXISTS section_assignments CASCADE;
DROP TABLE IF EXISTS queue               CASCADE;
DROP TABLE IF EXISTS service_sections    CASCADE;
DROP TABLE IF EXISTS system_config       CASCADE;
DROP TABLE IF EXISTS users               CASCADE;
DROP TABLE IF EXISTS companies           CASCADE;

-- ── companies ─────────────────────────────────────────────────────────────────
CREATE TABLE companies (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name       TEXT NOT NULL,
  slug       TEXT NOT NULL UNIQUE,          -- identificador URL-safe
  logo_url   TEXT,
  brand_color TEXT NOT NULL DEFAULT '#00685f',
  is_active  BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── users ─────────────────────────────────────────────────────────────────────
CREATE TABLE users (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id    UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  email         TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  full_name     TEXT NOT NULL,
  role          TEXT NOT NULL DEFAULT 'employee'
                CHECK(role IN ('admin','employee','monitor','kiosk')),
  station       TEXT,
  avatar_url    TEXT,
  is_active     BOOLEAN NOT NULL DEFAULT TRUE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_login    TIMESTAMPTZ,
  UNIQUE(company_id, email)
);

-- ── service_sections ──────────────────────────────────────────────────────────
CREATE TABLE service_sections (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id       UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  title            TEXT NOT NULL,
  description      TEXT,
  avg_time_minutes INTEGER NOT NULL DEFAULT 10,
  prefix           TEXT NOT NULL DEFAULT 'A',
  color            TEXT NOT NULL DEFAULT '#00685f',
  is_active        BOOLEAN NOT NULL DEFAULT TRUE,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── section_assignments ───────────────────────────────────────────────────────
CREATE TABLE section_assignments (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  section_id  UUID NOT NULL REFERENCES service_sections(id) ON DELETE CASCADE,
  assigned_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, section_id)
);

-- ── queue ─────────────────────────────────────────────────────────────────────
CREATE TABLE queue (
  id                 UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id         UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  ticket_number      TEXT NOT NULL,
  prefix             TEXT NOT NULL DEFAULT 'A',
  customer_name      TEXT NOT NULL,
  customer_contact   TEXT,
  service_section_id UUID REFERENCES service_sections(id),
  status             TEXT NOT NULL DEFAULT 'waiting'
                     CHECK(status IN ('waiting','calling','serving','completed','no_show')),
  priority           TEXT NOT NULL DEFAULT 'normal'
                     CHECK(priority IN ('normal','senior','vip','urgent')),
  desk               TEXT,
  served_by          UUID REFERENCES users(id),
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  called_at          TIMESTAMPTZ,
  completed_at       TIMESTAMPTZ,
  wait_time_seconds  INTEGER
);

-- ── system_config ─────────────────────────────────────────────────────────────
CREATE TABLE system_config (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  key        TEXT NOT NULL,
  value      TEXT NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(company_id, key)
);

-- ── audit_logs ────────────────────────────────────────────────────────────────
CREATE TABLE audit_logs (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  user_id    UUID REFERENCES users(id),
  action     TEXT NOT NULL,
  entity     TEXT NOT NULL,
  entity_id  UUID,
  details    TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── sessions ──────────────────────────────────────────────────────────────────
CREATE TABLE sessions (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token      TEXT NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── Índices ───────────────────────────────────────────────────────────────────
CREATE INDEX idx_queue_company    ON queue(company_id);
CREATE INDEX idx_queue_status     ON queue(status);
CREATE INDEX idx_queue_priority   ON queue(priority);
CREATE INDEX idx_queue_created    ON queue(created_at);
CREATE INDEX idx_users_company    ON users(company_id);
CREATE INDEX idx_sections_company ON service_sections(company_id);
CREATE INDEX idx_audit_company    ON audit_logs(company_id);
CREATE INDEX idx_sessions_token   ON sessions(token);
CREATE INDEX idx_config_company   ON system_config(company_id);

-- ── Row Level Security ────────────────────────────────────────────────────────
ALTER TABLE companies          ENABLE ROW LEVEL SECURITY;
ALTER TABLE users              ENABLE ROW LEVEL SECURITY;
ALTER TABLE service_sections   ENABLE ROW LEVEL SECURITY;
ALTER TABLE section_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE queue              ENABLE ROW LEVEL SECURITY;
ALTER TABLE system_config      ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs         ENABLE ROW LEVEL SECURITY;
ALTER TABLE sessions           ENABLE ROW LEVEL SECURITY;

-- Política: service role tiene acceso total (la app usa service_role key)
-- Las políticas de usuario final se gestionan desde la app con el token de sesión.
CREATE POLICY "service_role_all" ON companies          FOR ALL USING (TRUE);
CREATE POLICY "service_role_all" ON users              FOR ALL USING (TRUE);
CREATE POLICY "service_role_all" ON service_sections   FOR ALL USING (TRUE);
CREATE POLICY "service_role_all" ON section_assignments FOR ALL USING (TRUE);
CREATE POLICY "service_role_all" ON queue              FOR ALL USING (TRUE);
CREATE POLICY "service_role_all" ON system_config      FOR ALL USING (TRUE);
CREATE POLICY "service_role_all" ON audit_logs         FOR ALL USING (TRUE);
CREATE POLICY "service_role_all" ON sessions           FOR ALL USING (TRUE);

-- ── Realtime: habilitar para queue y sessions ─────────────────────────────────
-- (Activar en Dashboard > Database > Replication también)
ALTER PUBLICATION supabase_realtime ADD TABLE queue;
ALTER PUBLICATION supabase_realtime ADD TABLE sessions;

-- ── Empresa demo: Warteliste ──────────────────────────────────────────────────
INSERT INTO companies (id, name, slug, brand_color)
VALUES ('00000000-0000-0000-0000-000000000001', 'Warteliste Demo', 'warteliste', '#00685f');

-- Contraseña admin123 hasheada con SHA256 + salt 'queuemaster_salt_2026'
-- Hash: se generará en runtime por la app. Aquí usamos un placeholder.
-- La app llama a hashPassword() al registrar usuarios nuevos.
INSERT INTO users (id, company_id, email, password_hash, full_name, role, station)
VALUES
  ('00000000-0000-0000-0000-000000000010',
   '00000000-0000-0000-0000-000000000001',
   'admin@warteliste.com',
   'PLACEHOLDER_HASH_REGENERATED_ON_FIRST_RUN',
   'Administrador', 'admin', 'Station 01'),
  ('00000000-0000-0000-0000-000000000011',
   '00000000-0000-0000-0000-000000000001',
   'marcus@warteliste.com',
   'PLACEHOLDER_HASH_REGENERATED_ON_FIRST_RUN',
   'Marcus Johnson', 'employee', 'Station 04'),
  ('00000000-0000-0000-0000-000000000012',
   '00000000-0000-0000-0000-000000000001',
   'monitor@warteliste.com',
   'PLACEHOLDER_HASH_REGENERATED_ON_FIRST_RUN',
   'Monitor Lobby', 'monitor', 'Lobby'),
  ('00000000-0000-0000-0000-000000000013',
   '00000000-0000-0000-0000-000000000001',
   'kiosk@warteliste.com',
   'PLACEHOLDER_HASH_REGENERATED_ON_FIRST_RUN',
   'Kiosco 01', 'kiosk', 'Kiosk 01');

-- Config base empresa demo
INSERT INTO system_config (company_id, key, value) VALUES
  ('00000000-0000-0000-0000-000000000001', 'brand_name',       'Warteliste'),
  ('00000000-0000-0000-0000-000000000001', 'brand_color',      '#00685f'),
  ('00000000-0000-0000-0000-000000000001', 'active_desks',     '12'),
  ('00000000-0000-0000-0000-000000000001', 'auto_allocate',    'true'),
  ('00000000-0000-0000-0000-000000000001', 'show_weather',     'true'),
  ('00000000-0000-0000-0000-000000000001', 'weather_city',     'chile_vina'),
  ('00000000-0000-0000-0000-000000000001', 'ticket_counter_A', '0'),
  ('00000000-0000-0000-0000-000000000001', 'ticket_counter_B', '0'),
  ('00000000-0000-0000-0000-000000000001', 'ticket_counter_C', '0'),
  ('00000000-0000-0000-0000-000000000001', 'monitor_sound',    'chime'),
  ('00000000-0000-0000-0000-000000000001', 'repeat_sound',     'true'),
  ('00000000-0000-0000-0000-000000000001', 'onboarding_done',  'false');

-- ── Función: obtener siguiente ticket por prioridad ───────────────────────────
CREATE OR REPLACE FUNCTION next_ticket(p_company_id UUID)
RETURNS TABLE(ticket_id UUID, ticket_number TEXT, priority TEXT) AS $$
BEGIN
  RETURN QUERY
  SELECT q.id, q.ticket_number, q.priority
  FROM queue q
  WHERE q.company_id = p_company_id AND q.status = 'waiting'
  ORDER BY
    CASE q.priority
      WHEN 'urgent' THEN 0
      WHEN 'vip'    THEN 1
      WHEN 'senior' THEN 2
      ELSE               3
    END,
    q.created_at ASC
  LIMIT 1;
END;
$$ LANGUAGE plpgsql;

-- ── Vista: estadísticas del día ───────────────────────────────────────────────
CREATE OR REPLACE VIEW daily_stats AS
SELECT
  company_id,
  COUNT(*) FILTER (WHERE status = 'completed' AND created_at::date = CURRENT_DATE) AS completed_today,
  COUNT(*) FILTER (WHERE status = 'no_show'   AND created_at::date = CURRENT_DATE) AS no_show_today,
  COUNT(*) FILTER (WHERE status IN ('waiting','calling'))                           AS currently_waiting,
  ROUND(AVG(wait_time_seconds) FILTER (
    WHERE status = 'completed' AND created_at::date = CURRENT_DATE
  ) / 60.0, 1)                                                                      AS avg_wait_minutes
FROM queue
GROUP BY company_id;

COMMENT ON TABLE companies IS 'Multi-empresa: cada empresa tiene sus propios usuarios, secciones y cola.';
COMMENT ON TABLE queue     IS 'Cola de turnos. priority: normal < senior < vip < urgent.';
COMMENT ON TABLE users     IS 'Usuarios del sistema por empresa.';
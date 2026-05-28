-- =============================================================================
--  QueueMaster Pro — PostgreSQL Schema
--  Versión: 1.0.0
--  Base de datos del servidor/backend para sincronización multi-branch.
--
--  Ejecutar con:
--    psql -U postgres -d queuemaster -f schema.sql
--
--  O crear la BD primero:
--    createdb -U postgres queuemaster
--    psql -U postgres -d queuemaster -f schema.sql
-- =============================================================================

-- Extensiones
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- =============================================================================
-- ENUM TYPES
-- =============================================================================

CREATE TYPE user_role AS ENUM ('superadmin', 'admin', 'supervisor', 'employee');
CREATE TYPE queue_status AS ENUM ('waiting', 'calling', 'serving', 'completed', 'no_show', 'transferred');
CREATE TYPE media_type AS ENUM ('native', 'url', 'text');
CREATE TYPE unit_system AS ENUM ('C', 'F');
CREATE TYPE sync_status AS ENUM ('pending', 'synced', 'conflict', 'failed');

-- =============================================================================
-- TABLA: organizations (multi-tenant)
-- =============================================================================

CREATE TABLE organizations (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name          VARCHAR(200) NOT NULL,
  slug          VARCHAR(100) NOT NULL UNIQUE,
  logo_url      TEXT,
  brand_color   VARCHAR(7) NOT NULL DEFAULT '#00685f',
  plan          VARCHAR(50) NOT NULL DEFAULT 'standard',
  is_active     BOOLEAN NOT NULL DEFAULT TRUE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE organizations IS 'Organizaciones o empresas clientes del sistema (multi-tenant)';

-- =============================================================================
-- TABLA: branches (sucursales)
-- =============================================================================

CREATE TABLE branches (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name            VARCHAR(200) NOT NULL,
  address         TEXT,
  city            VARCHAR(100),
  country         VARCHAR(100) NOT NULL DEFAULT 'MX',
  timezone        VARCHAR(50) NOT NULL DEFAULT 'America/Mexico_City',
  active_desks    INTEGER NOT NULL DEFAULT 10,
  is_active       BOOLEAN NOT NULL DEFAULT TRUE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_branches_org ON branches(organization_id);
COMMENT ON TABLE branches IS 'Sucursales físicas de cada organización';

-- =============================================================================
-- TABLA: users
-- =============================================================================

CREATE TABLE users (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  branch_id       UUID REFERENCES branches(id) ON DELETE SET NULL,
  email           VARCHAR(255) NOT NULL UNIQUE,
  password_hash   TEXT NOT NULL,       -- bcrypt hash
  full_name       VARCHAR(200) NOT NULL,
  role            user_role NOT NULL DEFAULT 'employee',
  station         VARCHAR(50),
  avatar_url      TEXT,
  phone           VARCHAR(20),
  is_active       BOOLEAN NOT NULL DEFAULT TRUE,
  email_verified  BOOLEAN NOT NULL DEFAULT FALSE,
  last_login      TIMESTAMPTZ,
  login_count     INTEGER NOT NULL DEFAULT 0,
  failed_attempts INTEGER NOT NULL DEFAULT 0,
  locked_until    TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_users_org      ON users(organization_id);
CREATE INDEX idx_users_branch   ON users(branch_id);
CREATE INDEX idx_users_email    ON users(email);
CREATE INDEX idx_users_role     ON users(role);

COMMENT ON TABLE users IS 'Usuarios del sistema (empleados, supervisores, admins)';
COMMENT ON COLUMN users.password_hash IS 'Hash bcrypt con salt, nunca texto plano';
COMMENT ON COLUMN users.locked_until  IS 'Cuenta bloqueada hasta esta fecha por intentos fallidos';

-- =============================================================================
-- TABLA: sessions
-- =============================================================================

CREATE TABLE sessions (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token       TEXT NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(32), 'hex'),
  device_info JSONB,
  ip_address  INET,
  expires_at  TIMESTAMPTZ NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  revoked_at  TIMESTAMPTZ
);

CREATE INDEX idx_sessions_user  ON sessions(user_id);
CREATE INDEX idx_sessions_token ON sessions(token);
CREATE INDEX idx_sessions_exp   ON sessions(expires_at);

-- =============================================================================
-- TABLA: refresh_tokens
-- =============================================================================

CREATE TABLE refresh_tokens (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token       TEXT NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(64), 'hex'),
  expires_at  TIMESTAMPTZ NOT NULL DEFAULT NOW() + INTERVAL '30 days',
  used_at     TIMESTAMPTZ,
  revoked_at  TIMESTAMPTZ,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_refresh_user  ON refresh_tokens(user_id);
CREATE INDEX idx_refresh_token ON refresh_tokens(token);

-- =============================================================================
-- TABLA: service_sections
-- =============================================================================

CREATE TABLE service_sections (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  branch_id       UUID NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
  title           VARCHAR(200) NOT NULL,
  description     TEXT,
  avg_time_minutes INTEGER NOT NULL DEFAULT 10,
  prefix          CHAR(1) NOT NULL DEFAULT 'A',
  color           VARCHAR(7) NOT NULL DEFAULT '#00685f',
  icon            VARCHAR(50),
  max_capacity    INTEGER NOT NULL DEFAULT 50,
  is_active       BOOLEAN NOT NULL DEFAULT TRUE,
  sort_order      INTEGER NOT NULL DEFAULT 0,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(branch_id, prefix)
);

CREATE INDEX idx_sections_branch ON service_sections(branch_id);

-- =============================================================================
-- TABLA: queue
-- =============================================================================

CREATE TABLE queue (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  branch_id           UUID NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
  ticket_number       VARCHAR(20) NOT NULL,
  prefix              CHAR(1) NOT NULL DEFAULT 'A',
  sequence_number     INTEGER NOT NULL,
  customer_name       VARCHAR(200) NOT NULL,
  customer_contact    VARCHAR(200),
  customer_notes      TEXT,
  service_section_id  UUID REFERENCES service_sections(id),
  status              queue_status NOT NULL DEFAULT 'waiting',
  priority            SMALLINT NOT NULL DEFAULT 0,      -- 0=normal, 1=priority, 2=urgent
  desk                VARCHAR(50),
  served_by           UUID REFERENCES users(id),
  transferred_to      UUID REFERENCES service_sections(id),
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  called_at           TIMESTAMPTZ,
  serving_started_at  TIMESTAMPTZ,
  completed_at        TIMESTAMPTZ,
  wait_time_seconds   INTEGER,
  service_time_seconds INTEGER,
  rating              SMALLINT CHECK(rating BETWEEN 1 AND 5),
  feedback            TEXT,
  metadata            JSONB,
  UNIQUE(branch_id, ticket_number, date_trunc('day', created_at))
);

CREATE INDEX idx_queue_branch   ON queue(branch_id);
CREATE INDEX idx_queue_status   ON queue(status);
CREATE INDEX idx_queue_section  ON queue(service_section_id);
CREATE INDEX idx_queue_created  ON queue(created_at DESC);
CREATE INDEX idx_queue_server   ON queue(served_by);
CREATE INDEX idx_queue_daily    ON queue(branch_id, date_trunc('day', created_at));

COMMENT ON TABLE queue IS 'Turnos activos e histórico completo';
COMMENT ON COLUMN queue.priority IS '0=normal, 1=prioritario (adultos mayores, etc.), 2=urgente';

-- =============================================================================
-- TABLA: ticket_counters (secuencias por sucursal y prefijo)
-- =============================================================================

CREATE TABLE ticket_counters (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  branch_id   UUID NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
  prefix      CHAR(1) NOT NULL,
  counter     INTEGER NOT NULL DEFAULT 0,
  reset_at    TIMESTAMPTZ NOT NULL DEFAULT date_trunc('day', NOW()),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(branch_id, prefix)
);

-- =============================================================================
-- FUNCIÓN: Obtener y auto-incrementar ticket counter
-- =============================================================================

CREATE OR REPLACE FUNCTION get_next_ticket_number(
  p_branch_id UUID,
  p_prefix CHAR(1)
) RETURNS INTEGER AS $$
DECLARE
  v_counter INTEGER;
  v_today DATE := CURRENT_DATE;
BEGIN
  -- Upsert con lock para evitar race conditions
  INSERT INTO ticket_counters (branch_id, prefix, counter, reset_at)
  VALUES (p_branch_id, p_prefix, 1, date_trunc('day', NOW()))
  ON CONFLICT (branch_id, prefix) DO UPDATE
    SET counter = CASE
          WHEN date_trunc('day', ticket_counters.reset_at) < date_trunc('day', NOW())
          THEN 1  -- Reinicio diario
          ELSE ticket_counters.counter + 1
        END,
        reset_at = CASE
          WHEN date_trunc('day', ticket_counters.reset_at) < date_trunc('day', NOW())
          THEN date_trunc('day', NOW())
          ELSE ticket_counters.reset_at
        END,
        updated_at = NOW()
  RETURNING counter INTO v_counter;

  RETURN v_counter;
END;
$$ LANGUAGE plpgsql;

-- =============================================================================
-- TABLA: system_config (configuración por sucursal)
-- =============================================================================

CREATE TABLE system_config (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  branch_id   UUID NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
  key         VARCHAR(100) NOT NULL,
  value       TEXT NOT NULL,
  data_type   VARCHAR(20) NOT NULL DEFAULT 'string',  -- string, number, boolean, json
  description TEXT,
  updated_by  UUID REFERENCES users(id),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(branch_id, key)
);

CREATE INDEX idx_config_branch ON system_config(branch_id);

-- =============================================================================
-- TABLA: media_content (contenido multimedia para monitor)
-- =============================================================================

CREATE TABLE media_content (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  branch_id   UUID NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
  title       VARCHAR(200) NOT NULL,
  media_type  media_type NOT NULL DEFAULT 'native',
  url         TEXT,
  content     TEXT,
  file_path   TEXT,
  duration_seconds INTEGER NOT NULL DEFAULT 10,
  is_active   BOOLEAN NOT NULL DEFAULT TRUE,
  sort_order  INTEGER NOT NULL DEFAULT 0,
  valid_from  TIMESTAMPTZ,
  valid_until TIMESTAMPTZ,
  created_by  UUID REFERENCES users(id),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_media_branch ON media_content(branch_id);

-- =============================================================================
-- TABLA: audit_logs
-- =============================================================================

CREATE TABLE audit_logs (
  id          BIGSERIAL PRIMARY KEY,
  org_id      UUID REFERENCES organizations(id),
  branch_id   UUID REFERENCES branches(id),
  user_id     UUID REFERENCES users(id),
  action      VARCHAR(100) NOT NULL,
  entity      VARCHAR(100) NOT NULL,
  entity_id   TEXT,
  old_data    JSONB,
  new_data    JSONB,
  ip_address  INET,
  user_agent  TEXT,
  details     TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
) PARTITION BY RANGE (created_at);

-- Partición por mes (rendimiento con datos históricos masivos)
CREATE TABLE audit_logs_2026_01 PARTITION OF audit_logs
  FOR VALUES FROM ('2026-01-01') TO ('2026-02-01');
CREATE TABLE audit_logs_2026_02 PARTITION OF audit_logs
  FOR VALUES FROM ('2026-02-01') TO ('2026-03-01');
CREATE TABLE audit_logs_2026_03 PARTITION OF audit_logs
  FOR VALUES FROM ('2026-03-01') TO ('2026-04-01');
CREATE TABLE audit_logs_2026_04 PARTITION OF audit_logs
  FOR VALUES FROM ('2026-04-01') TO ('2026-05-01');
CREATE TABLE audit_logs_2026_05 PARTITION OF audit_logs
  FOR VALUES FROM ('2026-05-01') TO ('2026-06-01');
CREATE TABLE audit_logs_2026_06 PARTITION OF audit_logs
  FOR VALUES FROM ('2026-06-01') TO ('2026-07-01');

CREATE INDEX idx_audit_user   ON audit_logs(user_id);
CREATE INDEX idx_audit_branch ON audit_logs(branch_id);
CREATE INDEX idx_audit_action ON audit_logs(action);
CREATE INDEX idx_audit_date   ON audit_logs(created_at DESC);

-- =============================================================================
-- TABLA: sync_queue (cola de sincronización SQLite → PostgreSQL)
-- =============================================================================

CREATE TABLE sync_queue (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  branch_id   UUID NOT NULL REFERENCES branches(id),
  device_id   VARCHAR(100) NOT NULL,
  entity      VARCHAR(100) NOT NULL,
  entity_id   TEXT NOT NULL,
  operation   VARCHAR(20) NOT NULL,  -- INSERT, UPDATE, DELETE
  payload     JSONB NOT NULL,
  status      sync_status NOT NULL DEFAULT 'pending',
  attempts    SMALLINT NOT NULL DEFAULT 0,
  error_msg   TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  synced_at   TIMESTAMPTZ
);

CREATE INDEX idx_sync_branch  ON sync_queue(branch_id);
CREATE INDEX idx_sync_status  ON sync_queue(status);
CREATE INDEX idx_sync_device  ON sync_queue(device_id);

-- =============================================================================
-- TABLA: analytics_daily (resumen diario pre-calculado)
-- =============================================================================

CREATE TABLE analytics_daily (
  id                    UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  branch_id             UUID NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
  date                  DATE NOT NULL,
  total_tickets         INTEGER NOT NULL DEFAULT 0,
  completed_tickets     INTEGER NOT NULL DEFAULT 0,
  no_show_tickets       INTEGER NOT NULL DEFAULT 0,
  avg_wait_seconds      NUMERIC(10,2),
  avg_service_seconds   NUMERIC(10,2),
  peak_hour             SMALLINT,   -- 0-23
  busiest_section_id    UUID REFERENCES service_sections(id),
  avg_rating            NUMERIC(3,2),
  total_ratings         INTEGER NOT NULL DEFAULT 0,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(branch_id, date)
);

CREATE INDEX idx_analytics_branch ON analytics_daily(branch_id);
CREATE INDEX idx_analytics_date   ON analytics_daily(date DESC);

-- =============================================================================
-- TABLA: staff_shifts (turnos del personal)
-- =============================================================================

CREATE TABLE staff_shifts (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  branch_id   UUID NOT NULL REFERENCES branches(id),
  station     VARCHAR(50),
  started_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ended_at    TIMESTAMPTZ,
  tickets_served INTEGER NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_shifts_user   ON staff_shifts(user_id);
CREATE INDEX idx_shifts_branch ON staff_shifts(branch_id);
CREATE INDEX idx_shifts_date   ON staff_shifts(started_at DESC);

-- =============================================================================
-- TRIGGERS: updated_at automático
-- =============================================================================

CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_organizations_updated_at
  BEFORE UPDATE ON organizations
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_branches_updated_at
  BEFORE UPDATE ON branches
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_users_updated_at
  BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_sections_updated_at
  BEFORE UPDATE ON service_sections
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- =============================================================================
-- VISTA: queue_dashboard (vista rápida del dashboard)
-- =============================================================================

CREATE VIEW queue_dashboard AS
SELECT
  q.id,
  q.branch_id,
  q.ticket_number,
  q.customer_name,
  q.status,
  q.priority,
  q.desk,
  q.created_at,
  q.called_at,
  EXTRACT(EPOCH FROM (COALESCE(q.called_at, NOW()) - q.created_at))::INTEGER AS current_wait_seconds,
  ss.title  AS section_title,
  ss.color  AS section_color,
  ss.prefix AS section_prefix,
  u.full_name AS served_by_name,
  u.station   AS served_by_station
FROM queue q
LEFT JOIN service_sections ss ON q.service_section_id = ss.id
LEFT JOIN users u ON q.served_by = u.id
WHERE q.status IN ('waiting', 'calling', 'serving');

-- =============================================================================
-- VISTA: branch_stats_today
-- =============================================================================

CREATE VIEW branch_stats_today AS
SELECT
  b.id AS branch_id,
  b.name AS branch_name,
  COUNT(q.id) FILTER (WHERE q.status IN ('waiting','calling')) AS waiting,
  COUNT(q.id) FILTER (WHERE q.status = 'serving') AS serving,
  COUNT(q.id) FILTER (WHERE q.status = 'completed') AS completed_today,
  COUNT(q.id) FILTER (WHERE q.status = 'no_show') AS no_shows,
  ROUND(AVG(q.wait_time_seconds) FILTER (WHERE q.status = 'completed'), 0)::INTEGER AS avg_wait_seconds,
  ROUND(AVG(q.rating) FILTER (WHERE q.rating IS NOT NULL), 2) AS avg_rating
FROM branches b
LEFT JOIN queue q ON q.branch_id = b.id AND q.created_at >= date_trunc('day', NOW())
GROUP BY b.id, b.name;

-- =============================================================================
-- DATOS INICIALES
-- =============================================================================

-- Organización demo
INSERT INTO organizations (id, name, slug, brand_color)
VALUES (
  '00000000-0000-0000-0000-000000000001',
  'QueueMaster Demo Corp',
  'queuemaster-demo',
  '#00685f'
);

-- Sucursal demo
INSERT INTO branches (id, organization_id, name, address, city, country)
VALUES (
  '00000000-0000-0000-0000-000000000002',
  '00000000-0000-0000-0000-000000000001',
  'Sucursal Central',
  'Av. Principal 123',
  'Ciudad de México',
  'MX'
);

-- Usuario superadmin
INSERT INTO users (
  id, organization_id, branch_id, email, password_hash,
  full_name, role, station, is_active, email_verified
) VALUES (
  '00000000-0000-0000-0000-000000000010',
  '00000000-0000-0000-0000-000000000001',
  '00000000-0000-0000-0000-000000000002',
  'admin@queuemaster.com',
  crypt('admin123', gen_salt('bf', 12)),   -- bcrypt rounds=12
  'Administrador Sistema',
  'admin',
  'Station 01',
  TRUE, TRUE
);

-- Usuario empleado demo
INSERT INTO users (
  id, organization_id, branch_id, email, password_hash,
  full_name, role, station, is_active, email_verified
) VALUES (
  '00000000-0000-0000-0000-000000000011',
  '00000000-0000-0000-0000-000000000001',
  '00000000-0000-0000-0000-000000000002',
  'marcus@queuemaster.com',
  crypt('admin123', gen_salt('bf', 12)),
  'Marcus Johnson',
  'employee',
  'Station 04',
  TRUE, TRUE
);

-- Secciones de servicio demo
INSERT INTO service_sections (branch_id, title, description, avg_time_minutes, prefix, color, sort_order) VALUES
  ('00000000-0000-0000-0000-000000000002', 'Sales',    'General product inquiries.',          12, 'A', '#00685f', 1),
  ('00000000-0000-0000-0000-000000000002', 'Support',  'Technical assistance.',               25, 'B', '#565e74', 2),
  ('00000000-0000-0000-0000-000000000002', 'Payments', 'Billing and financial management.',    5, 'C', '#008378', 3);

-- Configuración del sistema
INSERT INTO system_config (branch_id, key, value, data_type, description) VALUES
  ('00000000-0000-0000-0000-000000000002', 'brand_name',    'QueueMaster Pro', 'string',  'Nombre de la marca'),
  ('00000000-0000-0000-0000-000000000002', 'brand_color',   '#00685f',          'string',  'Color primario'),
  ('00000000-0000-0000-0000-000000000002', 'active_desks',  '12',               'number',  'Escritorios activos'),
  ('00000000-0000-0000-0000-000000000002', 'auto_allocate', 'true',             'boolean', 'Auto-asignación de escritorios'),
  ('00000000-0000-0000-0000-000000000002', 'show_weather',  'true',             'boolean', 'Mostrar clima en monitor'),
  ('00000000-0000-0000-0000-000000000002', 'weather_city',  'New York',         'string',  'Ciudad para clima');

-- =============================================================================
-- PERMISOS (roles de PostgreSQL)
-- =============================================================================

-- Rol de aplicación (para el backend Node/API)
CREATE ROLE queuemaster_app WITH LOGIN PASSWORD 'change_me_in_production';

GRANT CONNECT ON DATABASE queuemaster TO queuemaster_app;
GRANT USAGE ON SCHEMA public TO queuemaster_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO queuemaster_app;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO queuemaster_app;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO queuemaster_app;

-- Rol de solo lectura (para reportes / analytics)
CREATE ROLE queuemaster_readonly WITH LOGIN PASSWORD 'change_me_in_production_readonly';
GRANT CONNECT ON DATABASE queuemaster TO queuemaster_readonly;
GRANT USAGE ON SCHEMA public TO queuemaster_readonly;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO queuemaster_readonly;

-- =============================================================================
-- FIN DEL SCHEMA
-- =============================================================================
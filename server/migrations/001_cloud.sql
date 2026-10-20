-- DEV PATH V5 na nuvem: tabelas iniciais. Aplicada uma única vez (schema_migrations).
-- Só cria o que não existe: nunca apaga nem altera tabelas que já estejam no banco.

-- Ação de captação (ex.: FATEC2026). "name" é o nome nas métricas, editável no painel.
CREATE TABLE IF NOT EXISTS events (
  code        text PRIMARY KEY,
  name        text NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- Cada TV do evento. join_code = código opaco do QR (/join/<join_code>).
CREATE TABLE IF NOT EXISTS displays (
  id            serial PRIMARY KEY,
  event_code    text NOT NULL,
  display_code  text NOT NULL,
  display_name  text,
  join_code     text NOT NULL,
  status        text NOT NULL DEFAULT 'OFFLINE',   -- OFFLINE, WAITING, READY, RUNNING, FINISHING
  last_seen_at  timestamptz,
  created_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE (event_code, display_code)
);

-- Cadastros (dados pessoais: excluídos de verdade quando o visitante ou o operador pede).
CREATE TABLE IF NOT EXISTS leads (
  id             uuid PRIMARY KEY,
  registered_at  text NOT NULL,          -- data e hora local do estande, como na planilha
  name           text NOT NULL,
  contact        text NOT NULL,
  contact_type   text NOT NULL,          -- email, instagram, whatsapp
  interest       text NOT NULL,          -- design, logic, apps, business
  consent        boolean NOT NULL DEFAULT true,
  evento         text NOT NULL,
  event_code     text,
  display_code   text
);

-- Cada vez que alguém toca em Começar. Sem chave estrangeira para leads: excluído o lead,
-- a sessão continua para as estatísticas, só com o id anônimo.
CREATE TABLE IF NOT EXISTS sessions (
  id            uuid PRIMARY KEY,
  lead_id       uuid,
  event_code    text,
  display_code  text,
  status        text NOT NULL,           -- queued, running, completed, interrupted, canceled
  created_at    timestamptz NOT NULL DEFAULT now(),
  started_at    timestamptz,
  finished_at   timestamptz
);
CREATE INDEX IF NOT EXISTS sessions_display ON sessions (event_code, display_code, status);

-- Funil e reações (o antigo eventos.jsonl): só ids aleatórios, nunca nome ou contato.
CREATE TABLE IF NOT EXISTS interactions (
  id      bigserial PRIMARY KEY,
  quando  text NOT NULL,
  tipo    text NOT NULL,
  evento  text NOT NULL,
  dados   jsonb NOT NULL DEFAULT '{}'
);
CREATE INDEX IF NOT EXISTS interactions_evento ON interactions (evento, tipo);

-- Filas e telões em andamento, para o servidor voltar de onde parou depois de um reinício.
CREATE TABLE IF NOT EXISTS app_state (
  key         text PRIMARY KEY,
  value       jsonb NOT NULL,
  updated_at  timestamptz NOT NULL DEFAULT now()
);

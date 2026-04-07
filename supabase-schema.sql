-- ============================================
-- FlashOS Monitor - Supabase Database Schema
-- Execute este SQL no "SQL Editor" do Supabase
-- ============================================

-- Tabela de Técnicos (Frota)
CREATE TABLE technicians (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'offline' CHECK (status IN ('moving', 'idle', 'offline')),
  lat DOUBLE PRECISION NOT NULL DEFAULT -23.55052,
  lng DOUBLE PRECISION NOT NULL DEFAULT -46.633308,
  speed INTEGER NOT NULL DEFAULT 0,
  dest TEXT DEFAULT '',
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tabela de Ordens de Serviço
CREATE TABLE service_orders (
  id SERIAL PRIMARY KEY,
  address TEXT DEFAULT '',
  lat DOUBLE PRECISION NOT NULL,
  lng DOUBLE PRECISION NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'assigned', 'completed')),
  assigned_tech_id INTEGER REFERENCES technicians(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Habilitar Realtime para ambas tabelas
ALTER PUBLICATION supabase_realtime ADD TABLE technicians;
ALTER PUBLICATION supabase_realtime ADD TABLE service_orders;

-- Inserir dados de demonstração (Técnicos)
INSERT INTO technicians (name, status, lat, lng, speed, dest) VALUES
  ('Carlos Silva', 'moving', -23.55052, -46.633308, 45, 'Av. Paulista, 1000'),
  ('Marcos Santos', 'idle', -23.5615, -46.6559, 0, 'R. Augusta, 500'),
  ('Ana Oliveira', 'moving', -23.5411, -46.6433, 60, 'Centro'),
  ('João Souza', 'offline', -23.5822, -46.6833, 0, 'Base');

-- Habilitar RLS (Row Level Security) aberto para o agora
ALTER TABLE technicians ENABLE ROW LEVEL SECURITY;
ALTER TABLE service_orders ENABLE ROW LEVEL SECURITY;

-- Políticas permissivas para operações do painel (anon key)
CREATE POLICY "Allow all for technicians" ON technicians FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for service_orders" ON service_orders FOR ALL USING (true) WITH CHECK (true);

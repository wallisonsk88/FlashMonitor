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
  user_id UUID UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE service_orders (
  id SERIAL PRIMARY KEY,
  address TEXT DEFAULT '',
  lat DOUBLE PRECISION NOT NULL,
  lng DOUBLE PRECISION NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'assigned', 'accepted', 'completed')),
  assigned_tech_id INTEGER REFERENCES technicians(id) ON DELETE SET NULL,
  report_notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Habilitar Realtime para ambas tabelas
ALTER PUBLICATION supabase_realtime ADD TABLE technicians;
ALTER PUBLICATION supabase_realtime ADD TABLE service_orders;

-- === SEGURANÇA E POLÍTICAS (RLS) ===

-- 1. Habilitar RLS
ALTER TABLE technicians ENABLE ROW LEVEL SECURITY;
ALTER TABLE service_orders ENABLE ROW LEVEL SECURITY;

-- 2. Políticas para a tabela TECHNICIANS
-- Admin pode fazer tudo
CREATE POLICY "Admins can do everything with technicians" ON technicians
  FOR ALL USING (NOT EXISTS (SELECT 1 FROM technicians WHERE user_id = auth.uid()));

-- Técnico pode ver todos (para o mapa admin funcionar se necessário) mas só atualizar a si mesmo
CREATE POLICY "Technicians can update their own position" ON technicians
  FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Technicians can view all technicians" ON technicians
  FOR SELECT USING (true);


-- 3. Políticas para a tabela SERVICE_ORDERS
-- Admin pode fazer tudo
CREATE POLICY "Admins can do everything with service_orders" ON service_orders
  FOR ALL USING (NOT EXISTS (SELECT 1 FROM technicians WHERE user_id = auth.uid()));

-- Técnico só vê e atualiza ordens atribuídas a ele
CREATE POLICY "Technicians can only see their own assigned orders" ON service_orders
  FOR SELECT USING (
    auth.uid() = (SELECT user_id FROM technicians WHERE id = assigned_tech_id)
  );

CREATE POLICY "Technicians can only update their own assigned orders" ON service_orders
  FOR UPDATE USING (
    auth.uid() = (SELECT user_id FROM technicians WHERE id = assigned_tech_id)
  ) WITH CHECK (
    auth.uid() = (SELECT user_id FROM technicians WHERE id = assigned_tech_id)
  );

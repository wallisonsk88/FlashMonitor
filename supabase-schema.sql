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

-- Tabela de Ordens de Serviço
CREATE TABLE service_orders (
  id SERIAL PRIMARY KEY,
  address TEXT DEFAULT '',
  lat DOUBLE PRECISION NOT NULL,
  lng DOUBLE PRECISION NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'assigned', 'completed')),
  assigned_tech_id INTEGER REFERENCES technicians(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Habilitar Realtime para ambas tabelas
ALTER PUBLICATION supabase_realtime ADD TABLE technicians;
ALTER PUBLICATION supabase_realtime ADD TABLE service_orders;

-- Políticas permissivas para operações do painel (Administrador e Anon)
CREATE POLICY "Allow all for technicians" ON technicians FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for service_orders" ON service_orders FOR ALL USING (true) WITH CHECK (true);

-- Políticas RLS para Autenticação (Técnicos logados)
CREATE POLICY "Technicians can only update their own position" ON technicians
  FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Technicians can see assigned orders" ON service_orders
  FOR SELECT USING (auth.uid() = (SELECT user_id FROM technicians WHERE id = assigned_tech_id));

import { useState, useEffect } from 'react';
import MapDashboard from './components/MapDashboard';
import Login from './components/Login';
import TechDashboard from './components/TechDashboard';
import Unauthorized from './components/Unauthorized'; // New secure gate
import { supabase } from './supabaseClient';
import 'leaflet/dist/leaflet.css';
import './index.css';

function App() {
  const [session, setSession] = useState<any>(null);
  const [userRole, setUserRole] = useState<'tech' | 'admin' | 'none' | null>(null);
  const [loading, setLoading] = useState(true);

  // === CONFIGURAÇÃO DE SEGURANÇA ===
  // Coloque seu e-mail de administrador aqui para garantir seu acesso
  const ADMIN_EMAILS = ['wallisonsk88@gmail.com']; // Placeholder robusto baseado no repo

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (session) checkRole(session);
      else setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if (session) checkRole(session);
      else {
        setUserRole(null);
        setLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const checkRole = async (session: any) => {
    setLoading(true);
    
    // 1. Check if is Admin
    if (ADMIN_EMAILS.includes(session.user.email)) {
      setUserRole('admin');
      setLoading(false);
      return;
    }

    // 2. Check if is Technician (Registered by Admin)
    const { data } = await supabase
      .from('technicians')
      .select('id')
      .eq('user_id', session.user.id)
      .single();
    
    if (data) {
      setUserRole('tech');
    } else {
      setUserRole('none'); // Access Denied
    }
    setLoading(false);
  };

  if (loading) return <div className="app-loading">Verificando Credenciais...</div>;

  if (!session) {
    return <Login onLogin={() => {}} />;
  }

  return (
    <>
      {userRole === 'tech' && <TechDashboard user={session.user} onLogout={() => setSession(null)} />}
      {userRole === 'admin' && <MapDashboard user={session.user} />}
      {userRole === 'none' && <Unauthorized onLogout={() => setSession(null)} />}
    </>
  );
}

export default App;

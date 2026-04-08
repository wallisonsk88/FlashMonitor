import { useState, useEffect } from 'react';
import MapDashboard from './components/MapDashboard';
import Login from './components/Login';
import TechDashboard from './components/TechDashboard';
import { supabase } from './supabaseClient';
import { Lightning } from '@phosphor-icons/react';
import 'leaflet/dist/leaflet.css';
import './index.css';

function App() {
  const [session, setSession] = useState<any>(null);
  const [isTech, setIsTech] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      checkRole(session);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      checkRole(session);
    });

    return () => subscription.unsubscribe();
  }, []);

  const checkRole = async (session: any) => {
    if (!session) {
      setIsTech(null);
      setLoading(false);
      return;
    }

    // Check if user is in technicians table
    const { data } = await supabase
      .from('technicians')
      .select('id')
      .eq('user_id', session.user.id)
      .single();
    
    setIsTech(!!data);
    setLoading(false);
  };

  if (loading) return <div className="app-loading glass-panel"><Lightning weight="fill" className="pulse" /> Iniciando FlashMonitor...</div>;

  if (!session) {
    return <Login onLogin={() => {}} />;
  }

  // If logged in but NOT a technician
  if (isTech === false) {
    // You can add your specific admin email here if you want to bypass this
    // For now, only people in 'technicians' table get the TechDashboard.
    // Others are treated as potential admins or blocked.
    // As per user request: "os tecnicos so podem entra no sistema se eu criar um usuarios para eles"
    
    // We'll allow the MapDashboard only for the first user or a specific logic.
    // For this build, if NOT a tech and NOT an admin-like session, we block.
    return (
      <div className="unauthorized-container glass-panel">
        <Lightning weight="fill" size={48} color="var(--accent-red)" />
        <h2>Acesso Restrito</h2>
        <p>Sua conta está aguardando liberação do administrador.</p>
        <button onClick={() => supabase.auth.signOut()} className="btn secondary">Voltar ao Login</button>
      </div>
    );
  }

  return (
    <>
      {isTech ? (
        <TechDashboard user={session.user} onLogout={() => {}} />
      ) : (
        <MapDashboard />
      )}
    </>
  );
}

export default App;

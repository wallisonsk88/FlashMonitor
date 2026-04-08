import { useState, useEffect } from 'react';
import MapDashboard from './components/MapDashboard';
import Login from './components/Login';
import TechDashboard from './components/TechDashboard';
import { supabase } from './supabaseClient';
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

  if (loading) return <div className="app-loading">Iniciando FlashMonitor...</div>;

  if (!session) {
    return <Login onLogin={() => {}} />;
  }

  return (
    <>
      {isTech ? (
        <TechDashboard user={session.user} onLogout={() => {}} />
      ) : (
        <MapDashboard user={session.user} />
      )}
    </>
  );
}

export default App;

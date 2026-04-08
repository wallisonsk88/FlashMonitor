import { SignOut, LockSimple } from '@phosphor-icons/react';
import { supabase } from '../supabaseClient';

export default function Unauthorized({ onLogout }: { onLogout: () => void }) {
  const handleLogout = async () => {
    await supabase.auth.signOut();
    onLogout();
  };

  return (
    <div className="unauthorized-container glass-panel">
      <div className="unauthorized-content">
        <div className="lock-icon">
          <LockSimple weight="fill" />
        </div>
        <h1>Acesso Restrito</h1>
        <p>Olá! Notamos que seu usuário ainda não possui permissão para acessar o FlashMonitor.</p>
        <p className="notice">Por favor, entre em contato com o administrador para que ele crie seu perfil de técnico.</p>
        
        <button className="btn primary" onClick={handleLogout}>
          <SignOut weight="bold" /> Sair do Sistema
        </button>
      </div>
    </div>
  );
}

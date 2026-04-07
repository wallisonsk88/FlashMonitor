import { useState } from 'react';
import { supabase } from '../supabaseClient';
import { Lightning, Envelope, Lock, SignIn } from '@phosphor-icons/react';

export default function Login({ onLogin }: { onLogin: () => void }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    const { error } = await supabase.auth.signInWithPassword({ email, password });
    
    if (error) {
      console.error('Erro detalhado:', error);
      setError(`Falha: ${error.message}`);
      setLoading(false);
    } else {
      onLogin();
    }
  };

  return (
    <div className="login-container">
      <div className="login-card glass-panel">
        <header className="login-header">
          <div className="logo-icon"><Lightning weight="fill" /></div>
          <h1>FlashMonitor</h1>
          <p>Acesse sua conta para monitoramento</p>
        </header>

        <form onSubmit={handleLogin} className="login-form">
          <div className="input-group">
            <label><Envelope /> Email</label>
            <input 
              type="email" 
              placeholder="seu@email.com" 
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
            />
          </div>

          <div className="input-group">
            <label><Lock /> Senha</label>
            <input 
              type="password" 
              placeholder="••••••••" 
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
            />
          </div>

          {error && <div className="login-error">{error}</div>}

          <button type="submit" className="btn primary login-btn" disabled={loading}>
            {loading ? 'Entrando...' : <><SignIn /> Entrar no sistema</>}
          </button>
        </form>

        <footer className="login-footer">
          <p>© 2026 FlashMonitor - Codó, MA</p>
        </footer>
      </div>
    </div>
  );
}

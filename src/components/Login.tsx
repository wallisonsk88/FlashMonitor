import { useState } from 'react';
import { supabase } from '../supabaseClient';
import { Lightning, Envelope, Lock, SignIn } from '@phosphor-icons/react';

export default function Login({ onLogin }: { onLogin: () => void }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [isRegistering, setIsRegistering] = useState(false);
  const [message, setMessage] = useState('');

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setMessage('');

    if (isRegistering) {
      const { error } = await supabase.auth.signUp({ email, password });
      if (error) {
        setError(`Erro ao cadastrar: ${error.message}`);
        setLoading(false);
      } else {
        setMessage('Cadastro realizado! Verifique seu email ou confirme no painel do Supabase.');
        setLoading(false);
      }
    } else {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) {
        console.error('Erro detalhado:', error);
        setError(`Falha: ${error.message}`);
        setLoading(false);
      } else {
        onLogin();
      }
    }
  };

  return (
    <div className="login-container">
      <div className="login-card glass-panel">
        <header className="login-header">
          <div className="logo-icon"><Lightning weight="fill" /></div>
          <h1>FlashMonitor</h1>
          <p>{isRegistering ? 'Crie sua conta agora' : 'Acesse sua conta para monitoramento'}</p>
        </header>

        <form onSubmit={handleAuth} className="login-form">
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
          {message && <div className="login-success" style={{ color: '#4ade80', marginBottom: '16px', fontSize: '0.85rem' }}>{message}</div>}

          <button type="submit" className="btn primary login-btn" disabled={loading}>
            {loading ? 'Processando...' : (
              isRegistering ? <><SignIn /> Criar Conta</> : <><SignIn /> Entrar no sistema</>
            )}
          </button>
        </form>

        <button 
          className="btn secondary login-btn" 
          style={{ marginTop: '12px' }}
          onClick={() => { setIsRegistering(!isRegistering); setError(''); setMessage(''); }}
        >
          {isRegistering ? 'Já tem conta? Entrar' : 'Não tem conta? Cadastre-se'}
        </button>

        <footer className="login-footer">
          <p>© 2026 FlashMonitor - Codó, MA</p>
        </footer>
      </div>
    </div>
  );
}

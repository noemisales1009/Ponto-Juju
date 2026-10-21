import React, { useState } from 'react';
import LogoIcon from './LogoIcon';

interface LoginScreenProps {
  onLogin: (email: string, password_cleartext: string) => Promise<boolean>;
  error: string | null;
}

const LoginScreen: React.FC<LoginScreenProps> = ({ onLogin, error }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (email.trim() && password.trim()) {
      setIsLoading(true);
      await onLogin(email, password);
      setIsLoading(false);
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen p-4">
      <div className="w-full max-w-md p-8 space-y-8 bg-pmp-surface dark:bg-dark-pmp-surface rounded-2xl shadow-2xl border border-gray-100 dark:border-gray-700/50">
        <div className="text-center">
            <div className="w-20 h-20 mx-auto bg-gradient-to-br from-pmp-primary to-pmp-secondary rounded-full flex items-center justify-center shadow-lg">
                 <LogoIcon className="w-14 h-14 text-white" />
            </div>
          <h1 className="text-3xl font-bold text-pmp-text-primary dark:text-dark-pmp-text-primary mt-6 tracking-tight">Ponto Kids</h1>
          <p className="mt-2 text-sm text-pmp-text-secondary dark:text-dark-pmp-text-secondary">
            Bem-vindo. Por favor, insira seu e-mail e senha.
          </p>
        </div>
        <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
          <div className="space-y-4">
            <div>
              <label htmlFor="email-address" className="sr-only">
                E-mail
              </label>
              <input
                id="email-address"
                name="email"
                type="email"
                autoComplete="email"
                required
                className="relative block w-full px-4 py-3 border border-gray-300 dark:border-gray-600 bg-white dark:bg-slate-900 placeholder-gray-400 dark:placeholder-gray-500 text-gray-900 dark:text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-pmp-primary focus:border-pmp-primary focus:z-10 sm:text-sm disabled:opacity-50 transition-colors"
                placeholder="Endereço de e-mail"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={isLoading}
              />
            </div>
            <div>
              <label htmlFor="password" className="sr-only">
                Senha
              </label>
              <input
                id="password"
                name="password"
                type="password"
                autoComplete="current-password"
                required
                className="relative block w-full px-4 py-3 border border-gray-300 dark:border-gray-600 bg-white dark:bg-slate-900 placeholder-gray-400 dark:placeholder-gray-500 text-gray-900 dark:text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-pmp-primary focus:border-pmp-primary focus:z-10 sm:text-sm disabled:opacity-50 transition-colors"
                placeholder="Senha"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={isLoading}
              />
            </div>
          </div>
          
          {error && <p className="text-sm text-red-600 dark:text-red-400 text-center pt-2 font-medium">{error}</p>}

          <div>
            <button
              type="submit"
              disabled={isLoading}
              className="group relative w-full flex justify-center py-3 px-4 border border-transparent text-sm font-medium rounded-lg text-white bg-pmp-primary hover:bg-pmp-primary-dark focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-pmp-primary-light transition-all duration-300 ease-in-out disabled:opacity-70 disabled:cursor-not-allowed shadow-md hover:shadow-lg"
            >
              {isLoading ? (
                <span className="flex items-center">
                  <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Entrando...
                </span>
              ) : (
                'Entrar'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default LoginScreen;
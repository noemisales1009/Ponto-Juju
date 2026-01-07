import React, { useState } from 'react';

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
      <div className="w-full max-w-md p-8 space-y-8 bg-pmp-surface rounded-2xl shadow-2xl border border-gray-100 dark:border-gray-700/30">
        <div className="text-center">
            <div className="w-20 h-20 mx-auto bg-gradient-to-br from-pmp-primary to-pmp-secondary rounded-full flex items-center justify-center shadow-lg">
                 <svg xmlns="http://www.w3.org/2000/svg" className="w-10 h-10 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
            </div>
          <h1 className="text-3xl font-bold text-pmp-text-primary mt-6 tracking-tight">Ponto Juju</h1>
          <p className="mt-2 text-sm text-pmp-text-secondary">
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
                className="relative block w-full px-4 py-3 border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700/50 placeholder-gray-400 text-pmp-text-primary dark:text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-pmp-primary focus:border-pmp-primary focus:z-10 sm:text-sm disabled:opacity-50 transition-colors"
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
                className="relative block w-full px-4 py-3 border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700/50 placeholder-gray-400 text-pmp-text-primary dark:text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-pmp-primary focus:border-pmp-primary focus:z-10 sm:text-sm disabled:opacity-50 transition-colors"
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

import React from 'react';
import { User } from '../types';

interface HeaderProps {
  user: User;
  onLogout: () => void;
  onMenuClick: () => void;
  theme: 'light' | 'dark';
  setTheme: (theme: 'light' | 'dark') => void;
}

const Header: React.FC<HeaderProps> = ({ user, onLogout, onMenuClick, theme, setTheme }) => {
    const toggleTheme = () => {
        setTheme(theme === 'light' ? 'dark' : 'light');
    };

  return (
    <header className="bg-pmp-surface dark:bg-dark-pmp-surface lg:bg-transparent lg:dark:bg-transparent shadow-sm lg:shadow-none sticky top-0 z-10 no-print">
      <div className="flex items-center justify-between lg:justify-end h-16 px-4 sm:px-6 lg:px-8">
          {/* Logo/Title on mobile instead of hamburger */}
          <div className="flex items-center lg:hidden text-pmp-primary dark:text-dark-pmp-primary text-lg font-bold">
             <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 mr-2" viewBox="0 0 20 20" fill="currentColor">
              <path d="M10 2a6 6 0 00-6 6v3.586l-.707.707A1 1 0 004 14h12a1 1 0 00.707-1.707L16 11.586V8a6 6 0 00-6 6zM10 18a3 3 0 01-3-3h6a3 3 0 01-3 3z" />
            </svg>
            Ponto Kids
          </div>

          <div className="flex items-center space-x-2 sm:space-x-4">
             <button
                onClick={toggleTheme}
                className="p-2 rounded-full text-pmp-text-secondary dark:text-dark-pmp-text-secondary hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-pmp-primary dark:hover:text-dark-pmp-primary transition-colors focus:outline-none"
                aria-label="Alternar tema"
             >
                {theme === 'light' ? (
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
                    </svg>
                ) : (
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
                    </svg>
                )}
             </button>

             <div className="flex items-center">
                 <img 
                    src={user.photoUrl || `https://ui-avatars.com/api/?name=${encodeURIComponent(user.name)}&background=6366F1&color=fff`} 
                    alt="Foto de perfil" 
                    className="h-8 w-8 rounded-full object-cover mr-2 lg:mr-3 ring-2 ring-transparent hover:ring-pmp-primary transition-all"
                 />
                 <span className="text-pmp-text-primary dark:text-dark-pmp-text-primary text-xs sm:text-sm font-semibold hidden sm:block">{user.name}</span>
                 <button
                  onClick={onLogout}
                  className="p-2 ml-1 sm:ml-2 rounded-full text-pmp-text-secondary dark:text-dark-pmp-text-secondary hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-red-500 dark:hover:text-red-400 focus:outline-none transition-colors"
                  aria-label="Sair"
                  title="Sair"
                 >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                    </svg>
                 </button>
             </div>
          </div>
      </div>
    </header>
  );
};

export default Header;

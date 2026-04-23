
import React from 'react';
import { User, View } from '../types';

interface SidebarProps {
  user: User;
  currentView: View;
  setCurrentView: (view: View) => void;
  isOpen: boolean; // Not used in bottom nav but kept for desktop legacy
  setIsOpen: (isOpen: boolean) => void;
  isAdmin?: boolean;
}

const NavLink: React.FC<{
    icon: React.ReactElement<any>;
    label: string;
    isActive: boolean;
    onClick: () => void;
    mobileOnly?: boolean;
    desktopOnly?: boolean;
}> = ({ icon, label, isActive, onClick, mobileOnly, desktopOnly }) => {
    // Classes para Desktop Sidebar
    const desktopBase = `flex items-center w-full p-3 rounded-lg text-base font-normal transition-all duration-300 ease-in-out ${desktopOnly ? '' : ''}`;
    const desktopActive = "bg-pmp-primary/10 dark:bg-dark-pmp-primary/20 text-pmp-primary dark:text-dark-pmp-primary-light shadow-sm font-semibold";
    const desktopInactive = "text-pmp-text-secondary dark:text-dark-pmp-text-secondary hover:bg-gray-100 dark:hover:bg-gray-700 hover:text-pmp-text-primary dark:hover:text-dark-pmp-text-primary";

    // Classes para Mobile Bottom Nav
    const mobileBase = "flex flex-col items-center justify-center flex-1 py-2 px-1 transition-colors relative";
    const mobileActive = "text-pmp-primary dark:text-dark-pmp-primary-light";
    const mobileInactive = "text-pmp-text-secondary dark:text-dark-pmp-text-secondary";

    return (
        <>
            {/* Desktop Version */}
            <li className={`${mobileOnly ? 'hidden' : 'hidden lg:block'}`}>
                <button onClick={onClick} className={`${desktopBase} ${isActive ? desktopActive : desktopInactive}`}>
                    {React.cloneElement(icon, { className: "w-6 h-6" })}
                    <span className="ml-4">{label}</span>
                </button>
            </li>

            {/* Mobile Version */}
            <button 
                onClick={onClick} 
                className={`lg:hidden ${mobileBase} ${isActive ? mobileActive : mobileInactive} ${desktopOnly ? 'hidden' : ''}`}
            >
                {isActive && (
                    <span className="absolute top-0 left-1/2 -translate-x-1/2 w-8 h-1 bg-pmp-primary dark:bg-dark-pmp-primary rounded-b-full"></span>
                )}
                {React.cloneElement(icon, { className: "w-6 h-6 mb-1" })}
                <span className="text-[10px] font-medium truncate w-full text-center">{label}</span>
            </button>
        </>
    );
};


const Sidebar: React.FC<SidebarProps> = ({ user, currentView, setCurrentView, isOpen, setIsOpen, isAdmin = false }) => {
    const [showAdminMenu, setShowAdminMenu] = React.useState(false);
    
    const handleNavClick = (view: View) => {
        setCurrentView(view);
        setIsOpen(false);
        setShowAdminMenu(false);
    };
  
    return (
    <>
      {/* Desktop Sidebar (Fixed Left) */}
      <aside className="fixed top-0 left-0 z-40 w-64 h-screen transition-transform -translate-x-full lg:translate-x-0 bg-pmp-surface dark:bg-dark-pmp-surface border-r border-gray-200 dark:border-gray-700 no-print" aria-label="Sidebar">
        <div className="h-full px-3 py-4 overflow-y-auto flex flex-col">
            <div className="flex items-center pl-2.5 mb-5 h-16 border-b border-gray-200 dark:border-gray-700 -mx-3 px-6">
                <div className="flex-shrink-0 text-pmp-primary dark:text-dark-pmp-primary text-xl font-extrabold flex items-center gap-3">
                 <svg xmlns="http://www.w3.org/2000/svg" className="h-7 w-7" viewBox="0 0 20 20" fill="currentColor">
                  <path d="M10 2a6 6 0 00-6 6v3.586l-.707.707A1 1 0 004 14h12a1 1 0 00.707-1.707L16 11.586V8a6 6 0 00-6-6zM10 18a3 3 0 01-3-3h6a3 3 0 01-3 3z" />
                </svg>
                Ponto Kids
              </div>
            </div>
            <ul className="space-y-2 font-medium flex-grow pt-4">
                <NavLink 
                  isActive={currentView === 'dashboard'} 
                  onClick={() => handleNavClick('dashboard')}
                  label="Início"
                  icon={<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12l8.954-8.955c.44-.439 1.152-.439 1.591 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75M8.25 21h8.25" /></svg>}
                />
                 <NavLink 
                  isActive={currentView === 'my-records'} 
                  onClick={() => handleNavClick('my-records')}
                  label="Meus Pontos"
                  icon={<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>}
                />
                 <NavLink 
                  isActive={currentView === 'earnings'} 
                  onClick={() => handleNavClick('earnings')}
                  label="Ganhos"
                  icon={<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M12 6v12m-3-2.818l.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>}
                />
                 <NavLink 
                  isActive={currentView === 'reports'} 
                  onClick={() => handleNavClick('reports')}
                  label="Relatórios"
                  icon={<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>}
                />
                
                {isAdmin && (
                  <>
                    <div className="pt-2 mt-2 border-t border-gray-200 dark:border-gray-700 hidden lg:block"></div>
                     <NavLink 
                      isActive={currentView === 'staffing'} 
                      onClick={() => handleNavClick('staffing')}
                      label="Escala"
                      icon={<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0h18M9.75 14.25h4.5" /></svg>}
                    />
                    <NavLink 
                      isActive={currentView === 'financial'} 
                      onClick={() => handleNavClick('financial')}
                      label="Financeiro"
                      desktopOnly
                      icon={<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M12 6v12m-3-2.818l.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33" /></svg>}
                    />
                    <NavLink
                      isActive={currentView === 'management'}
                      onClick={() => handleNavClick('management')}
                      label="Gerência"
                      desktopOnly
                      icon={<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M10.5 6h9.75M10.5 6a1.5 1.5 0 11-3 0m3 0a1.5 1.5 0 10-3 0M3.75 6H7.5m3 12h9.75m-9.75 0a1.5 1.5 0 11-3 0m3 0a1.5 1.5 0 10-3 0m-3.75 0H7.5m9-6h3.75m-3.75 0a1.5 1.5 0 11-3 0m3 0a1.5 1.5 0 10-3 0m-9.75 0h6" /></svg>}
                    />
                    <NavLink
                      isActive={currentView === 'absence-distribution'}
                      onClick={() => handleNavClick('absence-distribution')}
                      label="Distribuição"
                      desktopOnly
                      icon={<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M18 18.72a9.094 9.094 0 003.741-.479 3 3 0 00-4.682-2.72m.94 3.198l.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0112 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 016 18.719m12 0a5.971 5.971 0 00-.941-3.197m0 0A5.995 5.995 0 0012 12.75a5.995 5.995 0 00-5.058 2.772m0 0a3 3 0 00-4.681 2.72 8.986 8.986 0 003.74.477m.94-3.197a5.971 5.971 0 00-.94 3.197M15 6.75a3 3 0 11-6 0 3 3 0 016 0zm6 3a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0zm-13.5 0a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0z" /></svg>}
                    />
                  </>
                )}
                
                <NavLink 
                  isActive={currentView === 'profile'} 
                  onClick={() => handleNavClick('profile')}
                  label="Perfil"
                  icon={<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M17.982 18.725A7.488 7.488 0 0012 15.75a7.488 7.488 0 00-5.982 2.975m11.963 0a9 9 0 10-11.963 0m11.963 0A8.966 8.966 0 0112 21a8.966 8.966 0 01-5.982-2.275M15 9.75a3 3 0 11-6 0 3 3 0 016 0z" /></svg>}
                />

                {/* 🔐 ADMIN ONLY */}
                {isAdmin && (
                  <NavLink 
                    isActive={currentView === 'admin'} 
                    onClick={() => handleNavClick('admin')}
                    label="👩‍💼 Admin"
                    icon={<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>}
                  />
                )}
            </ul>
        </div>
      </aside>

      {/* Mobile/Tablet Bottom Navigation Bar */}
      <nav className="fixed bottom-0 left-0 z-50 w-full h-16 bg-pmp-surface/90 dark:bg-dark-pmp-surface/90 backdrop-blur-lg border-t border-gray-200 dark:border-gray-700 lg:hidden flex items-center justify-around px-2 no-print safe-area-bottom">
          <NavLink 
            isActive={currentView === 'dashboard'} 
            onClick={() => handleNavClick('dashboard')}
            label="Início"
            icon={<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12l8.954-8.955c.44-.439 1.152-.439 1.591 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75M8.25 21h8.25" /></svg>}
          />
          <NavLink 
            isActive={currentView === 'my-records'} 
            onClick={() => handleNavClick('my-records')}
            label="Meus Pontos"
            icon={<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>}
          />
          <NavLink 
            isActive={currentView === 'earnings'} 
            onClick={() => handleNavClick('earnings')}
            label="Ganhos"
            icon={<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M12 6v12m-3-2.818l.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33" /></svg>}
          />
          <NavLink 
            isActive={currentView === 'reports'} 
            onClick={() => handleNavClick('reports')}
            label="Relatórios"
            icon={<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>}
          />
          <NavLink 
            isActive={currentView === 'profile'} 
            onClick={() => handleNavClick('profile')}
            label="Perfil"
            icon={<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M17.982 18.725A7.488 7.488 0 0012 15.75a7.488 7.488 0 00-5.982 2.975m11.963 0a9 9 0 10-11.963 0m11.963 0A8.966 8.966 0 0112 21a8.966 8.966 0 01-5.982-2.275M15 9.75a3 3 0 11-6 0 3 3 0 016 0z" /></svg>}
          />
      </nav>

      {/* Botão Flutuante Admin + Menu (Só Mobile) */}
      {isAdmin && (
        <>
          {/* Menu Expansível */}
          {showAdminMenu && (
            <>
              {/* Backdrop */}
              <div 
                className="lg:hidden fixed inset-0 bg-black/20 backdrop-blur-sm z-40 no-print"
                onClick={() => setShowAdminMenu(false)}
              />
              
              {/* Menu de Opções Admin */}
              <div className="lg:hidden fixed bottom-24 right-4 z-50 flex flex-col gap-2 no-print">
                <button
                  onClick={() => handleNavClick('staffing')}
                  className={`flex items-center gap-3 px-4 py-3 rounded-xl shadow-lg transition-all hover:scale-105 ${
                    currentView === 'staffing' 
                      ? 'bg-pmp-primary text-white' 
                      : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200'
                  }`}
                >
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0h18M9.75 14.25h4.5" />
                  </svg>
                  <span className="font-medium text-sm">Escala</span>
                </button>
                
                <button
                  onClick={() => handleNavClick('financial')}
                  className={`flex items-center gap-3 px-4 py-3 rounded-xl shadow-lg transition-all hover:scale-105 ${
                    currentView === 'financial' 
                      ? 'bg-pmp-primary text-white' 
                      : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200'
                  }`}
                >
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v12m-3-2.818l.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span className="font-medium text-sm">Financeiro</span>
                </button>
                
                <button
                  onClick={() => handleNavClick('management')}
                  className={`flex items-center gap-3 px-4 py-3 rounded-xl shadow-lg transition-all hover:scale-105 ${
                    currentView === 'management' 
                      ? 'bg-pmp-primary text-white' 
                      : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200'
                  }`}
                >
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 6h9.75M10.5 6a1.5 1.5 0 11-3 0m3 0a1.5 1.5 0 10-3 0M3.75 6H7.5m3 12h9.75m-9.75 0a1.5 1.5 0 11-3 0m3 0a1.5 1.5 0 10-3 0m-3.75 0H7.5m9-6h3.75m-3.75 0a1.5 1.5 0 11-3 0m3 0a1.5 1.5 0 10-3 0m-9.75 0h6" />
                  </svg>
                  <span className="font-medium text-sm">Gerência</span>
                </button>
                
                <button
                  onClick={() => handleNavClick('reports')}
                  className={`flex items-center gap-3 px-4 py-3 rounded-xl shadow-lg transition-all hover:scale-105 ${
                    currentView === 'reports' 
                      ? 'bg-pmp-primary text-white' 
                      : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200'
                  }`}
                >
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  <span className="font-medium text-sm">Relatórios</span>
                </button>
                
                <button
                  onClick={() => handleNavClick('absence-distribution')}
                  className={`flex items-center gap-3 px-4 py-3 rounded-xl shadow-lg transition-all hover:scale-105 ${
                    currentView === 'absence-distribution'
                      ? 'bg-pmp-primary text-white'
                      : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200'
                  }`}
                >
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M18 18.72a9.094 9.094 0 003.741-.479 3 3 0 00-4.682-2.72m.94 3.198l.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0112 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 016 18.719m12 0a5.971 5.971 0 00-.941-3.197m0 0A5.995 5.995 0 0012 12.75a5.995 5.995 0 00-5.058 2.772m0 0a3 3 0 00-4.681 2.72 8.986 8.986 0 003.74.477m.94-3.197a5.971 5.971 0 00-.94 3.197M15 6.75a3 3 0 11-6 0 3 3 0 016 0zm6 3a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0zm-13.5 0a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0z" />
                  </svg>
                  <span className="font-medium text-sm">Distribuição</span>
                </button>

                <button
                  onClick={() => handleNavClick('admin')}
                  className={`flex items-center gap-3 px-4 py-3 rounded-xl shadow-lg transition-all hover:scale-105 ${
                    currentView === 'admin'
                      ? 'bg-pmp-primary text-white'
                      : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200'
                  }`}
                >
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span className="font-medium text-sm">👩‍💼 Admin</span>
                </button>
              </div>
            </>
          )}
          
          {/* Botão Principal */}
          <button
            onClick={() => setShowAdminMenu(!showAdminMenu)}
            className={`lg:hidden fixed bottom-20 right-4 z-50 w-14 h-14 rounded-full shadow-2xl flex items-center justify-center transition-all duration-300 ease-out hover:scale-110 active:scale-95 no-print ${
              showAdminMenu || ['staffing', 'financial', 'management', 'reports', 'admin', 'absence-distribution'].includes(currentView)
                ? 'bg-gradient-to-br from-pmp-primary to-pmp-primary-dark text-white ring-4 ring-pmp-primary/30' 
                : 'bg-gradient-to-br from-gray-700 to-gray-800 text-white hover:from-pmp-primary hover:to-pmp-primary-dark'
            }`}
            aria-label="Menu Admin"
          >
            {showAdminMenu ? (
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-7 h-7">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            ) : (
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-7 h-7">
                <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
              </svg>
            )}
          </button>
        </>
      )}
    </>
    );
};

export default Sidebar;

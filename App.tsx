
import React, { useState, useMemo, useEffect } from 'react';
import LoginScreen from './components/LoginScreen';
import SplashScreen from './components/SplashScreen';
import Dashboard from './components/Dashboard';
import Header from './components/Header';
import Reports from './components/Reports';
import Earnings from './components/Earnings';
import MyRecords from './components/MyRecords';
import Profile from './components/Profile';
import Sidebar from './components/Sidebar';
import FinancialReport from './components/FinancialReport';
import DataManagement from './components/DataManagement';
import StaffingReport from './components/StaffingReport';
import AdminDashboard from './components/AdminDashboard';
import AbsenceDistribution from './components/AbsenceDistribution';
import { User, View } from './types';
import { signIn, signOut, getCurrentUser, updateUserProfile } from './services/supabaseService';
import { supabase } from './services/supabaseClient';

// Telas restritas a administradores. Isto só controla a interface:
// a barreira real de acesso aos dados é a RLS/permissões no Supabase.
const ADMIN_VIEWS: View[] = ['financial', 'management', 'staffing', 'admin', 'absence-distribution'];

const App: React.FC = () => {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [currentView, setCurrentView] = useState<View>('dashboard');
  const [error, setError] = useState<string | null>(null);
  const [isSidebarOpen, setSidebarOpen] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [checkingSession, setCheckingSession] = useState(true);
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    if (typeof window !== 'undefined' && window.localStorage) {
      const storedTheme = window.localStorage.getItem('theme');
      if (storedTheme === 'dark' || storedTheme === 'light') {
        return storedTheme;
      }
    }
    return 'light';
  });

  useEffect(() => {
    const root = window.document.documentElement;
    if (theme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
    localStorage.setItem('theme', theme);
  }, [theme]);

  // Check Supabase Session on Mount
  useEffect(() => {
    const initSession = async () => {
        try {
            const user = await getCurrentUser();
            if (user) {
                setCurrentUser(user);
                await checkIfAdmin(user.id);
            }
        } catch (err) {
            console.error('Erro ao restaurar sessão:', err);
        } finally {
            setCheckingSession(false);
        }
    };
    initSession();
  }, []);

  const checkIfAdmin = async (userId: string | number) => {
    try {
      const { data } = await supabase
        .from('usuarios')
        .select('role')
        .eq('user_id', userId)
        .maybeSingle();

      setIsAdmin(data?.role === 'admin');
    } catch (err) {
      console.error('Erro ao verificar permissão:', err);
      setIsAdmin(false);
    }
  };

  const handleLogin = async (email: string, password_cleartext: string): Promise<boolean> => {
    setError(null);
    try {
        const user = await signIn(email.trim(), password_cleartext);
        setCurrentUser(user);
        await checkIfAdmin(user.id);
        return true;
    } catch (err) {
        console.error('Falha no login:', err);
        const isNetworkError = err instanceof Error && /fetch|network/i.test(err.message);
        setError(isNetworkError
            ? 'Não foi possível conectar ao servidor. Verifique sua internet.'
            : 'E-mail ou senha inválidos.');
        return false;
    }
  };

  const handleLogout = async () => {
    await signOut();
    setCurrentUser(null);
    setIsAdmin(false);
    setCurrentView('dashboard');
  };

  const handleUpdateUser = async (updates: { name?: string, photoUrl?: string }) => {
    if (!currentUser) return;

    try {
        await updateUserProfile(String(currentUser.id), updates);
        // Atualiza estado local para refletir mudança imediatamente
        setCurrentUser(prev => prev ? ({ ...prev, ...updates }) : null);
        alert('Perfil atualizado com sucesso!');
    } catch (err) {
        console.error('Erro ao atualizar perfil:', err);
        alert('Não foi possível salvar as alterações. Verifique os dados e tente novamente.');
    }
  };

  const MainContent = useMemo(() => {
    // Quem não é admin nunca renderiza telas administrativas
    const view: View = ADMIN_VIEWS.includes(currentView) && !isAdmin ? 'dashboard' : currentView;

    switch (view) {
      case 'dashboard':
        return <Dashboard currentUser={currentUser!} isAdmin={isAdmin} />;
      case 'reports':
        return <Reports />;
      case 'earnings':
        return <Earnings currentUser={currentUser!} />;
      case 'my-records':
        return <MyRecords currentUser={currentUser!} />;
      case 'profile':
        return <Profile user={currentUser!} onUpdateUser={handleUpdateUser} />;
      case 'financial':
        return <FinancialReport />;
      case 'management':
        return <DataManagement />;
      case 'staffing':
        return <StaffingReport />;
      case 'admin':
        return <AdminDashboard currentUser={currentUser!} onBack={() => setCurrentView('dashboard')} />;
      case 'absence-distribution':
        return <AbsenceDistribution />;
      default:
        return <Dashboard currentUser={currentUser!} isAdmin={isAdmin} />;
    }
  }, [currentView, currentUser, isAdmin]);

  if (checkingSession) {
    return <SplashScreen />;
  }

  if (!currentUser) {
    return (
      <div className="bg-pmp-background dark:bg-dark-pmp-background min-h-screen">
        <LoginScreen onLogin={handleLogin} error={error} />
      </div>
    );
  }

  return (
    <div className="bg-pmp-background dark:bg-dark-pmp-background min-h-screen font-sans flex flex-col lg:flex-row overflow-x-hidden">
      <Sidebar
        user={currentUser}
        currentView={currentView}
        setCurrentView={setCurrentView}
        isOpen={isSidebarOpen}
        setIsOpen={setSidebarOpen}
        isAdmin={isAdmin}
      />

      <div className="flex flex-col flex-grow min-h-screen lg:ml-64 transition-all duration-300">
        <Header
          user={currentUser}
          onLogout={handleLogout}
          onMenuClick={() => setSidebarOpen(true)}
          theme={theme}
          setTheme={setTheme}
        />
        <main className="p-4 sm:p-6 lg:p-8 flex-grow pb-24 lg:pb-8">
          {MainContent}
        </main>
      </div>
    </div>
  );
};

export default App;

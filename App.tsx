
import React, { useState, useMemo, useEffect } from 'react';
import LoginScreen from './components/LoginScreen';
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
import AdminPage from './components/AdminPage';
import AdminDashboard from './components/AdminDashboard';
import { User, View } from './types';
import { mockLogin, updateUser as apiUpdateUser } from './services/mockApi';
import { fetchMedicos, signIn, signOut, getCurrentUser, updateUserProfile } from './services/supabaseService';
import { supabase } from './services/supabaseClient';

const App: React.FC = () => {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [currentView, setCurrentView] = useState<View>('dashboard');
  const [error, setError] = useState<string | null>(null);
  const [isSidebarOpen, setSidebarOpen] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
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
        console.log('Verificando sessão Supabase...');
        const user = await getCurrentUser();
        if (user) {
            console.log('Sessão encontrada para:', user.email);
            setCurrentUser(user);
            await checkIfAdmin(user.id);
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
        .single();
      
      if (data && data.role === 'admin') {
        console.log('✅ Admin autorizado');
        setIsAdmin(true);
      } else {
        setIsAdmin(false);
      }
    } catch (err) {
      console.error('Erro ao verificar role:', err);
      setIsAdmin(false);
    }
  };

  const handleLogin = async (email: string, password_cleartext: string): Promise<boolean> => {
    setError(null);
    try {
        console.log('Tentando login via Supabase...');
        const user = await signIn(email, password_cleartext);
        setCurrentUser(user);
        return true;
    } catch (supabaseError: any) {
        console.warn('Login Supabase falhou:', supabaseError.message);
        console.log('Tentando login Mock como fallback...');
        
        // Fallback para usuários de teste (Mock) caso não existam no Supabase ainda
        const mockUser = mockLogin(email, password_cleartext);
        if (mockUser) {
            setCurrentUser(mockUser);
            return true;
        }

        setError(supabaseError.message || 'E-mail ou senha inválidos.');
        return false;
    }
  };

  const handleLogout = async () => {
    await signOut();
    setCurrentUser(null);
    setCurrentView('dashboard');
  };

  const handleUpdateUser = async (updates: { name?: string, photoUrl?: string }) => {
    if (!currentUser) return;

    // Se o ID for string, assume-se que é um usuário do Supabase (UUID)
    if (typeof currentUser.id === 'string') {
        try {
            await updateUserProfile(currentUser.id, updates);
            // Atualiza estado local para refletir mudança imediatamente
            setCurrentUser(prev => prev ? ({ ...prev, ...updates }) : null);
            alert('Perfil atualizado com sucesso!');
        } catch (err: any) {
            console.error("Erro ao atualizar perfil:", err);
            alert('Erro ao salvar alterações: ' + err.message);
        }
    } else {
        // Fallback para Mock (ID numérico)
        const updatedUser = apiUpdateUser(currentUser.id, updates);
        if (updatedUser) {
            setCurrentUser(updatedUser);
            alert('Perfil atualizado com sucesso! (Nota: Modo Mock)');
        }
    }
  };
  
  const MainContent = useMemo(() => {
    switch (currentView) {
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
      default:
        return <Dashboard currentUser={currentUser!} isAdmin={isAdmin} />;
    }
  }, [currentView, currentUser, isAdmin]);

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

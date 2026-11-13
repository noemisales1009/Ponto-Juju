
import React, { useState, useMemo, useEffect, useDeferredValue, useCallback } from 'react';
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
import LateReport from './components/LateReport';
import GpsModal from './components/GpsModal';
import { GPS_OBRIGATORIO, MOSTRAR_NOVIDADES } from './constants';
import WhatsNewModal, { conferirNovidades, marcarNovidadesVistas } from './components/WhatsNewModal';
import { verificarGps } from './src/services/pontoService';
import Requests from './components/Requests';
import LocationReport from './components/LocationReport';
import { contarPedidosPendentes } from './src/services/pedidoService';
import { User, View } from './types';
import { signIn, signOut, getCurrentUser, updateUserProfile } from './services/supabaseService';
import { supabase } from './services/supabaseClient';

// Telas restritas a administradores. Isto só controla a interface:
// a barreira real de acesso aos dados é a RLS/permissões no Supabase.
const ADMIN_VIEWS: View[] = ['financial', 'management', 'staffing', 'admin', 'absence-distribution', 'late-report', 'requests', 'location'];

const App: React.FC = () => {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [currentView, setCurrentView] = useState<View>('dashboard');
  const [error, setError] = useState<string | null>(null);
  const [isSidebarOpen, setSidebarOpen] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [checkingSession, setCheckingSession] = useState(true);
  const [isGpsModalOpen, setGpsModalOpen] = useState(false);
  const [isNewsOpen, setNewsOpen] = useState(false);
  const [pendingRequests, setPendingRequests] = useState(0);
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
                // A sessão fica salva: quem abre o app já logado também precisa ver o pedido do GPS
                setGpsModalOpen(GPS_OBRIGATORIO);
                if (MOSTRAR_NOVIDADES) conferirNovidades(user.id).then(setNewsOpen);
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

  // Se a sessão cair (login vencido que não renovou), volta para a tela de login.
  // Sem isso, o app continuava "logado" na tela, mas o banco recebia as consultas como
  // visitante: algumas telas vinham vazias e "Ganhos" dava erro.
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_OUT') {
        setCurrentUser(null);
        setIsAdmin(false);
        setCurrentView('dashboard');
      }
    });
    return () => subscription.unsubscribe();
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

  // Pedidos aguardando decisão: aviso no menu do admin, atualizado a cada troca de tela
  const refreshPendingRequests = useCallback(async () => {
    setPendingRequests(isAdmin ? await contarPedidosPendentes() : 0);
  }, [isAdmin]);

  useEffect(() => {
    refreshPendingRequests();
  }, [refreshPendingRequests, currentView]);

  const handleLogin = async (email: string, password_cleartext: string): Promise<boolean> => {
    setError(null);
    try {
        const user = await signIn(email.trim(), password_cleartext);
        setCurrentUser(user);
        setGpsModalOpen(GPS_OBRIGATORIO);
        if (MOSTRAR_NOVIDADES) conferirNovidades(user.id).then(setNewsOpen);
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

  const handleCloseNews = () => {
    if (currentUser) marcarNovidadesVistas(currentUser.id);
    setNewsOpen(false);
  };

  // O GPS é conferido de novo sempre que o médico volta para o app. Se estiver desligado ou
  // bloqueado, o pedido para ativar aparece outra vez.
  const currentUserId = currentUser?.id;
  useEffect(() => {
    if (!currentUserId || !GPS_OBRIGATORIO) return;

    const conferirGps = async () => {
      if (document.visibilityState !== 'visible') return;
      const { ativo } = await verificarGps();
      if (!ativo) setGpsModalOpen(true);
    };

    document.addEventListener('visibilitychange', conferirGps);
    return () => document.removeEventListener('visibilitychange', conferirGps);
  }, [currentUserId]);

  const handleLogout = async () => {
    await signOut();
    setCurrentUser(null);
    setIsAdmin(false);
    setGpsModalOpen(false);
    setNewsOpen(false);
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

  // A tela nova monta depois do toque, para não atrasar a animação da barra inferior
  const deferredView = useDeferredValue(currentView);

  const MainContent = useMemo(() => {
    // Quem não é admin nunca renderiza telas administrativas
    const view: View = ADMIN_VIEWS.includes(deferredView) && !isAdmin ? 'dashboard' : deferredView;

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
      case 'late-report':
        return <LateReport />;
      case 'requests':
        return <Requests currentUser={currentUser!} onDecided={refreshPendingRequests} />;
      case 'location':
        return <LocationReport />;
      default:
        return <Dashboard currentUser={currentUser!} isAdmin={isAdmin} />;
    }
  }, [deferredView, currentUser, isAdmin, refreshPendingRequests]);

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
        pendingRequests={pendingRequests}
      />

      <div className="flex flex-col flex-grow min-h-screen lg:ml-64 transition-all duration-300">
        <Header
          user={currentUser}
          onLogout={handleLogout}
          onMenuClick={() => setSidebarOpen(true)}
          theme={theme}
          setTheme={setTheme}
          onHelpClick={MOSTRAR_NOVIDADES ? () => setNewsOpen(true) : undefined}
        />
        <main className="p-4 sm:p-6 lg:p-8 flex-grow pb-24 lg:pb-8">
          {MainContent}
        </main>
      </div>

      {/* As novidades aparecem primeiro; o pedido do GPS vem depois de fechar */}
      <GpsModal isOpen={isGpsModalOpen && !isNewsOpen} onClose={() => setGpsModalOpen(false)} />
      <WhatsNewModal isOpen={isNewsOpen} onClose={handleCloseNews} isAdmin={isAdmin} />
    </div>
  );
};

export default App;

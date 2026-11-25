
import React from 'react';
import LogoIcon from './LogoIcon';
import RelogioEnfeite from './RelogioEnfeite';
import { User, View } from '../types';

interface SidebarProps {
  user: User;
  currentView: View;
  setCurrentView: (view: View) => void;
  isOpen: boolean; // Not used in bottom nav but kept for desktop legacy
  setIsOpen: (isOpen: boolean) => void;
  isAdmin?: boolean;
  /** Pedidos aguardando decisão (só admin) */
  pendingRequests?: number;
}

/**
 * Desenhos dos ícones (traço, 24x24). Cada tela tem um só, usado no menu lateral, na barra de baixo
 * e no menu flutuante do admin. Para trocar um ícone, troque o caminho aqui.
 */
const CAMINHOS = {
  inicio: ['M2.25 12l8.954-8.955c.44-.439 1.152-.439 1.591 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75M8.25 21h8.25'],
  meusPontos: ['M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z'],
  ganhos: ['M12 6v12m-3-2.818l.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 11-18 0 9 9 0 0118 0z'],
  relatorios: ['M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z'],
  escala: ['M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0h18M9.75 14.25h4.5'],
  // Cédulas: diferente da moeda de "Ganhos" (antes era só um cifrão solto)
  financeiro: ['M2.25 18.75a60.07 60.07 0 0115.797 2.101c.727.198 1.453-.342 1.453-1.096V18.75M3.75 4.5v.75A.75.75 0 013 6h-.75m0 0v-.375c0-.621.504-1.125 1.125-1.125H20.25M2.25 6v9m18-10.5v.75c0 .414.336.75.75.75h.75m-1.5-1.5h.375c.621 0 1.125.504 1.125 1.125v9.75c0 .621-.504 1.125-1.125 1.125h-.375m1.5-1.5H21a.75.75 0 00-.75.75v.75m0 0H3.75m0 0h-.375a1.125 1.125 0 01-1.125-1.125V15m1.5 1.5v-.75A.75.75 0 003 15h-.75M15 10.5a3 3 0 11-6 0 3 3 0 016 0zm3 0h.008v.008H18V10.5zm-12 0h.008v.008H6V10.5z'],
  gerencia: ['M10.5 6h9.75M10.5 6a1.5 1.5 0 11-3 0m3 0a1.5 1.5 0 10-3 0M3.75 6H7.5m3 12h9.75m-9.75 0a1.5 1.5 0 11-3 0m3 0a1.5 1.5 0 10-3 0m-3.75 0H7.5m9-6h3.75m-3.75 0a1.5 1.5 0 11-3 0m3 0a1.5 1.5 0 10-3 0m-9.75 0h6'],
  pedidos: ['M2.25 13.5h3.86a2.25 2.25 0 012.012 1.244l.256.512a2.25 2.25 0 002.013 1.244h3.218a2.25 2.25 0 002.013-1.244l.256-.512a2.25 2.25 0 012.013-1.244h3.859m-19.5.338V18a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18v-4.162c0-.224-.034-.447-.1-.661L19.24 5.338a2.25 2.25 0 00-2.15-1.588H6.911a2.25 2.25 0 00-2.15 1.588L2.35 13.177a2.25 2.25 0 00-.1.661z'],
  atrasos: ['M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z'],
  localizacao: ['M15 10.5a3 3 0 11-6 0 3 3 0 016 0z', 'M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z'],
  distribuicao: ['M18 18.72a9.094 9.094 0 003.741-.479 3 3 0 00-4.682-2.72m.94 3.198l.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0112 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 016 18.719m12 0a5.971 5.971 0 00-.941-3.197m0 0A5.995 5.995 0 0012 12.75a5.995 5.995 0 00-5.058 2.772m0 0a3 3 0 00-4.681 2.72 8.986 8.986 0 003.74.477m.94-3.197a5.971 5.971 0 00-.94 3.197M15 6.75a3 3 0 11-6 0 3 3 0 016 0zm6 3a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0zm-13.5 0a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0z'],
  perfil: ['M17.982 18.725A7.488 7.488 0 0012 15.75a7.488 7.488 0 00-5.982 2.975m11.963 0a9 9 0 10-11.963 0m11.963 0A8.966 8.966 0 0112 21a8.966 8.966 0 01-5.982-2.275M15 9.75a3 3 0 11-6 0 3 3 0 016 0z'],
  // Escudo: área só do administrador
  admin: ['M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z'],
};

type NomeIcone = keyof typeof CAMINHOS;

const Icone: React.FC<{ nome: NomeIcone; className?: string; traco?: number }> = ({ nome, className = 'w-6 h-6', traco = 1.5 }) => (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={traco} stroke="currentColor" className={className} aria-hidden="true">
        {CAMINHOS[nome].map(d => <path key={d} strokeLinecap="round" strokeLinejoin="round" d={d} />)}
    </svg>
);

interface Item {
    view: View;
    label: string;
    icone: NomeIcone;
}

const INICIO: Item = { view: 'dashboard', label: 'Início', icone: 'inicio' };
const MEUS_PONTOS: Item = { view: 'my-records', label: 'Meus Pontos', icone: 'meusPontos' };
const GANHOS: Item = { view: 'earnings', label: 'Ganhos', icone: 'ganhos' };
const RELATORIOS: Item = { view: 'reports', label: 'Relatórios', icone: 'relatorios' };
const PERFIL: Item = { view: 'profile', label: 'Perfil', icone: 'perfil' };
const ESCALA: Item = { view: 'staffing', label: 'Escala', icone: 'escala' };
const FINANCEIRO: Item = { view: 'financial', label: 'Financeiro', icone: 'financeiro' };
const GERENCIA: Item = { view: 'management', label: 'Gerência', icone: 'gerencia' };
const PEDIDOS: Item = { view: 'requests', label: 'Pedidos', icone: 'pedidos' };
const ATRASOS: Item = { view: 'late-report', label: 'Atrasos', icone: 'atrasos' };
const LOCALIZACAO: Item = { view: 'location', label: 'Localização', icone: 'localizacao' };
const DISTRIBUICAO: Item = { view: 'absence-distribution', label: 'Distribuição', icone: 'distribuicao' };
const ADMIN: Item = { view: 'admin', label: 'Admin', icone: 'admin' };

// Menu lateral (computador): todos primeiro, depois as telas do admin
const LATERAL_TODOS: Item[] = [INICIO, MEUS_PONTOS, GANHOS, RELATORIOS];
const LATERAL_ADMIN: Item[] = [ESCALA, FINANCEIRO, GERENCIA, PEDIDOS, ATRASOS, LOCALIZACAO, DISTRIBUICAO];

// Barra de baixo (celular), na ordem em que as abas aparecem: a bolha da aba ativa usa esta ordem
const ABAS_CELULAR: Item[] = [INICIO, MEUS_PONTOS, GANHOS, RELATORIOS, PERFIL];

// Menu flutuante do admin (celular)
const MENU_ADMIN_CELULAR: Item[] = [ESCALA, FINANCEIRO, GERENCIA, RELATORIOS, PEDIDOS, ATRASOS, LOCALIZACAO, DISTRIBUICAO, ADMIN];

/**
 * Linha do menu lateral. A tela aberta vira uma "aba" da cor do fundo da página, que encosta na
 * borda direita do menu e parece continuar no conteúdo; os dois cantinhos curvos (em cima e embaixo)
 * são feitos com sombra da mesma cor do fundo da página (#F8FAFC no claro, #0F172A no escuro).
 */
const LinkLateral: React.FC<{ item: Item; ativo: boolean; onClick: () => void; aviso?: number }> = ({ item, ativo, onClick, aviso }) => (
    <li className="relative">
        {ativo && (
            <>
                <span aria-hidden="true" className="pointer-events-none absolute right-0 -top-4 z-10 h-4 w-4 rounded-br-2xl shadow-[6px_6px_0_6px_#F8FAFC] dark:shadow-[6px_6px_0_6px_#0F172A]"></span>
                <span aria-hidden="true" className="pointer-events-none absolute right-0 -bottom-4 z-10 h-4 w-4 rounded-tr-2xl shadow-[6px_-6px_0_6px_#F8FAFC] dark:shadow-[6px_-6px_0_6px_#0F172A]"></span>
            </>
        )}
        <button
            onClick={onClick}
            aria-current={ativo ? 'page' : undefined}
            className={`group flex w-full items-center gap-3 rounded-l-full py-1.5 pl-1.5 pr-4 text-[0.9375rem] transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-pmp-primary ${
                ativo
                    ? 'bg-pmp-background font-semibold text-pmp-primary dark:bg-dark-pmp-background dark:text-dark-pmp-primary-light'
                    : 'text-slate-700 hover:bg-white/70 hover:text-pmp-primary-dark dark:text-slate-300 dark:hover:bg-slate-700/50 dark:hover:text-dark-pmp-text-primary'
            }`}
        >
            <span
                className={`flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full transition-colors ${
                    ativo
                        ? 'bg-pmp-primary text-white shadow-sm dark:bg-dark-pmp-primary'
                        : 'bg-white text-pmp-primary shadow-sm shadow-pmp-primary/10 dark:bg-slate-700/60 dark:text-slate-300 dark:shadow-none dark:group-hover:text-dark-pmp-primary-light'
                }`}
            >
                <Icone nome={item.icone} className="h-5 w-5" traco={1.7} />
            </span>
            <span>{item.label}</span>
            {aviso ? (
                <span className="ml-auto min-w-[22px] h-[22px] px-1.5 rounded-full bg-red-600 text-white text-xs font-bold flex items-center justify-center" aria-label={`${aviso} aguardando`}>{aviso}</span>
            ) : null}
        </button>
    </li>
);

/** Aba da barra de baixo (celular) */
const AbaCelular: React.FC<{ item: Item; ativo: boolean; onClick: () => void }> = ({ item, ativo, onClick }) => (
    <button
        onClick={onClick}
        aria-current={ativo ? 'page' : undefined}
        className={`flex flex-col items-center justify-center flex-1 min-w-0 py-2 px-1 transition-colors relative ${
            ativo ? 'text-pmp-primary dark:text-dark-pmp-primary-light' : 'text-pmp-text-secondary dark:text-dark-pmp-text-secondary'
        }`}
    >
        {/* O ícone sobe para dentro da bolha; o delay deixa ela chegar antes de ele ficar branco */}
        <span className={`mb-1 transition-[transform,color] duration-300 ease-in-out motion-reduce:transition-none ${ativo ? '-translate-y-3 text-white delay-[250ms]' : ''}`}>
            <Icone nome={item.icone} />
        </span>
        <span className="text-[10px] font-medium whitespace-nowrap">{item.label}</span>
    </button>
);

const Sidebar: React.FC<SidebarProps> = ({ user, currentView, setCurrentView, isOpen, setIsOpen, isAdmin = false, pendingRequests = 0 }) => {
    const [showAdminMenu, setShowAdminMenu] = React.useState(false);

    const handleNavClick = (view: View) => {
        setCurrentView(view);
        setIsOpen(false);
        setShowAdminMenu(false);
    };

    const linkLateral = (item: Item) => (
        <LinkLateral
            key={item.view}
            item={item}
            ativo={currentView === item.view}
            onClick={() => handleNavClick(item.view)}
            aviso={item.view === 'requests' ? pendingRequests : undefined}
        />
    );

    // Telas que só abrem pelo menu flutuante: nelas o botão redondo fica colorido
    const emTelaDoMenuAdmin = MENU_ADMIN_CELULAR.some(item => item.view === currentView);

    return (
    <>
      {/* Menu lateral (computador): verdinho claro no modo claro (a cor do app a 10% sobre o branco),
          com a tela aberta em destaque e um relógio no pé */}
      <aside className="fixed top-0 left-0 z-40 w-64 h-screen transition-transform -translate-x-full lg:translate-x-0 bg-pmp-surface dark:bg-dark-pmp-surface no-print" aria-label="Sidebar">
        <div className="relative h-full bg-pmp-primary/10 dark:bg-transparent">
          <RelogioEnfeite className="absolute inset-x-0 bottom-0 w-full" />
          <div className="relative z-10 h-full overflow-y-auto overflow-x-hidden flex flex-col py-4 pl-3">
            <div className="flex items-center h-16 mb-3 pl-2 pr-3 flex-shrink-0">
                <div className="font-display text-[1.375rem] font-semibold tracking-tight text-pmp-primary-dark dark:text-dark-pmp-primary-light flex items-center gap-3">
                  <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-pmp-primary text-white shadow-sm dark:bg-dark-pmp-primary">
                    <LogoIcon className="h-7 w-7" />
                  </span>
                  Ponto Kids
                </div>
            </div>
            <ul className="space-y-1 font-medium flex-grow pb-28">
                {LATERAL_TODOS.map(linkLateral)}

                {isAdmin && (
                  <>
                    <li aria-hidden="true" className="!my-3 mr-3 border-t border-pmp-primary/15 dark:border-gray-700"></li>
                    {LATERAL_ADMIN.map(linkLateral)}
                  </>
                )}

                {linkLateral(PERFIL)}

                {/* 🔐 ADMIN ONLY */}
                {isAdmin && linkLateral(ADMIN)}
            </ul>
          </div>
        </div>
      </aside>

      {/* Mobile/Tablet Bottom Navigation Bar */}
      <nav className="fixed bottom-0 left-0 z-50 w-full h-16 bg-pmp-surface/90 dark:bg-dark-pmp-surface/90 backdrop-blur-lg border-t border-gray-200 dark:border-gray-700 lg:hidden flex items-center justify-around px-2 no-print safe-area-bottom">
          {/* Bolha da aba ativa: cada 100% anda uma aba. Em telas fora da barra (índice -1) ela sai pela esquerda. */}
          <div className="absolute inset-y-0 inset-x-2 pointer-events-none">
            <div
              className="h-full w-1/5 flex justify-center transition-transform duration-500 ease-in-out will-change-transform motion-reduce:transition-none"
              style={{ transform: `translateX(${ABAS_CELULAR.findIndex(item => item.view === currentView) * 100}%)` }}
            >
              <span className="-mt-3 w-11 h-11 rounded-full bg-pmp-primary dark:bg-dark-pmp-primary shadow-lg ring-4 ring-pmp-primary/20 dark:ring-dark-pmp-primary/25"></span>
            </div>
          </div>
          {ABAS_CELULAR.map(item => (
            <AbaCelular key={item.view} item={item} ativo={currentView === item.view} onClick={() => handleNavClick(item.view)} />
          ))}
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

              {/* Menu de Opções Admin: abre ACIMA do botão redondo (que fica em bottom-20, com 56px de altura),
                  sem encostar nele. Em tela baixa a lista rola em vez de sair por cima da tela.
                  p-2/-m-2: folga para a sombra dos itens não ser cortada pela rolagem. */}
              <div className="lg:hidden fixed bottom-[9.5rem] right-4 z-50 flex flex-col gap-2 no-print max-h-[calc(100vh-10.5rem)] max-h-[calc(100dvh-10.5rem)] overflow-y-auto overscroll-contain p-2 -m-2">
                {MENU_ADMIN_CELULAR.map(item => {
                  const ativo = currentView === item.view;
                  return (
                    <button
                      key={item.view}
                      onClick={() => handleNavClick(item.view)}
                      aria-current={ativo ? 'page' : undefined}
                      className={`flex flex-shrink-0 items-center gap-3 rounded-xl py-1.5 pl-1.5 pr-4 shadow-lg transition-colors ${
                        ativo
                          ? 'bg-pmp-primary text-white'
                          : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200'
                      }`}
                    >
                      <span className={`flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-[0.625rem] ${
                        ativo ? 'bg-white/20 text-white' : 'bg-pmp-primary/10 text-pmp-primary dark:bg-dark-pmp-primary/20 dark:text-dark-pmp-primary-light'
                      }`}>
                        <Icone nome={item.icone} className="h-5 w-5" traco={1.7} />
                      </span>
                      <span className="font-medium text-sm">{item.label}</span>
                      {item.view === 'requests' && pendingRequests > 0 && (
                        <span className="ml-auto min-w-[22px] h-[22px] px-1.5 rounded-full bg-red-600 text-white text-xs font-bold flex items-center justify-center">{pendingRequests}</span>
                      )}
                    </button>
                  );
                })}
              </div>
            </>
          )}

          {/* Botão Principal */}
          <button
            onClick={() => setShowAdminMenu(!showAdminMenu)}
            className={`lg:hidden fixed bottom-20 right-4 z-50 w-14 h-14 rounded-full shadow-2xl flex items-center justify-center transition-all duration-300 ease-out hover:scale-110 active:scale-95 no-print ${
              // Sempre na cor do app (antes ficava cinza-escuro fora das telas do admin, destoando no modo claro).
              // O anel em volta marca o menu aberto ou uma tela do admin.
              showAdminMenu || emTelaDoMenuAdmin
                ? 'bg-pmp-primary dark:bg-dark-pmp-primary text-white ring-4 ring-pmp-primary/30 dark:ring-dark-pmp-primary/40'
                : 'bg-pmp-primary dark:bg-dark-pmp-primary text-white'
            }`}
            aria-label="Menu Admin"
            aria-expanded={showAdminMenu}
          >
            {pendingRequests > 0 && !showAdminMenu && (
              <span className="absolute -top-1 -right-1 min-w-[22px] h-[22px] px-1.5 rounded-full bg-red-600 text-white text-xs font-bold flex items-center justify-center ring-2 ring-white dark:ring-gray-900" aria-label={`${pendingRequests} pedidos aguardando`}>{pendingRequests}</span>
            )}
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

import React from 'react';
import LogoIcon from './LogoIcon';

/** Tela de abertura: aparece assim que a página abre e enquanto o app confere se você já está logado. */
const SplashScreen: React.FC = () => (
    <div className="min-h-screen flex flex-col items-center justify-center gap-5 bg-pmp-background dark:bg-dark-pmp-background" role="status" aria-label="Carregando">
        <div className="w-24 h-24 rounded-3xl bg-gradient-to-br from-pmp-primary to-pmp-secondary flex items-center justify-center shadow-xl animate-pulse">
            <LogoIcon className="w-16 h-16 text-white" />
        </div>
        <h1 className="text-3xl font-bold tracking-tight text-pmp-text-primary dark:text-dark-pmp-text-primary">Ponto Kids</h1>
    </div>
);

export default SplashScreen;

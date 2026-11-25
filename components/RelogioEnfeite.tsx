import React from 'react';

// Tracinhos das horas: só a metade de cima do relógio aparece (de 9h a 3h)
const TRACOS = [-90, -60, -30, 0, 30, 60, 90].map(graus => {
    const rad = (graus * Math.PI) / 180;
    const comprido = graus % 90 === 0;
    const de = comprido ? 96 : 101;
    return {
        graus,
        x1: 128 + de * Math.sin(rad),
        y1: 150 - de * Math.cos(rad),
        x2: 128 + 110 * Math.sin(rad),
        y2: 150 - 110 * Math.cos(rad),
        largura: comprido ? 4 : 2.5,
    };
});

/**
 * Enfeite do app: um relógio grande e bem clarinho, na cor do app, aparecendo pela metade.
 * Fica no pé do menu lateral (computador) e no fundo da tela, atrás do conteúdo (celular).
 * Quem usa decide a posição pelo className; o desenho não recebe cliques.
 */
const RelogioEnfeite: React.FC<{ className?: string }> = ({ className = '' }) => (
    <svg
        viewBox="0 0 256 150"
        className={`pointer-events-none text-pmp-primary dark:text-dark-pmp-primary-light dark:opacity-50 ${className}`}
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        aria-hidden="true"
    >
        <circle cx="128" cy="150" r="122" strokeWidth="9" opacity=".10" />
        <circle cx="128" cy="150" r="88" strokeWidth="1.5" opacity=".14" />
        <g opacity=".22">
            {TRACOS.map(t => (
                <line key={t.graus} x1={t.x1} y1={t.y1} x2={t.x2} y2={t.y2} strokeWidth={t.largura} />
            ))}
        </g>
        {/* ponteiros marcando 10h10 */}
        <g strokeWidth="7" opacity=".16">
            <line x1="128" y1="150" x2="80" y2="122" />
            <line x1="128" y1="150" x2="198" y2="110" />
        </g>
        <circle cx="128" cy="150" r="10" fill="currentColor" stroke="none" opacity=".24" />
    </svg>
);

export default RelogioEnfeite;

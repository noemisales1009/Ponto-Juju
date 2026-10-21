import React from 'react';

/**
 * Ícone do app: um relógio (disco branco com ponteiros) abraçado pelos fones de um estetoscópio
 * (com as olivas viradas para dentro), cujo tubo termina em um coração. Saúde + cuidado + ponto/plantão.
 * É o único lugar do desenho no app: logo do menu, do topo no celular, da tela de login e da abertura.
 * Para trocar o desenho, altere só os elementos abaixo (e o public/favicon.svg, que tem o mesmo desenho).
 */
const LogoIcon: React.FC<{ className?: string }> = ({ className = 'h-7 w-7' }) => (
    <svg xmlns="http://www.w3.org/2000/svg" className={className} viewBox="0 0 24 24" aria-hidden="true">
        {/* os ponteiros são vazados no disco, assim o relógio aparece em qualquer cor de fundo */}
        <mask id="logo-ponteiros">
            <rect x={-2} y={-2} width={28} height={28} fill="#fff" />
            <path d="M11 10.4V6.9M11 10.4l2.3 1.5" stroke="#000" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round" fill="none" />
        </mask>
        <g transform="translate(-0.5 0)">
            <g fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                <path d="M6.8 3.4Q4 3.4 4 6.2V10.4a7 7 0 0 0 14 0V6.2Q18 3.4 15.2 3.4" />
                <path d="M11 17.4C11 21 14 22.1 16.7 20.5" />
            </g>
            <g fill="currentColor">
                <ellipse cx="7.9" cy="3.4" rx="1.9" ry="1.25" />
                <ellipse cx="14.1" cy="3.4" rx="1.9" ry="1.25" />
                <g transform="translate(15.8 16) scale(0.3)">
                    <path d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12z" />
                </g>
                <circle cx="11" cy="10.4" r="5" mask="url(#logo-ponteiros)" />
            </g>
        </g>
    </svg>
);

export default LogoIcon;

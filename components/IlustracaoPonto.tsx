import React from 'react';

/**
 * Ilustração de enfeite do fundo: a médica batendo o ponto no celular.
 * A imagem foi enviada pela Noemi (25/11/2026) e fica em public/ilustracao-ponto.webp
 * (fundo transparente, 720x825). Para trocar a ilustração, basta substituir esse arquivo.
 *
 * Quem usa decide posição, tamanho e transparência pelo className. A classe "enfeite-entrada"
 * (index.html) faz a imagem subir e aparecer uma vez, quando a pessoa entra no app.
 * Não recebe cliques e é ignorada por leitores de tela.
 */
const IlustracaoPonto: React.FC<{ className?: string }> = ({ className = '' }) => (
    <div className={`pointer-events-none ${className}`} aria-hidden="true">
        <img
            src={`${import.meta.env.BASE_URL}ilustracao-ponto.webp`}
            alt=""
            width={720}
            height={825}
            decoding="async"
            draggable={false}
            className="enfeite-entrada block h-auto w-full select-none"
        />
    </div>
);

export default IlustracaoPonto;

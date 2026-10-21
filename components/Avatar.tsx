import React from 'react';

interface AvatarProps {
    name: string;
    photoUrl?: string | null;
    /** Tamanho e extras do círculo (ex.: "h-8 w-8") */
    className?: string;
    /** Tamanho da letra das iniciais */
    textClass?: string;
}

const getInitials = (name: string): string =>
    name.trim().split(/\s+/).filter(Boolean).slice(0, 2).map(part => part[0]).join('').toUpperCase() || '?';

/**
 * Foto do usuário ou, se não houver, um círculo com as iniciais na cor principal do app.
 * Desenhado no próprio app: não envia o nome da pessoa para nenhum serviço externo.
 */
const Avatar: React.FC<AvatarProps> = ({ name, photoUrl, className = 'h-8 w-8', textClass = 'text-xs' }) => {
    if (photoUrl) {
        return <img src={photoUrl} alt={`Foto de ${name}`} className={`${className} rounded-full object-cover`} />;
    }

    return (
        <div
            role="img"
            aria-label={name}
            className={`${className} ${textClass} rounded-full bg-pmp-primary dark:bg-dark-pmp-primary text-white flex items-center justify-center font-semibold select-none flex-shrink-0`}
        >
            {getInitials(name)}
        </div>
    );
};

export default Avatar;

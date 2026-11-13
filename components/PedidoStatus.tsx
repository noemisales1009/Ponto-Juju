import React from 'react';
import { PontoPedido } from '../types';

const STATUS: Record<PontoPedido['status'], { label: string; className: string }> = {
    pendente: {
        label: 'Aguardando aprovação',
        className: 'bg-amber-100 dark:bg-amber-500/20 text-amber-800 dark:text-amber-300',
    },
    aprovado: {
        label: 'Aprovado',
        className: 'bg-green-100 dark:bg-green-500/20 text-green-800 dark:text-green-300',
    },
    recusado: {
        label: 'Recusado',
        className: 'bg-red-100 dark:bg-red-500/20 text-red-800 dark:text-red-300',
    },
};

export const TIPO_PEDIDO_LABEL: Record<PontoPedido['tipo'], string> = {
    atraso: 'Justificativa de atraso',
    esquecido: 'Ponto esquecido',
};

const PedidoStatus: React.FC<{ status: PontoPedido['status'] }> = ({ status }) => (
    <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium whitespace-nowrap ${STATUS[status].className}`}>
        {STATUS[status].label}
    </span>
);

export default PedidoStatus;

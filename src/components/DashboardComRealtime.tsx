import React, { useEffect, useState } from 'react';
import { escutarMudancasPontos, pararDEscutar } from '../services/realtimeService';
import { buscarHistoricoPontos } from '../services/pontoService';

interface PontoExemplo {
  id: number;
  user_id: string;
  data: string;
  turno: string;
  valor_plantao: number;
  dia_semana_calculado: string;
}

interface Props {
  userId: string;
}

const DashboardComRealtime: React.FC<Props> = ({ userId }) => {
  const [pontos, setPontos] = useState<PontoExemplo[]>([]);
  const [loading, setLoading] = useState(true);
  const [subscription, setSubscription] = useState<any>(null);

  useEffect(() => {
    // 1. Carregar pontos iniciais do banco
    const carregarPontos = async () => {
      const historico = await buscarHistoricoPontos(userId);
      setPontos(historico as PontoExemplo[]);
      setLoading(false);
    };

    carregarPontos();

    // 2. Configurar listener real-time
    const sub = escutarMudancasPontos(userId, (novoPonto) => {
      console.log('🔄 Ponto recebido em tempo real:', novoPonto);

      // Atualizar estado com novo ponto
      setPontos((prev) => {
        // Verificar se já existe (update)
        const existe = prev.find((p) => p.id === novoPonto.id);
        if (existe) {
          // Atualizar ponto existente
          return prev.map((p) => (p.id === novoPonto.id ? novoPonto : p));
        } else {
          // Adicionar novo ponto
          return [novoPonto, ...prev];
        }
      });

      // Mostrar notificação
      mostrarNotificacao('Ponto atualizado!', 'success');
    });

    setSubscription(sub);

    // 3. Cleanup: desconectar ao sair do component
    return () => {
      if (sub) {
        pararDEscutar(sub);
      }
    };
  }, [userId]);

  const mostrarNotificacao = (mensagem: string, tipo: 'success' | 'error' | 'info') => {
    // Você pode usar toast, alert ou qualquer notificação
    console.log(`[${tipo.toUpperCase()}] ${mensagem}`);
  };

  if (loading) {
    return <div>Carregando pontos...</div>;
  }

  return (
    <div className="dashboard">
      <h2>Meus Pontos (Com Atualização em Tempo Real)</h2>

      {pontos.length === 0 ? (
        <p>Nenhum ponto registrado</p>
      ) : (
        <table>
          <thead>
            <tr>
              <th>Data</th>
              <th>Turno</th>
              <th>Dia</th>
              <th>Valor</th>
            </tr>
          </thead>
          <tbody>
            {pontos.map((ponto) => (
              <tr key={ponto.id}>
                <td>{new Date(ponto.data).toLocaleDateString('pt-BR')}</td>
                <td>{ponto.turno}</td>
                <td>{ponto.dia_semana_calculado}</td>
                <td>R$ {ponto.valor_plantao?.toFixed(2)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
};

export default DashboardComRealtime;

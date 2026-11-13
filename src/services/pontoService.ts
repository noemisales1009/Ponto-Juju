import { supabase } from '../../services/supabaseClient';
import { GPS_OBRIGATORIO, LOCAL_PONTO, SECTOR_ID_MAP, SHIFT_FULL_NAME_MAP, SHIFT_START_HOUR, matchesShift } from '../../constants';
import { Shift } from '../../types';
import { formatDateBR, formatDateISO, getTodayLocal, isValidDateISO } from '../../utils/date';
import { friendlyError } from '../../utils/errors';

const VALID_SHIFTS = Object.keys(SHIFT_FULL_NAME_MAP);
const VALID_SECTOR_IDS = Object.values(SECTOR_ID_MAP);

// Aceita "YYYY-MM-DD" (preferido) ou Date local
const toDateISO = (data: string | Date): string =>
  typeof data === 'string' ? data : formatDateISO(data);

interface Localizacao {
  latitude: number;
  longitude: number;
  precisao_metros: number;
}

/**
 * 📏 Distância em metros entre dois pontos (fórmula de Haversine)
 */
const calcularDistanciaMetros = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
  const paraRadianos = (graus: number) => (graus * Math.PI) / 180;
  const dLat = paraRadianos(lat2 - lat1);
  const dLon = paraRadianos(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(paraRadianos(lat1)) * Math.cos(paraRadianos(lat2)) * Math.sin(dLon / 2) ** 2;

  return 2 * 6371000 * Math.asin(Math.sqrt(a));
};

const ERRO_SEM_GPS = 'Este aparelho não permite obter a localização. Use um celular com GPS para bater o ponto.';

const mensagemErroGps = (erro: GeolocationPositionError): string =>
  erro.code === erro.PERMISSION_DENIED
    ? 'Localização bloqueada. Ative a localização do aparelho e permita o acesso neste app para bater o ponto.'
    : 'Não foi possível obter sua localização. Verifique se o GPS está ligado e tente novamente.';

/**
 * 📡 Pedir a localização só para confirmar que o GPS está ligado e permitido (usado ao entrar no app)
 * Sem alta precisão: dentro do hospital ela demora e daria alarme falso com o GPS ligado.
 */
export const verificarGps = (): Promise<{ ativo: boolean; erro?: string }> =>
  new Promise((resolve) => {
    if (!navigator.geolocation) {
      resolve({ ativo: false, erro: ERRO_SEM_GPS });
      return;
    }

    navigator.geolocation.getCurrentPosition(
      () => resolve({ ativo: true }),
      (erro) => {
        console.error('Erro ao verificar o GPS:', erro);
        resolve({ ativo: false, erro: mensagemErroGps(erro) });
      },
      { timeout: 15000, maximumAge: 0 }
    );
  });

/**
 * 📍 Obter a posição do aparelho e confirmar que ele está no hospital
 */
// semGps: o aparelho não entregou nenhuma posição (bloqueada, sem sinal, sem suporte).
// É diferente de estar fora do hospital, que continua sendo recusado.
type ResultadoLocalizacao = { localizacao?: Localizacao; erro?: string; semGps?: string; fora?: boolean };

const MOTIVO_SEM_GPS: Record<number, string> = {
  1: 'Localização bloqueada no aparelho ou no navegador',
  2: 'Aparelho não conseguiu obter a posição',
  3: 'Tempo esgotado ao buscar a posição',
};

const pedirPosicao = (altaPrecisao: boolean): Promise<ResultadoLocalizacao> =>
  new Promise((resolve) => {
    if (!navigator.geolocation) {
      resolve({ erro: ERRO_SEM_GPS, semGps: 'Navegador sem suporte a localização' });
      return;
    }

    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        const distancia = calcularDistanciaMetros(
          coords.latitude,
          coords.longitude,
          LOCAL_PONTO.latitude,
          LOCAL_PONTO.longitude
        );

        if (distancia > LOCAL_PONTO.raioMetros) {
          const distanciaTexto = distancia < 1000
            ? `${Math.round(distancia)} m`
            : `${(distancia / 1000).toFixed(1).replace('.', ',')} km`;
          resolve({
            erro: `Você está a ${distanciaTexto} do ${LOCAL_PONTO.nome}. O ponto só pode ser batido no hospital.`,
            // GPS não obrigatório: o ponto é aceito e a distância fica registrada para o admin
            semGps: GPS_OBRIGATORIO ? undefined : `Fora do raio: ${distanciaTexto} do hospital (precisão ${Math.round(coords.accuracy)} m)`,
            fora: true,
          });
          return;
        }

        resolve({
          localizacao: {
            latitude: coords.latitude,
            longitude: coords.longitude,
            precisao_metros: coords.accuracy,
          },
        });
      },
      (erro) => {
        console.error('Erro ao obter localização:', erro);
        resolve({
          erro: mensagemErroGps(erro),
          semGps: `${MOTIVO_SEM_GPS[erro.code] ?? 'Erro de localização'}${erro.message ? ` (${erro.message})` : ''}`,
        });
      },
      // Com o GPS não obrigatório a espera é curta: o médico não fica parado esperando o aparelho
      {
        enableHighAccuracy: altaPrecisao,
        timeout: GPS_OBRIGATORIO ? (altaPrecisao ? 15000 : 10000) : (altaPrecisao ? 8000 : 5000),
        maximumAge: 0,
      }
    );
  });

/**
 * 📍 Obter a posição do aparelho e confirmar que ele está no hospital.
 * Em ambiente fechado o GPS de alta precisão pode não responder (comum no iPhone): se falhar,
 * tenta de novo com a posição aproximada (Wi-Fi/rede) antes de desistir.
 */
const obterLocalizacaoNoHospital = async (): Promise<ResultadoLocalizacao> => {
  const primeira = await pedirPosicao(true);
  if (!primeira.semGps || primeira.fora || !navigator.geolocation) return primeira;

  const segunda = await pedirPosicao(false);
  return segunda.semGps ? { ...segunda, semGps: primeira.semGps } : segunda;
};

/**
 * ✅ Verificar se o médico já bateu ponto no MESMO TURNO
 * Permite múltiplos turnos no mesmo dia, mas não permite duplicar o mesmo turno
 */
export const verificarPontoDuplicado = async (
  userId: string | number,
  data: string | Date,
  turno: string
): Promise<{ pode_bater: boolean; mensagem?: string }> => {
  const dataDia = toDateISO(data);

  // Buscar TODOS os pontos do dia para este usuário
  const { data: registros, error } = await supabase
    .from('ponto_juju2')
    .select('id, turno')
    .eq('user_id', userId)
    .eq('data_dia', dataDia);

  if (error) {
    console.error('Erro ao verificar ponto duplicado:', error);
    return {
      pode_bater: false,
      mensagem: 'Não foi possível verificar o histórico de ponto. Tente novamente.',
    };
  }

  // Aceita variações do nome (ex: "Manhã" combina com "Manhã Semana (07h - 13h)")
  const jaBateuNesteTurno = (registros || []).some(r => matchesShift(r.turno, turno as Shift));

  if (jaBateuNesteTurno) {
    return {
      pode_bater: false,
      mensagem: `⚠️ Você já registrou o turno da ${turno} em ${formatDateBR(dataDia)}.`,
    };
  }

  return { pode_bater: true };
};

/**
 * 🕐 Registrar o ponto de PRESENÇA do próprio médico (falta é gravada pela tela de Plantões)
 */
export const registrarPonto = async (
  userId: string | number,
  data: string | Date,
  turno: string,
  setorId: number
): Promise<{ sucesso: boolean; erro?: string; dados?: any; semGps?: boolean }> => {
  const dataDia = toDateISO(data);

  // Validação de entrada
  if (!isValidDateISO(dataDia)) {
    return { sucesso: false, erro: 'Selecione uma data válida.' };
  }
  if (!VALID_SHIFTS.includes(turno)) {
    return { sucesso: false, erro: 'Turno inválido.' };
  }
  if (!VALID_SECTOR_IDS.includes(setorId)) {
    return { sucesso: false, erro: 'Setor inválido.' };
  }

  // ✅ Validação: só bate na data de hoje, a partir do início do turno
  const hoje = getTodayLocal();

  if (dataDia !== hoje) {
    return { sucesso: false, erro: `O ponto só pode ser batido na data de hoje (${formatDateBR(hoje)}).` };
  }

  const horaInicio = SHIFT_START_HOUR[turno as Shift];

  if (new Date().getHours() < horaInicio) {
    return {
      sucesso: false,
      erro: `O ponto da ${turno} só pode ser batido a partir das ${String(horaInicio).padStart(2, '0')}:00.`,
    };
  }

  // ✅ Validação: verifica se já bateu neste TURNO específico
  const validacao = await verificarPontoDuplicado(userId, dataDia, turno);

  if (!validacao.pode_bater) {
    return {
      sucesso: false,
      erro: validacao.mensagem,
    };
  }

  // ✅ Obter usuário autenticado atual (quem está registrando)
  const { data: { user: currentUser } } = await supabase.auth.getUser();

  if (!currentUser) {
    return {
      sucesso: false,
      erro: 'Sessão expirada. Faça login novamente.',
    };
  }

  // O banco grava sempre no nome de quem está logado
  if (String(userId) !== currentUser.id) {
    return { sucesso: false, erro: 'Só é possível bater o próprio ponto.' };
  }

  // ✅ Validação: só bate ponto se o GPS indicar que está no hospital
  const { localizacao, erro: erroLocalizacao, semGps } = await obterLocalizacaoNoHospital();

  // Aparelho sem localização (ex.: iPhone que não libera o GPS ao navegador): o ponto é aceito
  // mesmo assim e fica marcado como "sem GPS" para o admin (sql/adicionar_ponto_sem_gps.sql).
  // Fora do hospital, com GPS funcionando, continua recusado.
  if (!localizacao && semGps) {
    const { data: resultado, error } = await supabase.rpc('registrar_presenca_sem_gps', {
      p_data_dia: dataDia,
      p_turno: turno,
      p_setor_id: setorId,
      p_motivo: semGps.slice(0, 300),
      p_aparelho: (navigator.userAgent || '').slice(0, 300),
    });

    if (error) {
      console.error('Erro ao registrar ponto sem GPS:', error);
      // Função ainda não criada ou desligada pelo admin: vale a regra do GPS
      const semFuncao = error.code === 'PGRST202' || error.code === '42883';
      return {
        sucesso: false,
        erro: semFuncao ? erroLocalizacao : friendlyError(error, 'Não foi possível registrar o ponto. Tente novamente.'),
      };
    }

    return { sucesso: true, dados: resultado, semGps: true };
  }

  if (!localizacao) {
    return {
      sucesso: false,
      erro: erroLocalizacao,
    };
  }

  // A função do banco confere o GPS de novo e grava o ponto e a posição juntos.
  // A posição fica em ponto_localizacao: só o próprio médico e o admin conseguem ler.
  const { data: resultado, error } = await supabase.rpc('registrar_presenca', {
    p_data_dia: dataDia,
    p_turno: turno,
    p_setor_id: setorId,
    p_latitude: localizacao.latitude,
    p_longitude: localizacao.longitude,
    p_precisao_metros: localizacao.precisao_metros,
  });

  if (error) {
    console.error('Erro ao registrar ponto:', error);
    return {
      sucesso: false,
      erro: friendlyError(error, 'Não foi possível registrar o ponto. Tente novamente.'),
    };
  }

  return {
    sucesso: true,
    dados: resultado,
  };
};

/**
 * 📊 Buscar histórico de pontos do médico
 */
export const buscarHistoricoPontos = async (
  userId: string,
  dataInicio?: string,
  dataFim?: string
): Promise<any[]> => {
  let query = supabase
    .from('ponto_juju2')
    .select(`
      id,
      data,
      data_dia,
      turno,
      dia_semana_calculado,
      valor_plantao,
      setor_id,
      falta,
      periodo_id
    `)
    .eq('user_id', userId);

  if (dataInicio) {
    query = query.gte('data_dia', dataInicio);
  }

  if (dataFim) {
    query = query.lte('data_dia', dataFim);
  }

  const { data, error } = await query.order('data', { ascending: false });

  if (error) {
    console.error('Erro ao buscar histórico:', error);
    return [];
  }

  return data || [];
};

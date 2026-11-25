import React, { useEffect, useState } from 'react';
import LogoIcon from './LogoIcon';
import { LOCAL_PONTO, SHIFT_START_HOUR } from '../constants';

interface LoginScreenProps {
  onLogin: (email: string, password_cleartext: string) => Promise<boolean>;
  error: string | null;
}

/** Os três plantões no relógio de 24h. A Noite atravessa a meia-noite, por isso termina em 31 (07h do dia seguinte). */
const PLANTOES = [
  { nome: 'Plantão da manhã', inicio: SHIFT_START_HOUR['Manhã'], fim: SHIFT_START_HOUR['Tarde'] },
  { nome: 'Plantão da tarde', inicio: SHIFT_START_HOUR['Tarde'], fim: SHIFT_START_HOUR['Noite'] },
  { nome: 'Plantão da noite', inicio: SHIFT_START_HOUR['Noite'], fim: SHIFT_START_HOUR['Manhã'] + 24 },
];

// Desenho do mostrador (unidades do viewBox)
const CENTRO = 120;
const RAIO = 84;
const FOLGA = 2.5; // graus de espaço entre um plantão e o outro

/** Meio-dia fica no alto do mostrador e meia-noite embaixo */
const angulo = (hora: number) => ((hora - 12) / 24) * 360;

const ponto = (graus: number, raio: number) => {
  const rad = ((graus - 90) * Math.PI) / 180;
  return { x: CENTRO + raio * Math.cos(rad), y: CENTRO + raio * Math.sin(rad) };
};

const arco = (inicio: number, fim: number) => {
  const a = ponto(angulo(inicio) + FOLGA, RAIO);
  const b = ponto(angulo(fim) - FOLGA, RAIO);
  return `M ${a.x.toFixed(2)} ${a.y.toFixed(2)} A ${RAIO} ${RAIO} 0 0 1 ${b.x.toFixed(2)} ${b.y.toFixed(2)}`;
};

const doisDigitos = (n: number) => String(n).padStart(2, '0');

/** Hora do aparelho, igual à regra que libera o botão de bater o ponto */
const lerAgora = () => {
  const agora = new Date();
  const hora = agora.getHours() + agora.getMinutes() / 60;
  // Madrugada conta como continuação da noite anterior (25h, 26h...)
  const horaCorrida = hora < PLANTOES[0].inicio ? hora + 24 : hora;
  const plantao = PLANTOES.find(p => horaCorrida >= p.inicio && horaCorrida < p.fim) ?? PLANTOES[2];
  return {
    relogio: `${doisDigitos(agora.getHours())}:${doisDigitos(agora.getMinutes())}`,
    horaCorrida,
    plantao,
  };
};

/**
 * Mostrador de 24h dividido nos três plantões, com um marcador na hora de agora.
 * É a pergunta de quem abre o app: qual plantão está correndo?
 */
const MostradorPlantao: React.FC<{ className?: string }> = ({ className }) => {
  const [agora, setAgora] = useState(lerAgora);
  // O marcador sai do começo do plantão e desliza até a hora atual, uma vez, ao abrir
  const [posicionado, setPosicionado] = useState(false);

  useEffect(() => {
    const quadro = requestAnimationFrame(() => setPosicionado(true));
    const relogio = setInterval(() => setAgora(lerAgora()), 20_000);
    return () => {
      cancelAnimationFrame(quadro);
      clearInterval(relogio);
    };
  }, []);

  const giro = angulo(posicionado ? agora.horaCorrida : agora.plantao.inicio);

  return (
    <svg viewBox="0 0 240 240" className={className} role="img" aria-label={`Agora são ${agora.relogio}, ${agora.plantao.nome.toLowerCase()}`}>
      {PLANTOES.map(plantao => (
        <path
          key={plantao.nome}
          d={arco(plantao.inicio, plantao.fim)}
          fill="none"
          stroke="#fff"
          strokeWidth={plantao === agora.plantao ? 13 : 9}
          strokeLinecap="round"
          opacity={plantao === agora.plantao ? 0.95 : 0.24}
        />
      ))}

      {/* Horas em que cada plantão começa (some no mostrador pequeno do celular) */}
      {PLANTOES.map(plantao => {
        const lugar = ponto(angulo(plantao.inicio), RAIO + 24);
        return (
          <text
            key={plantao.inicio}
            x={lugar.x}
            y={lugar.y}
            textAnchor="middle"
            dominantBaseline="middle"
            fontSize={12}
            fontWeight={600}
            fill="#fff"
            opacity={0.7}
            className="hidden md:block"
          >
            {doisDigitos(plantao.inicio)}h
          </text>
        );
      })}

      <g
        className="transition-transform duration-1000 ease-out motion-reduce:transition-none"
        style={{ transform: `rotate(${giro}deg)`, transformOrigin: `${CENTRO}px ${CENTRO}px` }}
      >
        <circle cx={CENTRO} cy={CENTRO - RAIO} r={10.5} className="fill-pmp-primary-dark" />
        <circle cx={CENTRO} cy={CENTRO - RAIO} r={7} fill="#FBBF24" />
      </g>

      <text
        x={CENTRO}
        y={CENTRO + 2}
        textAnchor="middle"
        dominantBaseline="middle"
        fontSize={44}
        fontWeight={600}
        fill="#fff"
        style={{ fontFamily: "'Fredoka', 'Inter', sans-serif" }}
      >
        {agora.relogio}
      </text>
    </svg>
  );
};

/** Nome do plantão que está correndo e até que horas vai */
const PlantaoAgora: React.FC<{ className?: string }> = ({ className }) => {
  const [agora, setAgora] = useState(lerAgora);

  useEffect(() => {
    const relogio = setInterval(() => setAgora(lerAgora()), 20_000);
    return () => clearInterval(relogio);
  }, []);

  return (
    <div className={className}>
      <p className="font-display text-[1.375rem] leading-7 md:text-2xl font-semibold text-white">{agora.plantao.nome}</p>
      <p className="mt-0.5 text-[0.9375rem] md:text-sm text-white/75">Vai até as {doisDigitos(agora.plantao.fim % 24)}:00</p>
    </div>
  );
};

const campo = 'block w-full h-11 md:h-12 px-3.5 md:px-4 rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 '
  + 'text-base sm:text-sm text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 '
  + 'focus:outline-none focus:ring-4 focus:ring-pmp-primary/20 focus:border-pmp-primary '
  + 'dark:focus:ring-dark-pmp-primary-light/20 dark:focus:border-dark-pmp-primary-light disabled:opacity-50 transition-shadow';
const rotulo = 'block mb-1 md:mb-1.5 text-[0.8125rem] md:text-sm font-medium text-pmp-text-primary dark:text-dark-pmp-text-primary';

const LoginScreen: React.FC<LoginScreenProps> = ({ onLogin, error }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [mostrarSenha, setMostrarSenha] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (email.trim() && password.trim()) {
      setIsLoading(true);
      await onLogin(email, password);
      setIsLoading(false);
    }
  };

  return (
    // 100dvh: no celular, 100vh conta a barra de endereço e a tela ficava rolando à toa
    <div className="min-h-screen flex flex-col md:grid md:grid-cols-[minmax(0,5fr)_minmax(0,6fr)]" style={{ minHeight: '100dvh' }}>
      {/* Faixa da marca: no celular ocupa a metade de cima (cresce com o espaço que sobrar);
          no computador é a coluna da esquerda */}
      <div className="flex flex-1 flex-col bg-pmp-primary-dark text-white px-6 pt-9 pt-[clamp(1.25rem,4dvh,2.25rem)] pb-14 pb-[calc(1.5rem+clamp(0.75rem,3dvh,2rem))] md:p-8 lg:p-12 md:justify-between">
        <div className="flex items-center gap-3">
          <span className="flex h-[3.25rem] w-[3.25rem] md:h-11 md:w-11 items-center justify-center rounded-2xl bg-white/15">
            <LogoIcon className="h-10 w-10 md:h-8 md:w-8 text-white" />
          </span>
          <div>
            <h1 className="font-display text-[1.75rem] md:text-2xl font-semibold leading-none tracking-tight">Ponto Kids</h1>
            <p className="mt-1.5 text-[0.8125rem] text-white/70 md:hidden">{LOCAL_PONTO.nome}</p>
          </div>
        </div>

        {/* Celular: relógio centralizado com o plantão embaixo; o tamanho acompanha a altura da tela
            (h-28 é a reserva para navegador antigo, que não entende "dvh") */}
        <div className="mt-5 mt-[clamp(0.5rem,2dvh,1.25rem)] flex flex-1 flex-col items-center justify-center gap-3 gap-[clamp(0.375rem,1.5dvh,0.75rem)] text-center md:mt-0 md:flex-none md:gap-6">
          <MostradorPlantao className="h-28 w-28 h-[clamp(5.5rem,17dvh,11rem)] w-[clamp(5.5rem,17dvh,11rem)] flex-shrink-0 md:h-auto md:w-full md:max-w-[20rem]" />
          <PlantaoAgora />
        </div>

        <p className="hidden text-sm text-white/70 md:block">{LOCAL_PONTO.nome}</p>
      </div>

      {/* Formulário */}
      <div className="relative -mt-6 flex items-center justify-center rounded-t-3xl bg-pmp-background px-6 pb-7 pb-[clamp(1rem,3dvh,1.75rem)] pt-8 pt-[clamp(1.25rem,3.5dvh,2rem)] dark:bg-dark-pmp-background md:mt-0 md:rounded-none md:p-8 lg:p-12">
        <div className="w-full max-w-[19rem] md:max-w-sm">
          <h2 className="text-xl md:text-2xl font-bold tracking-tight text-pmp-text-primary dark:text-dark-pmp-text-primary">Entrar</h2>
          <p className="mt-1 md:mt-1.5 text-[0.8125rem] md:text-sm text-pmp-text-secondary dark:text-dark-pmp-text-secondary">
            Use o e-mail e a senha do seu cadastro.
          </p>

          <form className="mt-5 mt-[clamp(0.75rem,2.2dvh,1.25rem)] space-y-3.5 space-y-[clamp(0.625rem,1.8dvh,0.875rem)] md:mt-7 md:space-y-5" onSubmit={handleSubmit}>
            <div>
              <label htmlFor="email-address" className={rotulo}>E-mail</label>
              <input
                id="email-address"
                name="email"
                type="email"
                autoComplete="email"
                inputMode="email"
                required
                className={campo}
                placeholder="nome@exemplo.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={isLoading}
              />
            </div>

            <div>
              <label htmlFor="password" className={rotulo}>Senha</label>
              <div className="relative">
                <input
                  id="password"
                  name="password"
                  type={mostrarSenha ? 'text' : 'password'}
                  autoComplete="current-password"
                  required
                  className={`${campo} pr-24 md:pr-24`}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={isLoading}
                />
                <button
                  type="button"
                  onClick={() => setMostrarSenha(v => !v)}
                  aria-pressed={mostrarSenha}
                  aria-label={mostrarSenha ? 'Ocultar senha' : 'Mostrar senha'}
                  className="absolute inset-y-0 right-0 px-4 text-sm font-semibold text-pmp-primary hover:text-pmp-primary-dark dark:text-dark-pmp-primary-light rounded-r-xl focus:outline-none focus-visible:ring-2 focus-visible:ring-pmp-primary"
                >
                  {mostrarSenha ? 'Ocultar' : 'Mostrar'}
                </button>
              </div>
            </div>

            {error && (
              <p role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-300">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={isLoading}
              className="flex h-11 md:h-12 w-full items-center justify-center rounded-xl bg-pmp-primary text-[0.9375rem] md:text-base font-semibold text-white shadow-sm transition-colors hover:bg-pmp-primary-dark focus:outline-none focus-visible:ring-4 focus-visible:ring-pmp-primary/30 disabled:cursor-not-allowed disabled:opacity-70"
            >
              {isLoading ? (
                <span className="flex items-center">
                  <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Entrando...
                </span>
              ) : (
                'Entrar'
              )}
            </button>
          </form>

          <p className="mt-5 mt-[clamp(0.75rem,2.2dvh,1.25rem)] md:mt-8 flex items-center justify-center gap-2 border-slate-200 md:border-t md:pt-5 text-xs md:text-sm text-pmp-text-secondary dark:border-slate-700/60 dark:text-dark-pmp-text-secondary">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4 flex-shrink-0" aria-hidden="true">
              <path fillRule="evenodd" d="M10 1a4.5 4.5 0 00-4.5 4.5V9H5a2 2 0 00-2 2v6a2 2 0 002 2h10a2 2 0 002-2v-6a2 2 0 00-2-2h-.5V5.5A4.5 4.5 0 0010 1zm3 8V5.5a3 3 0 10-6 0V9h6z" clipRule="evenodd" />
            </svg>
            <span><strong className="font-semibold text-pmp-text-primary dark:text-dark-pmp-text-primary">Acesso restrito</strong> à equipe cadastrada.</span>
          </p>
        </div>
      </div>
    </div>
  );
};

export default LoginScreen;

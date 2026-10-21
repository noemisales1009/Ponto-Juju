import React from 'react';
import { Sector } from '../types';
import { SECTOR_CONFIG, DISABLED_SECTORS } from '../constants';

interface SectorSelectionProps {
  onSelectSector: (sector: Sector) => void;
}

const SectorCard: React.FC<{ sector: Sector; onClick: () => void; disabled?: boolean }> = ({ sector, onClick, disabled = false }) => (
  <button
    onClick={onClick}
    disabled={disabled}
    aria-disabled={disabled}
    className={`bg-pmp-surface dark:bg-dark-pmp-surface p-8 rounded-2xl shadow-lg transform transition-all duration-300 ease-in-out text-center group ${
      disabled ? 'opacity-50 grayscale cursor-not-allowed' : 'hover:shadow-xl hover:-translate-y-1'
    }`}
  >
    <div className={`w-16 h-16 mx-auto bg-gradient-to-br from-pmp-primary to-pmp-secondary rounded-full flex items-center justify-center mb-4 transition-transform duration-300 ${disabled ? '' : 'group-hover:scale-110'}`}>
      <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
      </svg>
    </div>
    <h2 className="text-xl font-bold text-pmp-text-primary dark:text-dark-pmp-text-primary">{sector}</h2>
    <p className="text-sm text-pmp-text-secondary dark:text-dark-pmp-text-secondary mt-1">
      {disabled ? 'Indisponível no momento' : 'Clique para ver os plantões'}
    </p>
  </button>
);

const SectorSelection: React.FC<SectorSelectionProps> = ({ onSelectSector }) => {
  return (
    <div className="flex flex-col flex-grow">
      <div className="space-y-8">
        <div className="text-center">
          <h1 className="text-3xl font-extrabold text-pmp-text-primary dark:text-dark-pmp-text-primary tracking-tight">Painel de Plantões</h1>
          <p className="mt-2 text-lg text-pmp-text-secondary dark:text-dark-pmp-text-secondary">Selecione o setor para registrar o ponto.</p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 max-w-5xl mx-auto pt-4">
          {(Object.keys(SECTOR_CONFIG) as Sector[]).map(sector => (
            <SectorCard
              key={sector}
              sector={sector}
              disabled={DISABLED_SECTORS.includes(sector)}
              onClick={() => onSelectSector(sector)}
            />
          ))}
        </div>
      </div>
      <footer className="text-center py-8 mt-auto">
          <p className="text-sm font-medium text-pmp-text-secondary dark:text-dark-pmp-text-secondary">
              Criado por Noemi Sales
          </p>
      </footer>
    </div>
  );
};

export default SectorSelection;
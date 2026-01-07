import React, { useState } from 'react';
import { User, Sector } from '../types';
import SectorSelection from './SectorSelection';
import SectorDashboard from './SectorDashboard';

interface DashboardProps {
  currentUser: User;
}

const Dashboard: React.FC<DashboardProps> = ({ currentUser }) => {
    const [selectedSector, setSelectedSector] = useState<Sector | null>(null);

    if (!selectedSector) {
        return <SectorSelection onSelectSector={setSelectedSector} />;
    }

    return (
        <SectorDashboard 
            sector={selectedSector} 
            currentUser={currentUser} 
            onBack={() => setSelectedSector(null)} 
        />
    );
};

export default Dashboard;
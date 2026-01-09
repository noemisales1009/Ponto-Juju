import React, { useState } from 'react';
import { User, Sector } from '../types';
import SectorSelection from './SectorSelection';
import SectorDashboard from './SectorDashboard';

interface DashboardProps {
  currentUser: User;
  isAdmin?: boolean;
}

const Dashboard: React.FC<DashboardProps> = ({ currentUser, isAdmin = false }) => {
    const [selectedSector, setSelectedSector] = useState<Sector | null>(null);

    if (!selectedSector) {
        return <SectorSelection onSelectSector={setSelectedSector} />;
    }

    return (
        <SectorDashboard 
            sector={selectedSector} 
            currentUser={currentUser} 
            onBack={() => setSelectedSector(null)}
            isAdmin={isAdmin}
        />
    );
};

export default Dashboard;
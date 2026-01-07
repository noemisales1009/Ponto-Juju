import React, { useState, useEffect } from 'react';
import { supabase } from '../services/supabaseClient';
import { User } from '../types';
import AdminDashboard from './AdminDashboard';

interface AdminPageProps {
    currentUser: User;
    onBack: () => void;
}

const AdminPage: React.FC<AdminPageProps> = ({ currentUser, onBack }) => {
    const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        checkAdminPermission();
    }, [currentUser]);

    const checkAdminPermission = async () => {
        try {
            setLoading(true);
            setError(null);

            // Buscar dados do usuário na tabela usuarios
            const { data, error: fetchError } = await supabase
                .from('usuarios')
                .select('role, email')
                .eq('user_id', currentUser.id)
                .single();

            if (fetchError) {
                console.error('❌ Erro ao buscar usuário:', fetchError);
                setError('Usuário não encontrado no sistema');
                setIsAdmin(false);
                return;
            }

            // Verificar se é admin
            if (data && data.role === 'admin') {
                console.log('✅ Admin autorizado:', data.email);
                setIsAdmin(true);
            } else {
                console.warn('⚠️ Usuário não é admin:', data?.email);
                setIsAdmin(false);
                setError('Você não tem permissão para acessar esta página');
            }
        } catch (err) {
            console.error('❌ Erro geral:', err);
            setError('Erro ao verificar permissões');
            setIsAdmin(false);
        } finally {
            setLoading(false);
        }
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-slate-50 dark:from-slate-950 to-slate-100 dark:to-slate-900 flex items-center justify-center p-6">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-pmp-primary mx-auto mb-4"></div>
                    <p className="text-gray-600 dark:text-gray-400">Verificando permissões...</p>
                </div>
            </div>
        );
    }

    if (!isAdmin) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-slate-50 dark:from-slate-950 to-slate-100 dark:to-slate-900 flex items-center justify-center p-6">
                <div className="bg-white dark:bg-slate-800 rounded-xl shadow-lg p-8 max-w-md w-full text-center">
                    <div className="text-6xl mb-4">🔒</div>
                    <h1 className="text-2xl font-bold text-red-600 dark:text-red-400 mb-4">
                        Acesso Negado
                    </h1>
                    <p className="text-gray-600 dark:text-gray-400 mb-6">
                        {error || 'Você não tem permissão para acessar o painel administrativo'}
                    </p>
                    <button
                        onClick={onBack}
                        className="w-full px-4 py-2 bg-pmp-primary dark:bg-dark-pmp-primary text-white rounded-lg hover:bg-pmp-primary-dark dark:hover:bg-dark-pmp-primary-dark transition-colors font-medium"
                    >
                        ← Voltar ao Menu
                    </button>
                </div>
            </div>
        );
    }

    return <AdminDashboard currentUser={currentUser} onBack={onBack} />;
};

export default AdminPage;

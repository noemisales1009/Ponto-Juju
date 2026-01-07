import React, { useState, useRef, useEffect } from 'react';
import { User } from '../types';
import { supabase } from '../services/supabaseClient';

interface ProfileProps {
    user: User;
    onUpdateUser: (updates: { name?: string; photoUrl?: string }) => void;
}

const Profile: React.FC<ProfileProps> = ({ user, onUpdateUser }) => {
    const [name, setName] = useState(user.name);
    const [email, setEmail] = useState(user.email);
    const [photoUrl, setPhotoUrl] = useState(user.photoUrl);
    const [photoPreview, setPhotoPreview] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // ✅ NOVO: Carregar dados do Supabase ao montar o componente
    useEffect(() => {
        const fetchUserProfile = async () => {
            setLoading(true);
            try {
                console.log('📥 Buscando dados do perfil do Supabase para user_id:', user.id);
                
                const { data: usuarioData, error: usuarioError } = await supabase
                    .from('usuarios')
                    .select('user_id, nome, email, foto')
                    .eq('user_id', user.id)
                    .single();

                if (usuarioError) {
                    console.warn('⚠️ Erro ao buscar usuários:', usuarioError.message);
                } else if (usuarioData) {
                    console.log('✅ Dados carregados:', usuarioData);
                    setName(usuarioData.nome || user.name);
                    setEmail(usuarioData.email || user.email);
                    if (usuarioData.foto) {
                        setPhotoUrl(usuarioData.foto);
                    }
                }
            } catch (err) {
                console.error('❌ Erro ao buscar perfil:', err);
            } finally {
                setLoading(false);
            }
        };

        fetchUserProfile();
    }, [user.id]);

    const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (file) {
            const reader = new FileReader();
            reader.onloadend = () => {
                setPhotoPreview(reader.result as string);
            };
            reader.readAsDataURL(file);
        }
    };

    const handleSaveChanges = () => {
        const updates: { name?: string; photoUrl?: string } = {};
        if (name.trim() !== user.name) {
            updates.name = name.trim();
        }
        if (photoPreview) {
            updates.photoUrl = photoPreview;
        }
        if (Object.keys(updates).length > 0) {
            onUpdateUser(updates);
            setPhotoPreview(null); // Clear preview after saving
        } else {
            alert('Nenhuma alteração para salvar.');
        }
    };

    return (
        <div className="max-w-2xl mx-auto">
            <h1 className="text-3xl font-extrabold text-pmp-text-primary dark:text-dark-pmp-text-primary tracking-tight mb-8">Meu Perfil</h1>
            
            {/* ✅ NOVO: Indicador de carregamento */}
            {loading && (
                <div className="mb-4 p-4 bg-blue-50 dark:bg-blue-500/10 border border-blue-200 dark:border-blue-500/20 rounded-lg text-center">
                    <p className="text-blue-700 dark:text-blue-400 text-sm font-medium">Carregando dados do perfil...</p>
                </div>
            )}

            <div className="bg-pmp-surface dark:bg-dark-pmp-surface p-6 sm:p-8 rounded-2xl shadow-xl space-y-8 border border-gray-100 dark:border-gray-700/50">
                <div className="flex flex-col sm:flex-row items-center space-y-4 sm:space-y-0 sm:space-x-6">
                    <div className="relative group">
                        <img 
                            src={photoPreview || photoUrl || `https://ui-avatars.com/api/?name=${encodeURIComponent(user.name)}&background=6366F1&color=fff&size=128`} 
                            alt="Foto de perfil" 
                            className="h-28 w-28 rounded-full object-cover ring-4 ring-pmp-primary/20 dark:ring-pmp-primary/40 transition-all duration-300 group-hover:ring-pmp-primary"
                        />
                        <button 
                            onClick={() => fileInputRef.current?.click()}
                            className="absolute bottom-0 right-0 bg-pmp-primary hover:bg-pmp-primary-dark text-white rounded-full p-2 shadow-lg transition-transform hover:scale-110"
                            aria-label="Alterar foto"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                                <path d="M17.414 2.586a2 2 0 00-2.828 0L7 10.172V13h2.828l7.586-7.586a2 2 0 000-2.828z" />
                                <path fillRule="evenodd" d="M2 6a2 2 0 012-2h4a1 1 0 010 2H4v10h10v-4a1 1 0 112 0v4a2 2 0 01-2 2H4a2 2 0 01-2-2V6z" clipRule="evenodd" />
                            </svg>
                        </button>
                        <input 
                            ref={fileInputRef}
                            type="file" 
                            accept="image/*"
                            className="hidden"
                            onChange={handleFileChange}
                        />
                    </div>
                    <div className="text-center sm:text-left">
                        <h2 className="text-2xl font-bold text-pmp-text-primary dark:text-dark-pmp-text-primary">{name}</h2>
                        <p className="text-pmp-text-secondary dark:text-dark-pmp-text-secondary">{email}</p>
                    </div>
                </div>

                <div className="space-y-4">
                    <div>
                        <label htmlFor="name" className="block text-sm font-medium text-pmp-text-secondary dark:text-dark-pmp-text-secondary mb-1">
                            Nome Completo
                        </label>
                        <input
                            type="text"
                            id="name"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            className="block w-full rounded-lg border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700/50 text-pmp-text-primary dark:text-white shadow-sm focus:border-pmp-primary focus:ring-pmp-primary sm:text-sm py-2.5 px-4"
                        />
                    </div>
                </div>

                <div className="flex justify-end pt-4">
                    <button
                        onClick={handleSaveChanges}
                        className="justify-center py-2.5 px-6 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white bg-pmp-primary hover:bg-pmp-primary-dark focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-pmp-primary-light transition-colors"
                    >
                        Salvar Alterações
                    </button>
                </div>
            </div>
        </div>
    );
};

export default Profile;
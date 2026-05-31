import { useResource } from './use-resource';

export type UserProfile = {
  id: string;
  email: string;
  company_id: string;
  role: 'admin' | 'user' | 'caixa' | 'contabilista';
  is_platform_admin: boolean;
  full_name?: string;
};

export function useProfile() {
  const { data, loading, error, reload } = useResource<{ user: any; profile: UserProfile; company: any }>('/api/auth/me', {
    ttl: 300_000, // 5 minutes cache
  });

  const isSuperAdmin = data?.user?.email === 'elvessacapuri57@gmail.com' || data?.profile?.email === 'elvessacapuri57@gmail.com' || data?.profile?.is_platform_admin === true;
  return {
    profile: data?.profile,
    company: data?.company,
    loading,
    error,
    isAdmin: isSuperAdmin || data?.profile?.role === 'admin',
    isPlatformAdmin: isSuperAdmin,
    reload
  };
}

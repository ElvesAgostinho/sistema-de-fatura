import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

interface AppState {
  activeView: string;
  setActiveView: (view: string) => void;
  
  // Persisted form drafts to avoid data loss on tab switch/refresh
  purchaseDraft: any | null;
  setPurchaseDraft: (data: any) => void;
  
  invoiceDraft: any | null;
  setInvoiceDraft: (data: any) => void;

  resetDrafts: () => void;
}

export const useAppStore = create<AppState>()(
  persist(
    (set) => ({
      activeView: 'dashboard',
      setActiveView: (view) => set({ activeView: view }),
      
      purchaseDraft: null,
      setPurchaseDraft: (data) => set({ purchaseDraft: data }),
      
      invoiceDraft: null,
      setInvoiceDraft: (data) => set({ invoiceDraft: data }),

      resetDrafts: () => set({ purchaseDraft: null, invoiceDraft: null }),
    }),
    {
      name: 'abacus-app-storage',
      storage: createJSONStorage(() => localStorage),
    }
  )
);

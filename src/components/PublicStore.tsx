import React, { useState, useEffect } from 'react';
import { collection, onSnapshot, query, orderBy, where, getDocs, limit } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { AppData, StoreData } from '../types';
import { Download, Package, Key, Info, Store as StoreIcon } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

export const PublicStore: React.FC = () => {
  const [store, setStore] = useState<StoreData | null>(null);
  const [apps, setApps] = useState<AppData[]>([]);
  const [loading, setLoading] = useState(true);
  const [showToast, setShowToast] = useState(false);

  useEffect(() => {
    const fetchStoreAndApps = async () => {
      try {
        // Get slug from URL query param ?s=slug or default
        const params = new URLSearchParams(window.location.search);
        const slug = params.get('s');

        let storeData: StoreData | null = null;

        if (slug) {
          const qStore = query(collection(db, 'stores'), where('slug', '==', slug), limit(1));
          const storeSnap = await getDocs(qStore);
          if (!storeSnap.empty) {
            storeData = { id: storeSnap.docs[0].id, excludedAppIds: [], ...storeSnap.docs[0].data() } as StoreData;
          }
        }

        // If no slug or store not found, try to get the first store as default
        if (!storeData) {
          const qDefault = query(collection(db, 'stores'), orderBy('createdAt', 'asc'), limit(1));
          const defaultSnap = await getDocs(qDefault);
          if (!defaultSnap.empty) {
            storeData = { id: defaultSnap.docs[0].id, excludedAppIds: [], ...defaultSnap.docs[0].data() } as StoreData;
          }
        }

        setStore(storeData);

        if (storeData) {
          // Listen to ALL apps (Global)
          const qApps = query(collection(db, 'apps'), orderBy('createdAt', 'desc'));
          
          const unsubscribe = onSnapshot(qApps, (snapshot) => {
            const appsData = snapshot.docs.map(doc => ({
              id: doc.id,
              ...doc.data()
            })) as AppData[];
            
            // Filter out apps excluded by this specific store
            const excludedIds = storeData?.excludedAppIds || [];
            const filteredApps = appsData.filter(app => !excludedIds.includes(app.id));
            
            setApps(filteredApps);
            setLoading(false);
          }, (error) => {
            handleFirestoreError(error, OperationType.LIST, 'apps');
          });

          return unsubscribe;
        } else {
          setLoading(false);
        }
      } catch (error) {
        console.error("Error fetching store:", error);
        setLoading(false);
      }
    };

    const unsubscribePromise = fetchStoreAndApps();
    return () => {
      unsubscribePromise.then(unsubscribe => unsubscribe && unsubscribe());
    };
  }, []);

  const handleDownload = (url: string) => {
    setShowToast(true);
    setTimeout(() => {
      setShowToast(false);
      window.location.href = url;
    }, 2500);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0d1117] flex items-center justify-center">
        <div className="text-center py-20 text-xl animate-pulse text-white">Buscando aplicativos...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0d1117] text-white flex flex-col items-center pb-20">
      <header className="w-full bg-[#1e40af] text-center py-8 border-b-4 border-[#facc15] shadow-lg flex flex-col items-center">
        <h1 className="text-4xl font-bold tracking-wider uppercase">Loja de Apps</h1>
        
        {/* Espaço para Logo */}
        <div className="mt-6 w-32 h-32 bg-white/5 rounded-3xl border-2 border-dashed border-[#facc15]/30 flex items-center justify-center overflow-hidden shadow-inner">
          {store?.logoUrl ? (
            <img 
              src={store.logoUrl} 
              alt="Logo" 
              className="w-full h-full object-contain p-2"
              referrerPolicy="no-referrer"
            />
          ) : (
            <StoreIcon size={48} className="text-[#facc15]/20" />
          )}
        </div>
      </header>

      <main className="w-full max-w-[600px] px-4 mt-8">
        {!store ? (
          <div className="text-center py-20 text-gray-400 bg-[#1f2937] rounded-3xl border border-gray-700 p-8">
            <StoreIcon size={64} className="mx-auto mb-4 opacity-20" />
            <h2 className="text-xl font-bold text-white mb-2">Nenhuma loja configurada</h2>
            <p>Acesse o painel administrativo para criar sua primeira loja.</p>
          </div>
        ) : apps.length === 0 ? (
          <div className="text-center py-20 text-gray-400">Nenhum aplicativo cadastrado nesta loja.</div>
        ) : (
          <div className="space-y-6">
            <AnimatePresence>
              {apps.map((app) => (
                <motion.section
                  key={app.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  className="bg-[#1f2937] rounded-2xl p-6 text-center border-2 border-transparent hover:border-[#facc15] focus-within:border-[#facc15] transition-all duration-200 shadow-xl group"
                  tabIndex={0}
                >
                  <div className="flex justify-center mb-4">
                    {app.iconUrl ? (
                      <img
                        src={app.iconUrl}
                        alt={app.nome}
                        className="w-24 h-24 rounded-2xl object-cover bg-[#374151] border-2 border-[#374151] shadow-inner"
                        referrerPolicy="no-referrer"
                      />
                    ) : (
                      <div className="w-24 h-24 rounded-2xl bg-[#374151] flex items-center justify-center">
                        <Package size={40} className="text-gray-500" />
                      </div>
                    )}
                  </div>

                  <h2 className="text-2xl font-bold text-[#facc15] mb-4 uppercase tracking-tight">
                    {app.nome}
                  </h2>

                  <div className="space-y-2 mb-6">
                    <div className="flex justify-between items-center py-2 border-b border-[#374151] text-gray-300">
                      <span className="flex items-center gap-2 text-sm uppercase font-semibold text-gray-400">
                        <Info size={16} /> Tamanho
                      </span>
                      <strong className="text-white">{app.tamanho || '--'}</strong>
                    </div>
                    <div className="flex justify-between items-center py-2 border-b border-[#374151] text-gray-300">
                      <span className="flex items-center gap-2 text-sm uppercase font-semibold text-gray-400">
                        <Key size={16} /> PIN
                      </span>
                      <strong className="text-white">{app.pin || '--'}</strong>
                    </div>
                  </div>

                  <button
                    onClick={() => handleDownload(app.downloadUrl)}
                    className="w-full bg-[#2563eb] hover:bg-[#1d4ed8] active:scale-95 text-white py-4 rounded-xl font-bold text-xl transition-all flex items-center justify-center gap-3 shadow-lg focus:outline-none focus:ring-4 focus:ring-[#facc15]"
                  >
                    <Download size={24} />
                    BAIXAR AGORA
                  </button>
                </motion.section>
              ))}
            </AnimatePresence>
          </div>
        )}
      </main>

      {showToast && (
        <motion.div
          initial={{ y: 100 }}
          animate={{ y: 0 }}
          exit={{ y: 100 }}
          className="fixed bottom-0 left-0 w-full bg-[#16a34a] text-white text-center py-5 font-bold text-lg z-[9999] shadow-2xl"
        >
          AGUARDE... PREPARANDO DOWNLOAD
        </motion.div>
      )}
    </div>
  );
};

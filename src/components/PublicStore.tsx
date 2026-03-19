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
    let unsubscribeApps: (() => void) | null = null;
    let unsubscribeStore: (() => void) | null = null;

    // Helper to handle store data and setup apps listener
    const handleStoreData = (data: StoreData | null) => {
      setStore(data);
      
      // If we have a store, listen to apps
      if (data) {
        if (unsubscribeApps) unsubscribeApps();
        
        const qApps = query(collection(db, 'apps'), orderBy('createdAt', 'desc'));
        unsubscribeApps = onSnapshot(qApps, (snapshot) => {
          const appsData = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
          })) as AppData[];
          
          const excludedIds = data.excludedAppIds || [];
          const filteredApps = appsData.filter(app => !excludedIds.includes(app.id));
          
          setApps(filteredApps);
          setLoading(false);
        }, (error) => {
          handleFirestoreError(error, OperationType.LIST, 'apps');
          setLoading(false);
        });
      } else {
        setApps([]);
        setLoading(false);
      }
    };

    const fetchDefaultStore = () => {
      if (unsubscribeStore) unsubscribeStore();
      const qDefault = query(collection(db, 'stores'), orderBy('createdAt', 'asc'), limit(1));
      unsubscribeStore = onSnapshot(qDefault, (snapshot) => {
        if (!snapshot.empty) {
          const data = { id: snapshot.docs[0].id, excludedAppIds: [], ...snapshot.docs[0].data() } as StoreData;
          handleStoreData(data);
        } else {
          handleStoreData(null);
        }
      }, (error) => {
        handleFirestoreError(error, OperationType.GET, 'stores');
        setLoading(false);
      });
    };

    const initStoreListener = async () => {
      try {
        const params = new URLSearchParams(window.location.search);
        const slug = params.get('s');

        if (slug) {
          const qStore = query(collection(db, 'stores'), where('slug', '==', slug), limit(1));
          unsubscribeStore = onSnapshot(qStore, (snapshot) => {
            if (!snapshot.empty) {
              const data = { id: snapshot.docs[0].id, excludedAppIds: [], ...snapshot.docs[0].data() } as StoreData;
              handleStoreData(data);
            } else {
              // Fallback to default if slug not found
              fetchDefaultStore();
            }
          }, (error) => {
            handleFirestoreError(error, OperationType.GET, 'stores');
            fetchDefaultStore();
          });
        } else {
          fetchDefaultStore();
        }
      } catch (error) {
        console.error("Error in initStoreListener:", error);
        setLoading(false);
      }
    };

    initStoreListener();

    return () => {
      if (unsubscribeApps) unsubscribeApps();
      if (unsubscribeStore) unsubscribeStore();
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
        <div className="text-center py-20 text-xl animate-pulse text-white"><span>Buscando aplicativos...</span></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0d1117] text-white flex flex-col items-center pb-20">
      <header className="w-full bg-[#1e40af] text-center py-8 border-b-4 border-[#facc15] shadow-lg flex flex-col items-center">
        <h1 className="text-4xl font-bold tracking-wider uppercase"><span>Loja de Apps</span></h1>
        
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
            <h2 className="text-xl font-bold text-white mb-2"><span>Nenhuma loja configurada</span></h2>
            <p><span>Acesse o painel administrativo para criar sua primeira loja.</span></p>
          </div>
        ) : apps.length === 0 ? (
          <div className="text-center py-20 text-gray-400"><span>Nenhum aplicativo cadastrado nesta loja.</span></div>
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
                    <span>{app.nome}</span>
                  </h2>

                  <div className="space-y-2 mb-6">
                    <div className="flex justify-between items-center py-2 border-b border-[#374151] text-gray-300">
                      <span className="flex items-center gap-2 text-sm uppercase font-semibold text-gray-400">
                        <Info size={16} /> <span>Tamanho</span>
                      </span>
                      <strong className="text-white"><span>{app.tamanho || '--'}</span></strong>
                    </div>
                    <div className="flex justify-between items-center py-2 border-b border-[#374151] text-gray-300">
                      <span className="flex items-center gap-2 text-sm uppercase font-semibold text-gray-400">
                        <Key size={16} /> <span>PIN</span>
                      </span>
                      <strong className="text-white"><span>{app.pin || '--'}</span></strong>
                    </div>
                  </div>

          <button
                    onClick={() => handleDownload(app.downloadUrl)}
                    className="w-full bg-[#2563eb] hover:bg-[#1d4ed8] active:scale-95 text-white py-4 rounded-xl font-bold text-xl transition-all flex items-center justify-center gap-3 shadow-lg focus:outline-none focus:ring-4 focus:ring-[#facc15]"
                  >
                    <Download size={24} />
                    <span>BAIXAR AGORA</span>
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
          <span>AGUARDE... PREPARANDO DOWNLOAD</span>
        </motion.div>
      )}
    </div>
  );
};

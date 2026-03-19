import React, { useState, useEffect } from 'react';
import { auth, loginWithGoogle, logout, db, handleFirestoreError, OperationType } from '../firebase';
import { onAuthStateChanged, User } from 'firebase/auth';
import { collection, addDoc, onSnapshot, query, orderBy, updateDoc, deleteDoc, doc } from 'firebase/firestore';
import { AppData, StoreData } from '../types';
import { Plus, Save, Trash2, LogOut, ShieldAlert, ExternalLink, Image as ImageIcon, Ruler, Hash, Download, Store, LayoutGrid, Eye, EyeOff, Settings, Package, Upload, Copy, Check, Github } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

const toBase64 = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = (error) => reject(error);
  });
};

export const AdminPanel: React.FC = () => {
  const [user, setUser] = useState<User | null>(null);
  const [stores, setStores] = useState<StoreData[]>([]);
  const [apps, setApps] = useState<AppData[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<'apps' | 'stores'>('apps');
  const [editingStoreId, setEditingStoreId] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [githubRepo, setGithubRepo] = useState(localStorage.getItem('github_repo') || '');
  const [isUploadingGithub, setIsUploadingGithub] = useState<string | null>(null);
  const [isUploadingNewAppGithub, setIsUploadingNewAppGithub] = useState(false);
  const [isIframe, setIsIframe] = useState(false);

  useEffect(() => {
    setIsIframe(window.self !== window.top);
  }, []);

  useEffect(() => {
    localStorage.setItem('github_repo', githubRepo);
  }, [githubRepo]);

  // New Store Form
  const [newStore, setNewStore] = useState({
    nome: '',
    logoUrl: '',
    slug: ''
  });

  // New App Form
  const [newApp, setNewApp] = useState({
    nome: '',
    downloadUrl: '',
    pin: '',
    iconUrl: '',
    tamanho: ''
  });

  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      if (currentUser) {
        // Listen to stores
        const qStores = query(collection(db, 'stores'), orderBy('createdAt', 'desc'));
        const unsubscribeStores = onSnapshot(qStores, (snapshot) => {
          const storesData = snapshot.docs.map(doc => ({
            id: doc.id,
            excludedAppIds: [],
            ...doc.data()
          })) as StoreData[];
          setStores(storesData);
        }, (error) => {
          handleFirestoreError(error, OperationType.LIST, 'stores');
        });

        // Listen to all apps
        const qApps = query(collection(db, 'apps'), orderBy('createdAt', 'desc'));
        const unsubscribeApps = onSnapshot(qApps, (snapshot) => {
          const appsData = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
          })) as AppData[];
          setApps(appsData);
          setLoading(false);
        }, (error) => {
          handleFirestoreError(error, OperationType.LIST, 'apps');
        });

        return () => {
          unsubscribeStores();
          unsubscribeApps();
        };
      } else {
        setLoading(false);
      }
    });

    return () => unsubscribeAuth();
  }, []);

  const handleAddStore = async () => {
    if (!newStore.nome || !newStore.slug) {
      alert("Preencha Nome e Slug!");
      return;
    }

    try {
      await addDoc(collection(db, 'stores'), {
        ...newStore,
        excludedAppIds: [],
        createdAt: Date.now()
      });
      setNewStore({ nome: '', logoUrl: '', slug: '' });
      // Reset file input
      const fileInput = document.getElementById('store-logo-upload') as HTMLInputElement;
      if (fileInput) fileInput.value = '';
      alert("Sub-Loja Criada!");
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'stores');
    }
  };

  const handleAddApp = async () => {
    if (!newApp.nome || !newApp.downloadUrl) {
      alert("Preencha Nome e Link!");
      return;
    }

    try {
      await addDoc(collection(db, 'apps'), {
        ...newApp,
        createdAt: Date.now()
      });
      setNewApp({ nome: '', downloadUrl: '', pin: '', iconUrl: '', tamanho: '' });
      // Reset file input
      const fileInput = document.getElementById('app-icon-upload') as HTMLInputElement;
      if (fileInput) fileInput.value = '';
      alert("App Criado!");
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'apps');
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>, type: 'store' | 'app') => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 800000) { // ~800KB limit for Firestore safety
      alert("Imagem muito grande! Use uma imagem menor que 800KB.");
      e.target.value = '';
      return;
    }

    try {
      const base64 = await toBase64(file);
      if (type === 'store') {
        setNewStore({ ...newStore, logoUrl: base64 });
      } else {
        setNewApp({ ...newApp, iconUrl: base64 });
      }
    } catch (error) {
      console.error("Error converting file:", error);
      alert("Erro ao processar imagem.");
    }
  };

  const handleToggleAppVisibility = async (storeId: string, appId: string) => {
    const store = stores.find(s => s.id === storeId);
    if (!store) return;

    const excludedAppIds = store.excludedAppIds || [];
    const isExcluded = excludedAppIds.includes(appId);
    
    const newExcluded = isExcluded 
      ? excludedAppIds.filter(id => id !== appId)
      : [...excludedAppIds, appId];

    try {
      await updateDoc(doc(db, 'stores', storeId), { excludedAppIds: newExcluded });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `stores/${storeId}`);
    }
  };

  const handleUpdateAppLink = async (id: string, newUrl: string) => {
    try {
      await updateDoc(doc(db, 'apps', id), { downloadUrl: newUrl });
      alert("Link atualizado!");
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `apps/${id}`);
    }
  };

  const handleDeleteApp = async (id: string) => {
    if (window.confirm("Deseja realmente apagar este aplicativo de TODAS as lojas?")) {
      try {
        await deleteDoc(doc(db, 'apps', id));
      } catch (error) {
        handleFirestoreError(error, OperationType.DELETE, `apps/${id}`);
      }
    }
  };

  const handleDeleteStore = async (id: string) => {
    if (window.confirm("Deseja apagar esta sub-loja?")) {
      try {
        await deleteDoc(doc(db, 'stores', id));
      } catch (error) {
        handleFirestoreError(error, OperationType.DELETE, `stores/${id}`);
      }
    }
  };

  const copyStoreLink = (slug: string, id: string) => {
    const url = `${window.location.origin}/?s=${slug}`;
    navigator.clipboard.writeText(url);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const uploadToGithub = async (file: File, appName: string): Promise<string> => {
    const pat = process.env.GITHUB_PAT;
    if (!pat) throw new Error("GITHUB_PAT não configurado nos Secrets!");
    
    // Extract owner/repo from full URL if provided
    let repoPath = githubRepo.trim();
    if (repoPath.includes('github.com/')) {
      repoPath = repoPath.split('github.com/')[1].split('?')[0].split('#')[0];
      // Remove trailing slash if exists
      if (repoPath.endsWith('/')) repoPath = repoPath.slice(0, -1);
    }

    if (!repoPath || !repoPath.includes('/')) throw new Error("Configure o repositório no formato 'usuario/repositorio' ou cole a URL completa.");

    const version = window.prompt("Digite a versão (ex: v1.0.0):", "v1.0.0");
    if (!version) throw new Error("Operação cancelada.");

    // 1. Create Release
    const releaseResponse = await fetch(`https://api.github.com/repos/${repoPath}/releases`, {
      method: 'POST',
      headers: {
        'Authorization': `token ${pat}`,
        'Accept': 'application/vnd.github.v3+json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        tag_name: version,
        name: `Release ${version} - ${appName}`,
        body: `Upload automático via Painel Admin.`,
        draft: false,
        prerelease: false
      })
    });

    if (!releaseResponse.ok) {
      const errorData = await releaseResponse.json();
      throw new Error(`Erro GitHub (Release): ${errorData.message || releaseResponse.statusText}`);
    }
    const releaseData = await releaseResponse.json();

    // 2. Upload Asset
    const uploadUrl = releaseData.upload_url.replace('{?name,label}', `?name=${encodeURIComponent(file.name)}`);
    const uploadResponse = await fetch(uploadUrl, {
      method: 'POST',
      headers: {
        'Authorization': `token ${pat}`,
        'Content-Type': 'application/octet-stream',
      },
      body: file
    });

    if (!uploadResponse.ok) {
      const errorData = await uploadResponse.json();
      throw new Error(`Erro GitHub (Upload): ${errorData.message || uploadResponse.statusText}`);
    }
    const assetData = await uploadResponse.json();

    return assetData.browser_download_url;
  };

  const handleGithubUpload = async (app: AppData) => {
    const fileInput = document.createElement('input');
    fileInput.type = 'file';
    fileInput.accept = '.apk';
    
    fileInput.onchange = async (e: any) => {
      const file = e.target.files?.[0];
      if (!file) return;

      setIsUploadingGithub(app.id);
      try {
        const downloadUrl = await uploadToGithub(file, app.nome);
        await updateDoc(doc(db, 'apps', app.id), { downloadUrl });
        alert(`Sucesso! App atualizado com o link do GitHub: ${downloadUrl}`);
      } catch (error: any) {
        console.error(error);
        alert(error.message || "Erro no processo do GitHub.");
      } finally {
        setIsUploadingGithub(null);
      }
    };

    fileInput.click();
  };

  const handleNewAppGithubUpload = async () => {
    if (!newApp.nome) {
      alert("Digite o nome do aplicativo primeiro!");
      return;
    }

    const fileInput = document.createElement('input');
    fileInput.type = 'file';
    fileInput.accept = '.apk';
    
    fileInput.onchange = async (e: any) => {
      const file = e.target.files?.[0];
      if (!file) return;

      setIsUploadingNewAppGithub(true);
      try {
        const downloadUrl = await uploadToGithub(file, newApp.nome);
        setNewApp({ ...newApp, downloadUrl });
        alert(`APK enviado com sucesso! O link foi preenchido.`);
      } catch (error: any) {
        console.error(error);
        alert(error.message || "Erro no processo do GitHub.");
      } finally {
        setIsUploadingNewAppGithub(false);
      }
    };

    fileInput.click();
  };

  if (!user) {
    return (
      <div className="min-h-screen bg-[#1a1a1a] flex flex-col items-center justify-center p-4">
        <motion.div 
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="bg-[#2d2d2d] p-10 rounded-3xl shadow-2xl text-center max-w-md w-full border border-gray-700"
        >
          <ShieldAlert size={64} className="text-[#facc15] mx-auto mb-6" />
          <h1 className="text-3xl font-bold text-[#facc15] mb-2 uppercase tracking-tight">PAINEL PRIVADO</h1>
          <p className="text-gray-400 mb-8">Acesso restrito aos administradores da Loja de Apps.</p>
          
          <div className="mb-6 p-4 bg-blue-900/30 border border-blue-700/50 rounded-xl text-sm text-blue-200 text-left">
            <strong>Dica:</strong> Se o botão de login não abrir nada, clique no botão abaixo para abrir em uma nova aba. O navegador costuma bloquear logins dentro desta janela de visualização.
            <br /><br />
            <strong>Atenção:</strong> Certifique-se de que o domínio <code>run.app</code> está adicionado nos <strong>"Domínios Autorizados"</strong> no Console do Firebase (Autenticação {'>'} Configurações).
          </div>

          {isIframe && (
            <button
              onClick={() => window.open(window.location.href, '_blank')}
              className="w-full mb-4 bg-gray-700 hover:bg-gray-600 text-white py-3 rounded-xl font-semibold flex items-center justify-center gap-2 transition-all"
            >
              <ExternalLink size={18} />
              ABRIR EM NOVA ABA
            </button>
          )}

          <button
            onClick={async () => {
              try {
                await loginWithGoogle();
              } catch (error: any) {
                console.error("Erro no login:", error);
                alert("Erro ao fazer login: " + (error.message || "Verifique se os popups estão bloqueados."));
              }
            }}
            className="w-full bg-[#db4437] hover:bg-[#c53929] text-white py-4 rounded-xl font-bold text-lg transition-all flex items-center justify-center gap-3 shadow-lg"
          >
            <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" className="w-6 h-6 bg-white rounded-full p-1" alt="Google" />
            ENTRAR COM GOOGLE
          </button>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0d1117] text-white p-4 pb-20">
      <div className="max-w-[600px] mx-auto">
        <header className="flex justify-between items-center mb-8 bg-[#1f2937] p-4 rounded-2xl border border-gray-700">
          <div>
            <h1 className="text-[#facc15] font-bold text-xl uppercase">Admin Panel</h1>
            <p className="text-xs text-gray-400">{user.email}</p>
          </div>
          <button onClick={logout} className="text-red-500 hover:bg-red-500/10 p-2 rounded-lg transition-colors flex items-center gap-2 font-semibold">
            <LogOut size={20} /> SAIR
          </button>
        </header>

        {/* Navigation Tabs */}
        <div className="flex gap-2 mb-8 bg-[#1f2937] p-1 rounded-xl border border-gray-700">
          <button 
            onClick={() => { setView('apps'); setEditingStoreId(null); }}
            className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-lg font-bold transition-all ${view === 'apps' ? 'bg-[#facc15] text-black' : 'text-gray-400 hover:text-white'}`}
          >
            <LayoutGrid size={20} /> APPS GLOBAIS
          </button>
          <button 
            onClick={() => setView('stores')}
            className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-lg font-bold transition-all ${view === 'stores' ? 'bg-[#facc15] text-black' : 'text-gray-400 hover:text-white'}`}
          >
            <Store size={20} /> SUB-LOJAS
          </button>
        </div>

        {/* GitHub Config Section */}
        <div className="mb-8 bg-[#1f2937] rounded-2xl p-6 border border-gray-700 shadow-xl">
          <div className="flex items-center gap-3 mb-4 text-[#facc15]">
            <Github size={24} />
            <h2 className="text-xl font-bold uppercase">Configuração GitHub</h2>
          </div>
          <div className="space-y-4">
            <div className="space-y-1">
              <label className="text-xs font-bold text-gray-500 uppercase">Repositório (usuario/repo)</label>
              <input
                type="text"
                value={githubRepo}
                onChange={(e) => setGithubRepo(e.target.value)}
                className="w-full bg-[#374151] border border-gray-600 rounded-xl p-3 focus:ring-2 focus:ring-[#facc15] outline-none transition-all text-sm"
                placeholder="ex: ximpanzemedrozo/meu-repositorio"
              />
            </div>
            <p className="text-[10px] text-gray-400 italic">
              * O Token (PAT) deve ser configurado nos Secrets do AI Studio como GITHUB_PAT.
            </p>
          </div>
        </div>

        {view === 'apps' ? (
          <div className="space-y-10">
            <section>
              <h2 className="text-[#facc15] text-2xl font-bold mb-4 flex items-center gap-2">
                <Plus size={24} /> NOVO APP GLOBAL
              </h2>
              <div className="bg-[#1f2937] rounded-2xl p-6 border border-gray-700 shadow-xl space-y-4">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-gray-500 uppercase">Nome do App</label>
                  <input
                    type="text"
                    value={newApp.nome}
                    onChange={(e) => setNewApp({ ...newApp, nome: e.target.value })}
                    className="w-full bg-[#374151] border border-gray-600 rounded-xl p-3 focus:ring-2 focus:ring-[#facc15] outline-none transition-all"
                    placeholder="Ex: STAR XC"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-gray-500 uppercase flex items-center justify-between">
                    <span>Link para Download</span>
                    <span className="text-[10px] text-gray-400">Ou use o botão abaixo</span>
                  </label>
                  <input
                    type="text"
                    value={newApp.downloadUrl}
                    onChange={(e) => setNewApp({ ...newApp, downloadUrl: e.target.value })}
                    className="w-full bg-[#374151] border border-gray-600 rounded-xl p-3 focus:ring-2 focus:ring-[#facc15] outline-none transition-all"
                    placeholder="Link para Mediafire/GitHub"
                  />
                  <div className="mt-2">
                    <button
                      onClick={handleNewAppGithubUpload}
                      disabled={isUploadingNewAppGithub}
                      className={`w-full flex items-center justify-center gap-2 bg-[#374151] hover:bg-[#4b5563] border border-dashed border-gray-500 rounded-xl p-3 transition-all text-sm font-bold ${isUploadingNewAppGithub ? 'opacity-50 cursor-not-allowed' : ''}`}
                    >
                      {isUploadingNewAppGithub ? (
                        <div className="flex items-center gap-2 animate-pulse text-[#facc15]">
                          <Github className="animate-spin" size={18} /> SUBINDO APK...
                        </div>
                      ) : (
                        <><Github size={18} /> SUBIR APK PARA GITHUB RELEASES</>
                      )}
                    </button>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-gray-500 uppercase">PIN</label>
                    <input
                      type="text"
                      value={newApp.pin}
                      onChange={(e) => setNewApp({ ...newApp, pin: e.target.value })}
                      className="w-full bg-[#374151] border border-gray-600 rounded-xl p-3 focus:ring-2 focus:ring-[#facc15] outline-none transition-all"
                      placeholder="Ex: 1234"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-gray-500 uppercase">Tamanho</label>
                    <input
                      type="text"
                      value={newApp.tamanho}
                      onChange={(e) => setNewApp({ ...newApp, tamanho: e.target.value })}
                      className="w-full bg-[#374151] border border-gray-600 rounded-xl p-3 focus:ring-2 focus:ring-[#facc15] outline-none transition-all"
                      placeholder="Ex: 85 MB"
                    />
                  </div>
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-gray-500 uppercase flex items-center justify-between">
                    <span>URL do Ícone</span>
                    <span className="text-[10px] text-gray-400">Ou use o botão abaixo</span>
                  </label>
                  <input
                    type="text"
                    value={newApp.iconUrl}
                    onChange={(e) => setNewApp({ ...newApp, iconUrl: e.target.value })}
                    className="w-full bg-[#374151] border border-gray-600 rounded-xl p-3 focus:ring-2 focus:ring-[#facc15] outline-none transition-all text-sm"
                    placeholder="https://..."
                  />
                  <div className="mt-2">
                    <label className="flex items-center justify-center gap-2 bg-[#374151] hover:bg-[#4b5563] border border-dashed border-gray-500 rounded-xl p-3 cursor-pointer transition-all text-sm font-bold">
                      <Upload size={18} /> {newApp.iconUrl.startsWith('data:') ? 'IMAGEM CARREGADA' : 'SUBIR IMAGEM'}
                      <input 
                        id="app-icon-upload"
                        type="file" 
                        accept="image/*" 
                        className="hidden" 
                        onChange={(e) => handleFileChange(e, 'app')}
                      />
                    </label>
                  </div>
                </div>
                <button
                  onClick={handleAddApp}
                  className="w-full bg-[#22c55e] hover:bg-[#16a34a] text-white py-4 rounded-xl font-bold text-lg transition-all mt-4 flex items-center justify-center gap-2 shadow-lg"
                >
                  <Plus size={24} /> CRIAR APLICATIVO
                </button>
              </div>
            </section>

            <section>
              <h2 className="text-[#facc15] text-2xl font-bold mb-4 flex items-center gap-2">
                <Save size={24} /> LISTA GLOBAL
              </h2>
              <div className="space-y-4">
                <AnimatePresence>
                  {apps.map((app) => (
                    <motion.div
                      key={app.id}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: 20 }}
                      className="bg-[#1f2937] rounded-2xl p-5 border-l-8 border-[#facc15] shadow-lg flex flex-col gap-4"
                    >
                      <div className="flex justify-between items-start">
                        <h3 className="font-bold text-lg text-white uppercase">{app.nome}</h3>
                        <div className="flex gap-2">
                          <button 
                            onClick={() => handleGithubUpload(app)}
                            disabled={isUploadingGithub === app.id}
                            className={`p-2 rounded-lg transition-all ${isUploadingGithub === app.id ? 'bg-gray-600 animate-pulse' : 'bg-[#374151] hover:bg-[#4b5563] text-[#facc15]'}`}
                            title="Subir APK para GitHub Release"
                          >
                            <Github size={20} />
                          </button>
                          <button 
                            onClick={() => handleDeleteApp(app.id)}
                            className="text-red-500 hover:bg-red-500/10 p-2 rounded-lg transition-colors"
                          >
                            <Trash2 size={20} />
                          </button>
                        </div>
                      </div>
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-gray-500 uppercase">Link de Download</label>
                        <div className="flex gap-2">
                          <input
                            type="text"
                            defaultValue={app.downloadUrl}
                            id={`link-${app.id}`}
                            className="flex-1 bg-[#374151] border border-gray-600 rounded-lg p-2 text-sm outline-none"
                          />
                          <button
                            onClick={() => {
                              const input = document.getElementById(`link-${app.id}`) as HTMLInputElement;
                              handleUpdateAppLink(app.id, input.value);
                            }}
                            className="bg-[#22c55e] hover:bg-[#16a34a] p-2 rounded-lg transition-colors"
                          >
                            <Save size={20} />
                          </button>
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>
            </section>
          </div>
        ) : (
          <div className="space-y-10">
            {!editingStoreId ? (
              <>
                <section>
                  <h2 className="text-[#facc15] text-2xl font-bold mb-4 flex items-center gap-2">
                    <Plus size={24} /> NOVA SUB-LOJA
                  </h2>
                  <div className="bg-[#1f2937] rounded-2xl p-6 border border-gray-700 shadow-xl space-y-4">
                    <div className="space-y-1">
                      <label className="text-xs font-bold text-gray-500 uppercase">Nome da Loja</label>
                      <input
                        type="text"
                        value={newStore.nome}
                        onChange={(e) => setNewStore({ ...newStore, nome: e.target.value })}
                        className="w-full bg-[#374151] border border-gray-600 rounded-xl p-3 focus:ring-2 focus:ring-[#facc15] outline-none transition-all"
                        placeholder="Ex: Revenda VIP"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs font-bold text-gray-500 uppercase">Slug (URL)</label>
                      <input
                        type="text"
                        value={newStore.slug}
                        onChange={(e) => setNewStore({ ...newStore, slug: e.target.value.toLowerCase().replace(/\s+/g, '-') })}
                        className="w-full bg-[#374151] border border-gray-600 rounded-xl p-3 focus:ring-2 focus:ring-[#facc15] outline-none transition-all"
                        placeholder="ex: revenda-vip"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs font-bold text-gray-500 uppercase flex items-center justify-between">
                        <span>URL do Logo</span>
                        <span className="text-[10px] text-gray-400">Ou use o botão abaixo</span>
                      </label>
                      <input
                        type="text"
                        value={newStore.logoUrl}
                        onChange={(e) => setNewStore({ ...newStore, logoUrl: e.target.value })}
                        className="w-full bg-[#374151] border border-gray-600 rounded-xl p-3 focus:ring-2 focus:ring-[#facc15] outline-none transition-all text-sm"
                        placeholder="https://..."
                      />
                      <div className="mt-2">
                        <label className="flex items-center justify-center gap-2 bg-[#374151] hover:bg-[#4b5563] border border-dashed border-gray-500 rounded-xl p-3 cursor-pointer transition-all text-sm font-bold">
                          <Upload size={18} /> {newStore.logoUrl.startsWith('data:') ? 'LOGO CARREGADO' : 'SUBIR LOGO'}
                          <input 
                            id="store-logo-upload"
                            type="file" 
                            accept="image/*" 
                            className="hidden" 
                            onChange={(e) => handleFileChange(e, 'store')}
                          />
                        </label>
                      </div>
                    </div>
                    <button
                      onClick={handleAddStore}
                      className="w-full bg-[#22c55e] hover:bg-[#16a34a] text-white py-4 rounded-xl font-bold text-lg transition-all mt-4 flex items-center justify-center gap-2 shadow-lg"
                    >
                      <Plus size={24} /> CRIAR SUB-LOJA
                    </button>
                  </div>
                </section>

                <section>
                  <h2 className="text-[#facc15] text-2xl font-bold mb-4 flex items-center gap-2">
                    <Store size={24} /> LOJAS EXISTENTES
                  </h2>
                  <div className="space-y-4">
                    {stores.map(store => (
                      <div key={store.id} className="bg-[#1f2937] rounded-2xl p-5 border border-gray-700 flex items-center justify-between group">
                        <div className="flex items-center gap-4">
                          {store.logoUrl ? (
                            <img src={store.logoUrl} className="w-12 h-12 rounded-lg object-contain bg-white/5 p-1" alt={store.nome} />
                          ) : (
                            <div className="w-12 h-12 rounded-lg bg-gray-700 flex items-center justify-center"><Store size={20} /></div>
                          )}
                          <div>
                            <h3 className="font-bold text-white uppercase">{store.nome}</h3>
                            <p className="text-xs text-gray-500">Slug: {store.slug}</p>
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <button 
                            onClick={() => copyStoreLink(store.slug, store.id)}
                            className={`p-2 rounded-lg transition-all ${copiedId === store.id ? 'bg-green-500 text-white' : 'bg-[#374151] hover:bg-[#4b5563] text-[#facc15]'}`}
                            title="Copiar Link da Loja"
                          >
                            {copiedId === store.id ? <Check size={20} /> : <Copy size={20} />}
                          </button>
                          <button 
                            onClick={() => setEditingStoreId(store.id)}
                            className="bg-[#374151] hover:bg-[#4b5563] p-2 rounded-lg text-[#facc15] transition-all"
                            title="Configurar Apps"
                          >
                            <Settings size={20} />
                          </button>
                          <button 
                            onClick={() => handleDeleteStore(store.id)}
                            className="bg-red-500/10 hover:bg-red-500/20 p-2 rounded-lg text-red-500 transition-all"
                            title="Excluir Loja"
                          >
                            <Trash2 size={20} />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </section>
              </>
            ) : (
              <section>
                <div className="flex items-center justify-between mb-6">
                  <button 
                    onClick={() => setEditingStoreId(null)}
                    className="text-gray-400 hover:text-white flex items-center gap-2 font-bold"
                  >
                    ← VOLTAR
                  </button>
                  <h2 className="text-[#facc15] text-xl font-bold uppercase">
                    Configurar: {stores.find(s => s.id === editingStoreId)?.nome}
                  </h2>
                </div>
                
                <p className="text-sm text-gray-400 mb-6 bg-white/5 p-4 rounded-xl border border-gray-700">
                  Selecione quais aplicativos devem aparecer nesta sub-loja. Por padrão, todos aparecem.
                </p>

                <div className="space-y-3">
                  {apps.map(app => {
                    const store = stores.find(s => s.id === editingStoreId);
                    const isExcluded = store?.excludedAppIds?.includes(app.id);
                    
                    return (
                      <div 
                        key={app.id}
                        onClick={() => handleToggleAppVisibility(editingStoreId, app.id)}
                        className={`p-4 rounded-2xl border-2 cursor-pointer transition-all flex items-center justify-between ${isExcluded ? 'bg-red-500/5 border-red-500/20 opacity-50' : 'bg-green-500/5 border-green-500/20'}`}
                      >
                        <div className="flex items-center gap-3">
                          {app.iconUrl ? (
                            <img src={app.iconUrl} className="w-10 h-10 rounded-lg object-cover" alt="" />
                          ) : (
                            <div className="w-10 h-10 bg-gray-700 rounded-lg flex items-center justify-center"><Package size={16}/></div>
                          )}
                          <span className={`font-bold uppercase ${isExcluded ? 'text-gray-500' : 'text-white'}`}>{app.nome}</span>
                        </div>
                        <div className={`p-2 rounded-lg ${isExcluded ? 'text-red-500' : 'text-green-500'}`}>
                          {isExcluded ? <EyeOff size={24} /> : <Eye size={24} />}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </section>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

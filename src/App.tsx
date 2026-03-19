/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect } from 'react';
import { PublicStore } from './components/PublicStore';
import { AdminPanel } from './components/AdminPanel';
import { Settings } from 'lucide-react';

export default function App() {
  const [isAdmin, setIsAdmin] = useState(false);

  // Simple routing based on URL hash or state
  useEffect(() => {
    const handleHashChange = () => {
      setIsAdmin(window.location.hash === '#admin');
    };
    window.addEventListener('hashchange', handleHashChange);
    handleHashChange(); // Initial check
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  return (
    <div className="relative">
      {isAdmin ? <AdminPanel /> : <PublicStore />}
      
      {/* Floating Admin Toggle for easy access during development */}
      <button 
        onClick={() => window.location.hash = isAdmin ? '' : 'admin'}
        className="fixed bottom-4 right-4 bg-gray-800/50 hover:bg-gray-800 text-gray-400 p-3 rounded-full backdrop-blur-sm transition-all z-50 border border-gray-700"
        title={isAdmin ? "Voltar para Loja" : "Painel Admin"}
      >
        <Settings size={20} />
      </button>
    </div>
  );
}

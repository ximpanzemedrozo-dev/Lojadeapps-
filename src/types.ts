export interface StoreData {
  id: string;
  nome: string;
  logoUrl: string;
  slug: string;
  excludedAppIds: string[]; // IDs of apps hidden in this store
  createdAt: number;
}

export interface AppData {
  id: string;
  nome: string;
  downloadUrl: string;
  pin: string;
  iconUrl: string;
  tamanho: string;
  createdAt: number;
}

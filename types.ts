
export type Role = 'user' | 'assistant' | 'system';

export interface Message {
  role: Role;
  content: string;
  timestamp: number;
}

export enum ModeKey {
  CRIATIVO = 'criativo',
  ANALITICO = 'analitico',
  CODIGO = 'codigo',
  ESCRITOR = 'escritor',
  ESPECIALISTA = 'especialista',
  CONSULTOR = 'consultor',
  MENTOR = 'mentor',
  INOVADOR = 'inovador',
  EXECUTOR = 'executor'
}

export interface ModeData {
  id: ModeKey;
  name: string;
  icon: string;
  description: string;
  prompt: string;
  color: string;
}

export interface AppSettings {
  theme: 'dark' | 'light';
  temperature: number;
  showSettings: boolean;
}

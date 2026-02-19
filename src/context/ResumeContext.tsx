import { createContext, useContext, useState, useCallback, type ReactNode } from 'react';
import defaultData from '../data/resume.json';

export type ResumeData = typeof defaultData;

interface ResumeContextType {
  data: ResumeData;
  editMode: boolean;
  setEditMode: (v: boolean) => void;
  update: (updater: (d: ResumeData) => void) => void;
  resetData: () => void;
  downloadJSON: () => void;
  loadData: (raw: ResumeData) => void;
}

const ResumeContext = createContext<ResumeContextType | null>(null);
const STORAGE_KEY = 'dn-cv-data';

function clone<T>(obj: T): T {
  return JSON.parse(JSON.stringify(obj));
}

export function ResumeProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState<ResumeData>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      return saved ? JSON.parse(saved) : clone(defaultData);
    } catch {
      return clone(defaultData);
    }
  });

  const [editMode, setEditMode] = useState(false);

  const update = useCallback((updater: (d: ResumeData) => void) => {
    setData(prev => {
      const next = clone(prev);
      updater(next);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      return next;
    });
  }, []);

  const resetData = useCallback(() => {
    if (!window.confirm('Réinitialiser toutes les données du CV ?')) return;
    const fresh = clone(defaultData);
    setData(fresh);
    localStorage.removeItem(STORAGE_KEY);
  }, []);

  const loadData = useCallback((raw: ResumeData) => {
    const fresh = clone(raw);
    setData(fresh);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(fresh));
  }, []);

  const downloadJSON = useCallback(() => {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'resume.json';
    a.click();
    URL.revokeObjectURL(url);
  }, [data]);

  return (
    <ResumeContext.Provider value={{ data, editMode, setEditMode, update, resetData, downloadJSON, loadData }}>
      {children}
    </ResumeContext.Provider>
  );
}

export function useResume() {
  const ctx = useContext(ResumeContext);
  if (!ctx) throw new Error('useResume must be used within ResumeProvider');
  return ctx;
}

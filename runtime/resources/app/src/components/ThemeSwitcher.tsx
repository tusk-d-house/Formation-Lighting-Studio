import React, { useEffect, useState } from 'react';

export type AppTheme = 'navy' | 'black' | 'white';

const STORAGE_KEY = 'fls_theme';

export const getStoredTheme = (): AppTheme => {
  const v = localStorage.getItem(STORAGE_KEY);
  return v === 'black' || v === 'white' || v === 'navy' ? v : 'navy';
};

export const applyTheme = (theme: AppTheme) => {
  document.documentElement.setAttribute('data-theme', theme);
  localStorage.setItem(STORAGE_KEY, theme);
};

const OPTIONS: { id: AppTheme; label: string; swatch: string }[] = [
  { id: 'navy', label: '紺', swatch: '#0f172a' },
  { id: 'black', label: '黒', swatch: '#000000' },
  { id: 'white', label: '白', swatch: '#f8fafc' },
];

export const ThemeSwitcher: React.FC = () => {
  const [theme, setTheme] = useState<AppTheme>(getStoredTheme());

  useEffect(() => {
    applyTheme(theme);
  }, [theme]);

  return (
    <div
      className="flex items-center bg-slate-950 p-1 rounded-lg border border-slate-800 gap-0.5"
      title="テーマカラー"
    >
      {OPTIONS.map((o) => (
        <button
          key={o.id}
          onClick={() => setTheme(o.id)}
          title={`テーマ: ${o.label}`}
          className={`px-1.5 py-1 rounded text-xs font-semibold flex items-center gap-1 transition ${
            theme === o.id
              ? 'bg-slate-800 text-sky-400'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <span
            className="w-3 h-3 rounded-full border border-slate-500 inline-block"
            style={{ backgroundColor: o.swatch }}
          />
          <span className="hidden xl:inline">{o.label}</span>
        </button>
      ))}
    </div>
  );
};

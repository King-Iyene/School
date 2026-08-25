import { useState, useEffect } from 'react';

declare global {
  interface Window {
    electronAPI?: { isElectron: boolean };
  }
}

export const isElectron = !!window.electronAPI?.isElectron;

function getCurrentPath(): string {
  if (isElectron) {
    const hash = window.location.hash;
    const fullPath = hash ? hash.slice(1) : '/dashboard';
    return fullPath.split('?')[0];
  }
  return window.location.pathname;
}

export function getSearchParams(): URLSearchParams {
  if (isElectron) {
    const hash = window.location.hash;
    const query = hash.includes('?') ? hash.substring(hash.indexOf('?')) : '';
    return new URLSearchParams(query);
  }
  return new URLSearchParams(window.location.search);
}

export function useLocation() {
  const [path, setPath] = useState(getCurrentPath);

  useEffect(() => {
    if (isElectron) {
      const handleHashChange = () => setPath(getCurrentPath());
      window.addEventListener('hashchange', handleHashChange);
      return () => window.removeEventListener('hashchange', handleHashChange);
    } else {
      const handlePopState = () => setPath(getCurrentPath());
      window.addEventListener('popstate', handlePopState);
      return () => window.removeEventListener('popstate', handlePopState);
    }
  }, []);

  return path;
}

export function navigate(path: string) {
  if (isElectron) {
    window.location.hash = path;
  } else {
    window.history.pushState({}, '', path);
    window.dispatchEvent(new PopStateEvent('popstate'));
  }
}

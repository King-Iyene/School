import { ReactNode, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'xl';
}

const sizeMap = {
  sm: 'max-w-sm',
  md: 'max-w-md',
  lg: 'max-w-lg',
  xl: 'max-w-2xl',
};

export default function Modal({ isOpen, onClose, title, children, size = 'md' }: ModalProps) {
  useEffect(() => {
    if (isOpen) document.body.style.overflow = 'hidden';
    else document.body.style.overflow = '';
    return () => { document.body.style.overflow = ''; };
  }, [isOpen]);

  if (!isOpen) return null;

  // Rendered via a portal straight onto <body> rather than in place — nested
  // deep inside the app shell, a `fixed inset-0` overlay can end up scoped to
  // whichever ancestor happens to introduce a transform/filter/etc (and thus
  // its own containing block) instead of the true viewport, leaving a gap at
  // an edge instead of covering the whole screen. A portal sidesteps that
  // entirely: the overlay is a direct child of <body>, so `fixed` always
  // resolves against the real viewport no matter where Modal is used from.
  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className={`relative bg-app-surface rounded-2xl shadow-2xl w-full ${sizeMap[size]} max-h-[90vh] flex flex-col`}>
        <div className="flex items-center justify-between p-5 border-b border-app-border">
          <h3 className="text-lg font-semibold text-app-text">{title}</h3>
          <button onClick={onClose} className="p-1.5 text-app-text-muted hover:text-app-text hover:bg-app-surface-alt rounded-lg transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="overflow-y-auto flex-1 p-5">{children}</div>
      </div>
    </div>,
    document.body
  );
}

import CustomToast from '@/app/componentes/CustomToast';
import { useState } from 'react';

export const useToastCustom = () => {
  const [toasts, setToasts] = useState<{ id: string; message: string; type?: string }[]>([]);

  const showToastCustom = (message: string, type?: 'success' | 'error' | 'info') => {
    // Garante ID único mesmo se renderizar duas vezes rapidamente
    const id = crypto.randomUUID();
    setToasts(prev => {
      // Evita adicionar o mesmo toast mais de uma vez
      if (prev.some(t => t.message === message && t.type === type)) {
        return prev;
      }
      return [...prev, { id, message, type }];
    });
  };

  const removeToast = (id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  };

  const ToastContainer = () => (
    <>
      {toasts.map(t => (
        <CustomToast
          key={t.id}
          message={t.message}
          type={t.type as any}
          onClose={() => removeToast(t.id)}
        />
      ))}
    </>
  );

  return { showToastCustom, ToastContainer };
};

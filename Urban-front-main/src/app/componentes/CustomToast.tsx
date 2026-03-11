'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { useEffect } from 'react';
import { CheckCircle, Info, AlertCircle, X } from 'lucide-react';

type ToastProps = {
  message: string;
  type?: 'success' | 'error' | 'info';
  duration?: number;
  onClose: () => void;
};

// Estilo inspirado em Ant Design, cores suaves e elegantes
const toastColors = {
  success: { bg: '#f6ffed', border: '#b7eb8f', icon: CheckCircle, iconColor: '#52c41a' },
  error: { bg: '#fff1f0', border: '#ffa39e', icon: AlertCircle, iconColor: '#f5222d' },
  info: { bg: '#e6f7ff', border: '#91d5ff', icon: Info, iconColor: '#1890ff' },
};

const CustomToast = ({ message, type = 'info', duration = 4000, onClose }: ToastProps) => {
  useEffect(() => {
    const timer = setTimeout(onClose, duration);
    return () => clearTimeout(timer);
  }, [duration, onClose]);

  const IconComponent = toastColors[type].icon;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: 40, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 40, scale: 0.95 }}
        transition={{ duration: 0.25 }}
        style={{
          position: 'fixed',
          bottom: 30,
          right: 30,
          zIndex: 9999,
        }}
      >
        <div
          onClick={onClose}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            background: toastColors[type].bg,
            border: `1px solid ${toastColors[type].border}`,
            padding: '16px 20px',
            borderRadius: '12px',
            minWidth: '320px',
            boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
            cursor: 'pointer',
            fontFamily: 'Inter, sans-serif',
          }}
        >
          <IconComponent size={24} color={toastColors[type].iconColor} />
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 600, fontSize: '14px', marginBottom: '4px', color: '#111' }}>
              {type.charAt(0).toUpperCase() + type.slice(1)}
            </div>
            <div style={{ fontSize: '13px', lineHeight: '1.4', color: '#333' }}>{message}</div>
          </div>
          <X size={18} color="#888" />
        </div>
      </motion.div>
    </AnimatePresence>
  );
};

export default CustomToast;

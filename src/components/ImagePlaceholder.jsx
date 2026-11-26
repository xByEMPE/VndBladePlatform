import { useTranslation } from "react-i18next";
import { tx } from "@/i18n/tx";
import React from 'react';
import { ImageIcon, Loader, AlertCircle } from 'lucide-react';

const ImagePlaceholder = ({ 
  state = 'loading', // 'loading', 'error', 'empty'
  className = '',
  message = '',
  showRetry = false,
  onRetry = null,
  ...props 
}) => {
  useTranslation();
  const baseClasses = `flex flex-col items-center justify-center ${className}`;

  if (state === 'loading') {
    return (
      <div className={`${baseClasses} bg-gray-100 animate-pulse`} {...props}>
        <Loader className="w-6 h-6 text-gray-400 animate-spin mb-2" />
        <span className="text-xs text-gray-500">{tx("Cargando imagen...")}</span>
      </div>
    );
  }

  if (state === 'error') {
    return (
      <div className={`${baseClasses} bg-red-50 border-2 border-dashed border-red-200`} {...props}>
        <AlertCircle className="w-6 h-6 text-red-400 mb-2" />
        <span className="text-xs text-red-500 mb-2 text-center">
          {message || tx("Error al cargar imagen")}
        </span>
        {showRetry && onRetry && (
          <button
            onClick={onRetry}
            className="text-xs bg-red-500 text-white px-2 py-1 rounded hover:bg-red-600 transition-colors"
          >
            {tx("Reintentar")}
          </button>
        )}
      </div>
    );
  }

  // state === 'empty'
  return (
    <div className={`${baseClasses} bg-gray-50 border-2 border-dashed border-gray-200`} {...props}>
      <ImageIcon className="w-6 h-6 text-gray-400 mb-2" />
      <span className="text-xs text-gray-500 text-center">
        {message || tx("Sin imágenes disponibles")}
      </span>
    </div>
  );
};

export default ImagePlaceholder;


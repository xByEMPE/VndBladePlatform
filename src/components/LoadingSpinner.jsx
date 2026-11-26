import { useTranslation } from "react-i18next";
import { tx } from "@/i18n/tx";
import React from 'react';

/**
 * Componente de spinner reutilizable que usa el isotipo de Bancos
 * @param {Object} props
 * @param {string} props.size - Tamaño del spinner ('sm', 'md', 'lg', o tamaño personalizado como 'w-8 h-8')
 * @param {string} props.className - Clases CSS adicionales
 * @param {string} props.text - Texto opcional a mostrar debajo del spinner
 * @param {boolean} props.inline - Si es true, usa flex-row en lugar de flex-col (útil para botones)
 */
const LoadingSpinner = ({ 
  size = 'md', 
  className = '', 
  text = null,
  textClassName = 'text-gray-400',
  inline = false
}) => {
  useTranslation();
  // Mapear tamaños predefinidos
  const sizeClasses = {
    sm: 'w-4 h-4',
    md: 'w-8 h-8',
    lg: 'w-12 h-12',
    xl: 'w-16 h-16'
  };

  // Si el size es un string personalizado (como 'w-6 h-6'), usarlo directamente
  const sizeClass = sizeClasses[size] || size;

  // Si no hay texto y es inline, solo mostrar la imagen sin contenedor flex
  if (inline && !text) {
    return (
      <img
        src="/icons/Isotipo_Bancos.png"
        alt={tx("Cargando...")}
        className={`${sizeClass} animate-spin ${className}`}
        style={{
          animation: 'spin 1s linear infinite'
        }}
      />
    );
  }

  return (
    <div className={`flex ${inline ? 'flex-row' : 'flex-col'} items-center justify-center ${className}`}>
      <img
        src="/icons/Isotipo_Bancos.png"
        alt={tx("Cargando...")}
        className={`${sizeClass} animate-spin`}
        style={{
          animation: 'spin 1s linear infinite'
        }}
      />
      {text && (
        <p className={inline ? `ml-2 ${textClassName}` : `mt-2 ${textClassName}`}>{text}</p>
      )}
    </div>
  );
};

export default LoadingSpinner;











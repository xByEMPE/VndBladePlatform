import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown, Globe } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import { Button } from '@/components/ui/button';

const LanguageSwitcher = ({ compact = false }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [dropdownPosition, setDropdownPosition] = useState({ top: 0, right: 0 });
  const buttonRef = useRef(null);
  const { currentLanguage, changeLanguage, languages } = useLanguage();

  const currentLang = languages.find(lang => lang.code === currentLanguage);

  // Calculate dropdown position when opening
  useEffect(() => {
    if (isOpen && buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      setDropdownPosition({
        top: rect.bottom + 8, // 8px gap
        right: window.innerWidth - rect.right,
      });
    }
  }, [isOpen]);

  const dropdownContent = (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Overlay para cerrar el dropdown */}
          <div
            className="fixed inset-0 z-[99998]"
            onClick={() => setIsOpen(false)}
          />
          
          <motion.div
            initial={{ opacity: 0, y: -10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: 0.95 }}
            transition={{ duration: 0.15 }}
            style={{
              top: `${dropdownPosition.top}px`,
              right: `${dropdownPosition.right}px`,
            }}
            className="fixed py-2 w-48 bg-slate-800/95 backdrop-blur-lg border border-slate-700/50 rounded-lg shadow-lg z-[99999]"
          >
            {languages.map((language) => (
              <button
                key={language.code}
                onClick={() => {
                  changeLanguage(language.code);
                  setIsOpen(false);
                }}
                className={`w-full px-4 py-2 text-left hover:bg-slate-700/50 transition-colors flex items-center gap-3 ${
                  currentLanguage === language.code
                    ? 'bg-yellow-500/10 text-yellow-400 border-l-2 border-yellow-500'
                    : 'text-gray-300'
                }`}
              >
                <span className="text-lg">{language.flag}</span>
                <span className="font-medium">{language.name}</span>
                {currentLanguage === language.code && (
                  <div className="ml-auto w-2 h-2 bg-yellow-500 rounded-full"></div>
                )}
              </button>
            ))}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );

  return (
    <>
      <div ref={buttonRef} className="relative z-[99999]">
        <Button
          variant="outline"
          size={compact ? "sm" : "default"}
          onClick={() => setIsOpen(!isOpen)}
          className={`bg-slate-800/70 backdrop-blur-md border-slate-700/50 hover:bg-slate-700/80 hover:border-yellow-500/50 text-white flex items-center transition-all ${
            compact ? 'h-8 gap-1.5 px-2.5' : 'gap-2'
          }`}
        >
          <Globe className={`text-ink ${compact ? 'w-3.5 h-3.5' : 'w-4 h-4'}`} />
          <span className={`hidden sm:inline font-medium ${compact ? 'text-xs' : 'text-sm'}`}>
            {currentLang?.flag} {currentLang?.name}
          </span>
          <span className={`sm:hidden ${compact ? 'text-base' : 'text-lg'}`}>
            {currentLang?.flag}
          </span>
          <ChevronDown
            className={`transition-transform duration-200 ${compact ? 'w-3.5 h-3.5' : 'w-4 h-4'} ${isOpen ? 'rotate-180' : ''}`}
          />
        </Button>
      </div>

      {/* Render dropdown in a portal at document.body level */}
      {typeof document !== 'undefined' && createPortal(dropdownContent, document.body)}
    </>
  );
};

export default LanguageSwitcher;


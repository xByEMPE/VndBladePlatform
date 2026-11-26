import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { FileDown, Globe, CheckCircle } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useLanguage } from '@/contexts/LanguageContext';
import { Button } from '@/components/ui/button';
import LoadingSpinner from './LoadingSpinner';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

const LanguagePdfDialog = ({ isOpen, onClose, onConfirm, isGenerating }) => {
  const { t } = useTranslation('reports');
  const { languages, currentLanguage } = useLanguage();
  const [selectedLanguage, setSelectedLanguage] = useState(currentLanguage);

  const handleConfirm = () => {
    onConfirm(selectedLanguage);
  };

  const handleLanguageSelect = (languageCode) => {
    setSelectedLanguage(languageCode);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="bg-slate-800/95 backdrop-blur-lg border-slate-700/50 text-white max-w-md">
        <DialogHeader>
          <DialogTitle className="text-yellow-500 flex items-center gap-2">
            <FileDown className="w-5 h-5" />
            {t('buttons.exportPdf')}
          </DialogTitle>
          <DialogDescription className="text-gray-300">
            {t('buttons.selectLanguage')}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 py-4">
          {languages.map((language) => (
            <motion.button
              key={language.code}
              onClick={() => handleLanguageSelect(language.code)}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              className={`w-full p-4 rounded-lg border-2 transition-all flex items-center gap-3 ${
                selectedLanguage === language.code
                  ? 'border-yellow-500 bg-yellow-500/10 text-yellow-400'
                  : 'border-slate-600 bg-slate-700/50 text-gray-300 hover:border-slate-500 hover:bg-slate-700/70'
              }`}
            >
              <div className="flex items-center gap-3 flex-1">
                <span className="text-2xl">{language.flag}</span>
                <div className="text-left">
                  <div className="font-medium">{language.name}</div>
                  <div className="text-sm opacity-75">{language.code.toUpperCase()}</div>
                </div>
              </div>
              {selectedLanguage === language.code && (
                <CheckCircle className="w-5 h-5 text-yellow-500" />
              )}
            </motion.button>
          ))}
        </div>

        <DialogFooter className="gap-2">
          <Button
            variant="outline"
            onClick={onClose}
            disabled={isGenerating}
            className="bg-slate-700/50 border-slate-600 text-white hover:bg-slate-700 hover:border-slate-500"
          >
            {t('buttons.cancel', 'Cancelar')}
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={isGenerating}
            className="bg-yellow-600 hover:bg-yellow-700 text-black font-medium"
          >
            {isGenerating ? (
              <div className="flex items-center gap-2">
                <LoadingSpinner size="sm" inline />
                {t('buttons.exportingPdf')}
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <FileDown className="w-4 h-4" />
                {t('buttons.exportPdf')}
              </div>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default LanguagePdfDialog;


import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { AlertTriangle, Trash2, Loader, X, AlertCircle } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { getProjectDeletionSummary } from '@/utils/deleteProjectCascade';

// Estilos del diálogo destructivo (tokens del Design System; error sobrio, sin rojos vivos)
const BTN_CANCEL = 'flex-1 border-line-medium text-ink hover:bg-surface-card';
const BTN_DESTRUCTIVE = 'flex-1 border border-error-border bg-error-bg text-error-text hover:bg-error-border/40';

const DeleteProjectDialog = ({
  isOpen,
  onClose,
  project,
  onConfirmDelete,
  isDeleting = false,
  deleteProgress = ''
}) => {
  const { t } = useTranslation('common');
  const [confirmationText, setConfirmationText] = useState('');
  const [dataSummary, setDataSummary] = useState(null);
  const [loadingSummary, setLoadingSummary] = useState(false);
  const [showAdvancedConfirmation, setShowAdvancedConfirmation] = useState(false);

  const isConfirmationValid = confirmationText === t('deleteProject.delete');

  useEffect(() => {
    if (isOpen && project) {
      setConfirmationText('');
      setShowAdvancedConfirmation(false);
      loadProjectSummary();
    }
  }, [isOpen, project]);

  const loadProjectSummary = async () => {
    if (!project?.id) return;

    setLoadingSummary(true);
    try {
      const summary = await getProjectDeletionSummary(project.id);
      setDataSummary(summary);
    } catch (error) {
      console.warn('Error cargando resumen del proyecto:', error);
      setDataSummary(null);
    } finally {
      setLoadingSummary(false);
    }
  };

  const handleInitialConfirm = () => {
    setShowAdvancedConfirmation(true);
  };

  const handleFinalConfirm = () => {
    if (isConfirmationValid) {
      onConfirmDelete();
    }
  };

  const handleClose = () => {
    if (!isDeleting) {
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-surface-base/70 backdrop-blur-sm flex items-center justify-center z-50 p-4"
        onClick={handleClose}
      >
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.9, opacity: 0 }}
          className="w-full max-w-2xl"
          onClick={(e) => e.stopPropagation()}
        >
          <Card className="bg-surface-panel border-error-border shadow-2xl">
            <CardHeader className="pb-4">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-error-bg border border-error-border rounded-full flex items-center justify-center">
                    <AlertTriangle className="w-6 h-6 text-error-text" />
                  </div>
                  <div>
                    <CardTitle className="text-error-text text-xl">
                      {t('deleteProject.deleteProjectCompletely')}
                    </CardTitle>
                    <p className="text-ink-muted text-sm mt-1">
                      {project?.name} • {project?.wind_farm}
                    </p>
                  </div>
                </div>
                {!isDeleting && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleClose}
                    className="text-ink-muted hover:text-ink p-1"
                  >
                    <X className="w-5 h-5" />
                  </Button>
                )}
              </div>
            </CardHeader>

            <CardContent className="space-y-6">
              {/* Advertencia principal */}
              <div className="bg-error-bg border border-error-border rounded-lg p-4">
                <div className="flex items-start gap-3">
                  <AlertCircle className="w-5 h-5 text-error-text mt-0.5 flex-shrink-0" />
                  <div>
                    <h4 className="font-semibold text-error-text mb-2">
                      ⚠️ {t('deleteProject.irreversibleAction')} ⚠️
                    </h4>
                    <p className="text-ink text-sm">
                      {t('deleteProject.irreversibleActionDescription')}
                    </p>
                  </div>
                </div>
              </div>

              {/* Resumen de datos a eliminar */}
              <div>
                <h4 className="font-semibold text-ink mb-3">
                  {t('deleteProject.dataToBeDeleted')}
                </h4>

                {loadingSummary ? (
                  <div className="flex items-center gap-2 text-ink-muted">
                    <Loader className="w-4 h-4 animate-spin text-ink" />
                    <span>{t('deleteProject.calculatingDataToBeDeleted')}</span>
                  </div>
                ) : dataSummary ? (
                  <div className="grid grid-cols-2 gap-3">
                    <div className="bg-surface-card rounded-lg p-3">
                      <div className="text-brand font-mono font-bold text-lg">{dataSummary.staff}</div>
                      <div className="text-ink-muted text-sm">{t('deleteProject.teamMembers')}</div>
                    </div>
                    <div className="bg-surface-card rounded-lg p-3">
                      <div className="text-info font-mono font-bold text-lg">{dataSummary.turbines}</div>
                      <div className="text-ink-muted text-sm">{t('deleteProject.turbines')}</div>
                    </div>
                    <div className="bg-surface-card rounded-lg p-3">
                      <div className="text-status-done font-mono font-bold text-lg">{dataSummary.blades}</div>
                      <div className="text-ink-muted text-sm">{t('deleteProject.blades')}</div>
                    </div>
                    <div className="bg-surface-card rounded-lg p-3">
                      <div className="text-ink font-mono font-bold text-lg">{dataSummary.inspectionFiles}</div>
                      <div className="text-ink-muted text-sm">{t('deleteProject.inspectionFiles')}</div>
                    </div>
                    <div className="bg-surface-card rounded-lg p-3 col-span-2">
                      <div className="text-error-text font-mono font-bold text-lg">{dataSummary.damages}</div>
                      <div className="text-ink-muted text-sm">{t('deleteProject.damages')}</div>
                    </div>
                  </div>
                ) : (
                  <div className="text-ink-muted">
                    • {t('deleteProject.teamMembers')}
                    <br />
                    • {t('deleteProject.turbines')}
                    <br />
                    • {t('deleteProject.inspectionFiles')}
                    <br />
                    • {t('deleteProject.damages')}
                  </div>
                )}
              </div>

              {/* Estado de eliminación */}
              {isDeleting && (
                <div className="bg-brand/10 border border-brand/30 rounded-lg p-4">
                  <div className="flex items-center gap-3">
                    <Loader className="w-5 h-5 text-ink animate-spin" />
                    <div>
                      <div className="font-semibold text-brand">
                        {t('deleteProject.deletingProject')}
                      </div>
                      <div className="text-ink-muted text-sm mt-1">
                        {deleteProgress || t('deleteProject.processingDeletion')}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Confirmación por pasos */}
              {!showAdvancedConfirmation && !isDeleting && (
                <div className="flex gap-3">
                  <Button
                    variant="outline"
                    onClick={handleClose}
                    className={BTN_CANCEL}
                  >
                    {t('common.cancel')}
                  </Button>
                  <Button
                    variant="destructive"
                    onClick={handleInitialConfirm}
                    disabled={loadingSummary}
                    className={BTN_DESTRUCTIVE}
                  >
                    {t('deleteProject.continueWithDeletion')}
                  </Button>
                </div>
              )}

              {/* Confirmación avanzada */}
              {showAdvancedConfirmation && !isDeleting && (
                <div className="space-y-4">
                  <div className="bg-surface-card rounded-lg p-4 border border-error-border">
                    <Label htmlFor="confirmation" className="text-ink font-medium">
                      {t('deleteProject.confirmDeletion')}
                      <span className="text-error-text font-bold"> {t('deleteProject.delete')}</span>
                    </Label>
                    <Input
                      id="confirmation"
                      value={confirmationText}
                      onChange={(e) => setConfirmationText(e.target.value)}
                      placeholder={t('deleteProject.confirmDeletionPlaceholder')}
                      className="mt-2 bg-surface-card border-line-subtle text-ink"
                      autoFocus
                    />
                    {confirmationText && !isConfirmationValid && (
                      <p className="text-error-text text-sm mt-2">
                        {t('deleteProject.confirmDeletionText')}
                      </p>
                    )}
                  </div>

                  <div className="flex gap-3">
                    <Button
                      variant="outline"
                      onClick={() => setShowAdvancedConfirmation(false)}
                      className={BTN_CANCEL}
                    >
                      {t('deleteProject.back')}
                    </Button>
                    <Button
                      variant="destructive"
                      onClick={handleFinalConfirm}
                      disabled={!isConfirmationValid}
                      className={`${BTN_DESTRUCTIVE} disabled:opacity-50`}
                    >
                      <Trash2 className="w-4 h-4 mr-2" />
                      {t('deleteProject.deletePermanently')}
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};

export default DeleteProjectDialog;

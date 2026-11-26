import { tx } from "@/i18n/tx";
import React, { useState, useEffect } from 'react';
import { Button } from './ui/button';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { 
  ArrowUp, ArrowDown, RotateCw, 
  Wind, MapPin, Ruler, 
  ChevronLeft, ChevronRight,
  Eye, EyeOff
} from 'lucide-react';
import { 
  getImagesByHeight, 
  findClosestImageByHeight, 
  getTurbineHeightRange,
  getSectionHeightStats 
} from '../utils/navigationUtils';
import { useTranslation } from 'react-i18next';

const HeightNavigation = ({ 
  currentImage, 
  projectId, 
  turbineId, 
  onNavigateToImage,
  tolerance = 0.05 
}) => {
  const { t } = useTranslation();
  const [navigationData, setNavigationData] = useState(null);
  const [adjacentImages, setAdjacentImages] = useState([]);
  const [heightRange, setHeightRange] = useState(null);
  const [loading, setLoading] = useState(false);
  const [showDetails, setShowDetails] = useState(false);

  // Cargar datos de navegación cuando cambie la imagen actual
  useEffect(() => {
    if (currentImage?.inspection_file_id && projectId && turbineId) {
      loadNavigationData();
    }
  }, [currentImage?.inspection_file_id, projectId, turbineId]);

  const loadNavigationData = async () => {
    setLoading(true);
    try {
      // Obtener datos de navegación de la imagen actual
      const navData = currentImage.navigation_data;
      if (!navData?.h_norm) {
        console.warn('[HeightNavigation] No hay datos de altura para la imagen actual');
        setLoading(false);
        return;
      }

      // Obtener imágenes con altura similar
      const similarImages = await getImagesByHeight(
        projectId, 
        turbineId, 
        navData.h_norm, 
        tolerance
      );

      // Obtener rango de alturas de la turbina
      const range = await getTurbineHeightRange(projectId, turbineId);

      setNavigationData(navData);
      setAdjacentImages(similarImages);
      setHeightRange(range);

    } catch (error) {
      console.error('[HeightNavigation] Error cargando datos:', error);
    } finally {
      setLoading(false);
    }
  };

  const navigateToAdjacentImage = async (targetSection) => {
    if (!navigationData?.h_norm) return;

    try {
      const closestImage = await findClosestImageByHeight(
        projectId,
        turbineId,
        navigationData.h_norm,
        targetSection
      );

      if (closestImage && onNavigateToImage) {
        onNavigateToImage(closestImage);
      }
    } catch (error) {
      console.error('[HeightNavigation] Error navegando a imagen:', error);
    }
  };

  const getHeightPercentage = () => {
    if (!navigationData?.h_norm || !heightRange) return 0;
    return ((navigationData.h_norm - heightRange.min) / (heightRange.max - heightRange.min)) * 100;
  };

  const getSectionColor = (section) => {
    const colors = {
      'TE': 'bg-blue-500',
      'PS': 'bg-green-500', 
      'LE': 'bg-yellow-500',
      'SS': 'bg-red-500'
    };
    return colors[section] || 'bg-gray-500';
  };

  const formatHeight = (height) => {
    if (height === null || height === undefined) return 'N/A';
    return `${(height * 100).toFixed(1)}%`;
  };

  if (loading) {
    return (
      <Card className="w-full">
        <CardContent className="p-4">
          <div className="flex items-center justify-center">
            <RotateCw className="w-4 h-4 animate-spin mr-2" />
            <span className="text-sm text-gray-500">
              {t('heightNavigation.loading')}
            </span>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!navigationData?.h_norm) {
    return (
      <Card className="w-full">
        <CardContent className="p-4">
          <div className="text-center text-gray-500">
            <Ruler className="w-8 h-8 mx-auto mb-2 opacity-50" />
            <p className="text-sm">
              {t('heightNavigation.noHeightData')}
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="w-full">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg flex items-center">
            <Ruler className="w-5 h-5 mr-2" />
            {t('heightNavigation.title')}
          </CardTitle>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowDetails(!showDetails)}
          >
            {showDetails ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          </Button>
        </div>
      </CardHeader>
      
      <CardContent className="space-y-4">
        {/* Indicador de altura actual */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-600">
              {t('heightNavigation.currentHeight')}
            </span>
            <span className="font-mono font-medium">
              {formatHeight(navigationData.h_norm)}
            </span>
          </div>
          
          {heightRange && (
            <div className="relative">
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div 
                  className="bg-blue-500 h-2 rounded-full transition-all duration-300"
                  style={{ width: `${getHeightPercentage()}%` }}
                />
              </div>
              <div className="flex justify-between text-xs text-gray-500 mt-1">
                <span>{formatHeight(heightRange.min)}</span>
                <span>{formatHeight(heightRange.max)}</span>
              </div>
            </div>
          )}
        </div>

        {/* Botones de navegación a secciones adyacentes */}
        <div className="space-y-2">
          <h4 className="text-sm font-medium text-gray-700">
            {t('heightNavigation.navigateToSection')}
          </h4>
          <div className="grid grid-cols-2 gap-2">
            {['TE', 'PS', 'LE', 'SS'].map(section => (
              <Button
                key={section}
                variant="outline"
                size="sm"
                onClick={() => navigateToAdjacentImage(section)}
                className="flex items-center justify-center space-x-1"
                disabled={currentImage?.section === section}
              >
                <div className={`w-2 h-2 rounded-full ${getSectionColor(section)}`} />
                <span className="text-xs">{section}</span>
              </Button>
            ))}
          </div>
        </div>

        {/* Detalles adicionales */}
        {showDetails && (
          <div className="space-y-3 pt-3 border-t">
            <h4 className="text-sm font-medium text-gray-700">
              {t('heightNavigation.details')}
            </h4>
            
            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="space-y-1">
                <span className="text-gray-500">H_rel:</span>
                <span className="font-mono">
                  {navigationData.h_rel ? `${navigationData.h_rel.toFixed(2)}m` : 'N/A'}
                </span>
              </div>
              <div className="space-y-1">
                <span className="text-gray-500">{tx("Radio:")}</span>
                <span className="font-mono">
                  {navigationData.r ? `${navigationData.r.toFixed(2)}m` : 'N/A'}
                </span>
              </div>
              <div className="space-y-1">
                <span className="text-gray-500">X:</span>
                <span className="font-mono">
                  {navigationData.x ? `${navigationData.x.toFixed(2)}m` : 'N/A'}
                </span>
              </div>
              <div className="space-y-1">
                <span className="text-gray-500">Y:</span>
                <span className="font-mono">
                  {navigationData.y ? `${navigationData.y.toFixed(2)}m` : 'N/A'}
                </span>
              </div>
            </div>

            {/* Imágenes con altura similar */}
            {adjacentImages.length > 0 && (
              <div className="space-y-2">
                <h5 className="text-xs font-medium text-gray-600">
                  {t('heightNavigation.similarHeight')} ({adjacentImages.length})
                </h5>
                <div className="max-h-32 overflow-y-auto space-y-1">
                  {adjacentImages.slice(0, 5).map((img, index) => (
                    <div 
                      key={index}
                      className="flex items-center justify-between p-2 bg-gray-50 rounded text-xs cursor-pointer hover:bg-gray-100"
                      onClick={() => onNavigateToImage && onNavigateToImage(img)}
                    >
                      <div className="flex items-center space-x-2">
                        <div className={`w-2 h-2 rounded-full ${getSectionColor(img.inspection_files.section)}`} />
                        <span>{img.inspection_files.section}</span>
                        <span className="text-gray-500">
                          {img.inspection_files.blades.blade_name}
                        </span>
                      </div>
                      <span className="font-mono text-gray-600">
                        {formatHeight(img.h_norm)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default HeightNavigation;

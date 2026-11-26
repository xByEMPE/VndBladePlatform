import { useTranslation } from "react-i18next";
import { tx } from "@/i18n/tx";
import React, { useState, useRef, useEffect, useCallback } from 'react';
import { ImageIcon, AlertCircle, RefreshCw } from 'lucide-react';
import ImagePlaceholder from './ImagePlaceholder';

// Pool de carga para controlar concurrencia
class ImageLoadingPool {
  constructor(maxConcurrent = 3) {
    this.maxConcurrent = maxConcurrent;
    this.queue = [];
    this.active = new Set();
    this.failed = new Set(); // Track failed URLs to prevent infinite retries
  }

  add(loadFunction, url) {
    return new Promise((resolve, reject) => {
      // If this URL has failed too many times, reject immediately
      if (this.failed.has(url)) {
        reject(new Error('URL marked as failed'));
        return;
      }

      this.queue.push({ loadFunction, resolve, reject, url });
      this.processQueue();
    });
  }

  markFailed(url) {
    this.failed.add(url);
  }

  async processQueue() {
    if (this.active.size >= this.maxConcurrent || this.queue.length === 0) {
      return;
    }

    const { loadFunction, resolve, reject, url } = this.queue.shift();
    const activePromise = loadFunction()
      .then(resolve)
      .catch((error) => {
        console.warn(`Image loading failed for ${url}:`, error);
        reject(error);
      })
      .finally(() => {
        this.active.delete(activePromise);
        this.processQueue();
      });

    this.active.add(activePromise);
  }
}

// Instancia global del pool
const imagePool = new ImageLoadingPool(3);

// Cache de imágenes cargadas
const imageCache = new Map();

// Utilidad para limpiar y validar URLs
const processImageUrl = (url) => {
  if (!url) return '';
  
  // Para URLs de Supabase que ya vienen con encoding, usar tal como están
  if (url.includes('supabase.co') || url.includes('%')) {
    console.log('Supabase URL detected, using as-is:', url.substring(0, 100) + '...');
    return url;
  }
  
  // Para otras URLs, aplicar encoding si es necesario
  try {
    const urlObj = new URL(url);
    return urlObj.toString();
  } catch (error) {
    console.warn('Invalid URL format:', url, error);
    return url;
  }
};

// Función de debug para URLs problemáticas
const debugUrl = (url, error) => {
  console.group('🔍 URL Debug Info');
  console.log('Original URL:', url);
  console.log('URL length:', url?.length || 0);
  console.log('Contains %:', url?.includes('%') || false);
  console.log('Contains spaces:', url?.includes(' ') || false);
  console.log('Error:', error);
  
  if (url) {
    try {
      const urlObj = new URL(url);
      console.log('Parsed successfully:', {
        protocol: urlObj.protocol,
        hostname: urlObj.hostname,
        pathname: urlObj.pathname,
        search: urlObj.search
      });
    } catch (e) {
      console.log('URL parsing failed:', e.message);
    }
  }
  console.groupEnd();
};

const OptimizedImage = ({
  src,
  alt = '',
  className = '',
  onClick,
  onLoad,
  onError,
  enableRetry = true,
  maxRetries = 3,
  retryDelay = 1000,
  lazyLoad = true,
  placeholder = null,
  fallbackComponent = null,
  thumbnailSrc = null,
  useProgressiveLoading = false, // New: enable blur-up effect
  ...props
}) => {
  useTranslation();
  const [currentSrc, setCurrentSrc] = useState(thumbnailSrc || src);
  const [isUsingThumbnail, setIsUsingThumbnail] = useState(!!thumbnailSrc);
  const [retryCount, setRetryCount] = useState(0);
  const [loadingState, setLoadingState] = useState('loading'); // 'loading', 'loaded', 'error'
  const [showFullImage, setShowFullImage] = useState(false); // For progressive loading
  const imgRef = useRef(null);
  const retryTimeoutRef = useRef(null);
  const [isIntersecting, setIsIntersecting] = useState(!lazyLoad);

  // Procesar la URL para manejar caracteres especiales
  const processedSrc = processImageUrl(currentSrc);

  // Reset states when src/thumbnailSrc changes
  useEffect(() => {
    if (thumbnailSrc) {
        setIsUsingThumbnail(true);
        setCurrentSrc(thumbnailSrc);
    } else {
        setIsUsingThumbnail(false);
        setCurrentSrc(src);
    }
    setLoadingState('loading');
    setRetryCount(0);
  }, [src, thumbnailSrc]);

  // Interaction Observer para lazy loading
  useEffect(() => {
    if (!lazyLoad) {
      setIsIntersecting(true);
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsIntersecting(true);
          observer.disconnect();
        }
      },
      {
        rootMargin: '50px',
        threshold: 0.1
      }
    );

    if (imgRef.current) {
      observer.observe(imgRef.current);
    }

    return () => {
      observer.disconnect();
    };
  }, [lazyLoad]);

  // Función para cargar imagen con cache
  const loadImage = useCallback(async () => {
    if (!processedSrc) {
      setLoadingState('error');
      return;
    }

    // Verificar cache
    if (imageCache.has(processedSrc)) {
      setLoadingState('loaded');
      onLoad?.();
      return;
    }

    return imagePool.add(async () => {
      return new Promise((resolve, reject) => {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        
        img.onload = () => {
          imageCache.set(processedSrc, true);
          setLoadingState('loaded');
          onLoad?.();
          resolve();
        };

        img.onerror = (error) => {
          // If thumbnail failed, we reject here to trigger retryLoad/fallback logic
          console.warn(`Error cargando imagen (${isUsingThumbnail ? 'thumbnail' : 'full'}) (intento ${retryCount + 1}):`, processedSrc);
          reject(error);
        };

        img.src = processedSrc;
      });
    }, processedSrc);
  }, [processedSrc, retryCount, onLoad, isUsingThumbnail]);

  // Función para reintentar carga
  const retryLoad = useCallback(() => {
    // FALLBACK LOGIC: If thumbnail fails, switch to original immediately without retrying thumbnail
    if (isUsingThumbnail) {
        setIsUsingThumbnail(false);
        setCurrentSrc(src);
        setRetryCount(0);
        setLoadingState('loading');
        return;
    }

    if (retryCount >= maxRetries) {
      console.warn(`Max retries (${maxRetries}) reached for image:`, processedSrc);
      imagePool.markFailed(processedSrc);
      setLoadingState('error');
      onError?.(new Error(`Failed to load image after ${maxRetries} attempts`));
      return;
    }

    setRetryCount(prev => prev + 1);
    setLoadingState('loading');
    
    retryTimeoutRef.current = setTimeout(() => {
      loadImage().catch((error) => {
          // logic managed by re-render if state changes (fallback), or error state
          if (isUsingThumbnail) {
             // Should have been handled above, but just in case
             setIsUsingThumbnail(false);
             setCurrentSrc(src);
             setRetryCount(0);
          } else if (retryCount + 1 >= maxRetries) {
             setLoadingState('error');
             onError?.(error);
          }
      });
    }, retryDelay * Math.pow(2, retryCount)); // Backoff exponencial
  }, [retryCount, maxRetries, retryDelay, loadImage, onError, processedSrc, isUsingThumbnail, src]);

  // Cargar imagen cuando sea visible
  useEffect(() => {
    if (isIntersecting && processedSrc && loadingState === 'loading') {
      // Reset retry count for new image loads
      if (retryCount > 0) {
        setRetryCount(0);
      }
      
      loadImage().catch((error) => {
        console.warn('Initial load failed for:', processedSrc);
        if ((enableRetry && retryCount === 0) || isUsingThumbnail) {
          retryLoad();
        } else {
          console.warn('Not retrying, enableRetry:', enableRetry, 'retryCount:', retryCount);
          setLoadingState('error');
          onError?.(error);
        }
      });
    }
  }, [isIntersecting, processedSrc, loadingState]); // Removed dependencies that could cause loops

  // Función para manejar retry desde el placeholder
  const handleRetry = (e) => {
    e?.stopPropagation();
    retryLoad();
  };

  // Estados de renderizado
  if (loadingState === 'loading') {
    return (
      <div ref={imgRef} className={className}>
        {placeholder || (
          <ImagePlaceholder 
            state="loading" 
            className="w-full h-full min-h-[60px]"
          />
        )}
      </div>
    );
  }

  if (loadingState === 'error') {
    return (
      <div ref={imgRef} className={className}>
        {fallbackComponent || (
          <ImagePlaceholder 
            state="error" 
            className="w-full h-full min-h-[60px]"
            message={retryCount > 0 ? tx("Error al cargar imagen (intento {{n}})", { n: retryCount + 1 }) : tx("Error al cargar imagen")}
            showRetry={enableRetry && retryCount < maxRetries}
            onRetry={handleRetry}
          />
        )}
      </div>
    );
  }

  // Imagen cargada exitosamente
  const imageStyle = useProgressiveLoading && !showFullImage 
    ? { filter: 'blur(10px)', transition: 'filter 0.3s ease-out' }
    : { filter: 'blur(0px)', transition: 'filter 0.3s ease-out' };

  return (
    <img
      ref={imgRef}
      src={processedSrc}
      alt={alt}
      className={className}
      style={imageStyle}
      onClick={onClick}
      onError={(e) => {
        console.warn('Direct img onError triggered for:', processedSrc);
        if (enableRetry && retryCount < maxRetries) {
          retryLoad();
        } else {
          setLoadingState('error');
          onError?.(e);
        }
      }}
      onLoad={() => {
        setLoadingState('loaded');
        
        // If using progressive loading and currently showing thumbnail, load full image
        if (useProgressiveLoading && isUsingThumbnail && !showFullImage) {
          // Start loading full image
          const fullImg = new Image();
          fullImg.src = src;
          fullImg.onload = () => {
            setCurrentSrc(src);
            setIsUsingThumbnail(false);
            setShowFullImage(true);
          };
        } else {
          setShowFullImage(true);
        }
        
        onLoad?.();
      }}
      {...props}
    />
  );
};

// Hook para precargar imágenes
export const useImagePreloader = () => {
  const preloadImages = useCallback(async (urls) => {
    const preloadPromises = urls.map(url => {
      const processedUrl = processImageUrl(url);
      
      if (imageCache.has(processedUrl)) {
        return Promise.resolve();
      }

      return imagePool.add(async () => {
        return new Promise((resolve, reject) => {
          const img = new Image();
          img.crossOrigin = 'anonymous';
          img.onload = () => {
            imageCache.set(processedUrl, true);
            resolve();
          };
          img.onerror = reject;
          img.src = processedUrl;
        });
      }, processedUrl);
    });

    try {
      await Promise.allSettled(preloadPromises);
    } catch (error) {
      console.warn('Error preloading some images:', error);
    }
  }, []);

  const resetFailedUrls = useCallback(() => {
    clearFailedUrls();
  }, []);

  return { preloadImages, resetFailedUrls };
};

// Utilidad para limpiar cache y URLs fallidas
export const clearImageCache = () => {
  imageCache.clear();
  imagePool.failed.clear();
};

// Utilidad para limpiar solo URLs fallidas
export const clearFailedUrls = () => {
  imagePool.failed.clear();
};

export default OptimizedImage;

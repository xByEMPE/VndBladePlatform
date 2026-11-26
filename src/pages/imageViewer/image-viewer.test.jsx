import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ViewerTopBar } from './components/ViewerTopBar';
import { ThumbnailsPanel } from './components/ThumbnailsPanel';

vi.mock('@/i18n/tx', () => ({ tx: (s) => s }));

const t = (k) => k;
const baseProps = () => ({
  t,
  toast: vi.fn(),
  userRole: 'admin',
  setEditingDetection: vi.fn(),
  setNewDetection: vi.fn(),
  isCreatingDetection: false,
  setIsCreatingDetection: vi.fn(),
  zoom: 1,
  brightness: 100,
  setBrightness: vi.fn(),
  contrast: 100,
  setContrast: vi.fn(),
  negativeMode: false,
  setNegativeMode: vi.fn(),
  showRuler: true,
  setShowRuler: vi.fn(),
  isStitched: false,
  calibSaving: false,
  calibStep: null,
  setCalibStep: vi.fn(),
  setCalibTipTemp: vi.fn(),
  calibLength: '',
  setCalibLength: vi.fn(),
  downloading: false,
  setDownloading: vi.fn(),
  toolMode: 'none',
  setToolMode: vi.fn(),
  polygons: [],
  setPolygons: vi.fn(),
  currentImage: { file_name: 'pala-A.jpg', src: 'https://x/y.jpg' },
  canCalibrate: false,
  savedCalib: null,
  stitchedRuler: null,
  startCalibration: vi.fn(),
  commitCalibLength: vi.fn(),
  clearCalibration: vi.fn(),
  handleZoom: vi.fn(),
  resetView: vi.fn(),
});

const renderBar = (over = {}) => {
  const props = { ...baseProps(), ...over };
  render(<ViewerTopBar {...props} />);
  return props;
};

describe('ViewerTopBar', () => {
  it('muestra el nombre de la imagen y el zoom actual', () => {
    renderBar({ zoom: 1.5 });
    expect(screen.getByRole('heading', { name: 'pala-A.jpg' })).toBeInTheDocument();
    expect(screen.getByText('150%')).toBeInTheDocument();
  });

  it('los controles de zoom y reinicio llaman a sus manejadores', () => {
    const p = renderBar();
    const [zoomOut, zoomIn, reset] = screen.getAllByRole('button').slice(0, 3);
    fireEvent.click(zoomOut);
    fireEvent.click(zoomIn);
    fireEvent.click(reset);
    expect(p.handleZoom).toHaveBeenNthCalledWith(1, -0.2);
    expect(p.handleZoom).toHaveBeenNthCalledWith(2, 0.2);
    expect(p.resetView).toHaveBeenCalledTimes(1);
  });

  it('la regla activa usa el estilo dorado; apagada, el neutro', () => {
    const { unmount } = render(<ViewerTopBar {...baseProps()} showRuler />);
    expect(screen.getByRole('button', { name: 'imageViewer.ruler' })).toHaveClass('border-amber-500/50', 'bg-amber-500/10', 'text-amber-400');
    unmount();
    render(<ViewerTopBar {...baseProps()} showRuler={false} />);
    expect(screen.getByRole('button', { name: 'imageViewer.ruler' })).not.toHaveClass('text-amber-400');
  });

  it('descargar es verde tintado (receta de los rojos y amarillos), no sólido', () => {
    renderBar();
    const dl = screen.getByRole('button', { name: 'imageViewer.download' });
    expect(dl).toHaveClass('border-status-done/40', 'bg-status-done/10', 'text-status-done', 'hover:bg-status-done/25');
    expect(dl.className).not.toMatch(/bg-green|bg-status-done(?!\/)/);
  });

  it('"Añadir daño" solo lo ve el administrador y arma el modo de creación', () => {
    const p = renderBar();
    fireEvent.click(screen.getByRole('button', { name: 'imageViewer.addDamage' }));
    expect(p.setToolMode).toHaveBeenCalledWith('area');
    expect(p.setIsCreatingDetection).toHaveBeenCalledWith(true);
    expect(p.setPolygons).toHaveBeenCalledWith([]);
    expect(p.toast).toHaveBeenCalled();
  });

  it('un técnico/cliente no ve "Añadir daño"', () => {
    renderBar({ userRole: 'client' });
    expect(screen.queryByRole('button', { name: 'imageViewer.addDamage' })).toBeNull();
  });

  it('en modo creación el botón pasa a verde y cambia su texto', () => {
    renderBar({ isCreatingDetection: true });
    expect(screen.getByRole('button', { name: 'imageViewer.drawing' })).toHaveClass('text-status-done');
  });

  it('cruz y área alternan su herramienta; activas usan celeste y morado', () => {
    const p = renderBar();
    fireEvent.click(screen.getByRole('button', { name: /imageViewer.crosshair/ }));
    expect(p.setToolMode).toHaveBeenCalledWith('crosshair');
    fireEvent.click(screen.getByRole('button', { name: /imageViewer.area/ }));
    expect(p.setToolMode).toHaveBeenCalledWith('area');
  });

  it('herramientas activas conservan sus colores originales', () => {
    const { unmount } = render(<ViewerTopBar {...baseProps()} toolMode="crosshair" />);
    expect(screen.getByRole('button', { name: /imageViewer.crosshair/ })).toHaveClass('text-blue-300');
    unmount();
    render(<ViewerTopBar {...baseProps()} toolMode="area" />);
    expect(screen.getByRole('button', { name: /imageViewer.area/ })).toHaveClass('text-purple-300');
  });

  it('"Reiniciar mediciones" (vino) aparece con polígonos en modo área y los borra', () => {
    const p = renderBar({ toolMode: 'area', polygons: [[{ x: 1, y: 1 }]] });
    const reset = screen.getByRole('button', { name: 'imageViewer.resetMeasurements' });
    expect(reset).toHaveClass('text-rose-300');
    fireEvent.click(reset);
    expect(p.setPolygons).toHaveBeenCalledWith([]);
  });

  it('el modo negativo expone aria-pressed y alterna', () => {
    const p = renderBar({ negativeMode: true });
    const btn = screen.getByRole('button', { name: 'imageViewer.invertColors' });
    expect(btn).toHaveAttribute('aria-pressed', 'true');
    expect(btn).toHaveClass('text-purple-300');
    fireEvent.click(btn);
    expect(p.setNegativeMode).toHaveBeenCalledWith(false);
  });

  it('los controles deslizantes llaman a sus setters', () => {
    const p = renderBar();
    const [bright, contr] = screen.getAllByRole('slider');
    fireEvent.change(bright, { target: { value: '120' } });
    fireEvent.change(contr, { target: { value: '80' } });
    expect(p.setBrightness).toHaveBeenCalledWith(120);
    expect(p.setContrast).toHaveBeenCalledWith(80);
  });

  it('stitched: oculta cruz/área y muestra "Calibrar regla" en dorado para quien puede calibrar', () => {
    const p = renderBar({ isStitched: true, canCalibrate: true });
    expect(screen.queryByRole('button', { name: /imageViewer.crosshair/ })).toBeNull();
    const cal = screen.getByRole('button', { name: 'Calibrar regla' });
    expect(cal).toHaveClass('text-amber-400');
    fireEvent.click(cal);
    expect(p.startCalibration).toHaveBeenCalledTimes(1);
  });

  it('stitched calibrando: muestra la instrucción en dorado y "Cancelar" restablece el paso', () => {
    const p = renderBar({ isStitched: true, canCalibrate: true, calibStep: 'tip' });
    expect(screen.getByText('1/2 · Clic en la PUNTA de la pala')).toHaveClass('text-brand');
    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }));
    expect(p.setCalibStep).toHaveBeenCalledWith(null);
    expect(p.setCalibTipTemp).toHaveBeenCalledWith(null);
  });

  it('stitched con calibración guardada: muestra mm/px y "Borrar"', () => {
    const p = renderBar({ isStitched: true, canCalibrate: true, savedCalib: { tipY: 1, rootY: 2 }, stitchedRuler: { mmPerPx: 12.34 } });
    expect(screen.getByText('12.3 mm/px')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Borrar' }));
    expect(p.clearCalibration).toHaveBeenCalledTimes(1);
  });
});

describe('ThumbnailsPanel', () => {
  const images = [
    { id: 1, section: 'LE', name: 'a.jpg', src: 's1', path: 'p1', position_meters: 2 },
    { id: 2, section: 'LE', name: 'b.jpg', src: 's2', path: 'p2' },
    { id: 3, section: 'TE', name: 'c.jpg', src: 's3', path: 'p3' },
  ];
  const renderPanel = (over = {}) => {
    const setCurrentImageIndex = vi.fn();
    render(
      <ThumbnailsPanel
        t={t}
        isStitched={false}
        isSidebarOpen
        allImages={images}
        setCurrentImageIndex={setCurrentImageIndex}
        currentImage={images[0]}
        {...over}
      />,
    );
    return setCurrentImageIndex;
  };

  it('lista solo las imágenes de la misma sección y cuenta los elementos', () => {
    renderPanel();
    expect(screen.getByText('a.jpg')).toBeInTheDocument();
    expect(screen.getByText('b.jpg')).toBeInTheDocument();
    expect(screen.queryByText('c.jpg')).toBeNull();
    expect(screen.getByText(/2 common.items/)).toBeInTheDocument();
  });

  it('la imagen seleccionada va en celeste y las demás en neutro', () => {
    renderPanel();
    expect(screen.getByText('a.jpg')).toHaveClass('text-status-progress');
    expect(screen.getByText('a.jpg').closest('div[class*="rounded-lg"]')).toHaveClass('bg-status-progress/15');
    expect(screen.getByText('b.jpg')).toHaveClass('text-ink');
  });

  it('al hacer clic cambia a la imagen con su índice original', () => {
    const set = renderPanel();
    fireEvent.click(screen.getByText('b.jpg'));
    expect(set).toHaveBeenCalledWith(1);
  });

  it('colapsado: ancho 0 y transparente', () => {
    const { container } = render(
      <ThumbnailsPanel t={t} isStitched={false} isSidebarOpen={false} allImages={images} setCurrentImageIndex={() => {}} currentImage={images[0]} />,
    );
    expect(container.firstChild).toHaveClass('w-0');
    expect(container.firstChild.style.opacity).toBe('0');
  });
});

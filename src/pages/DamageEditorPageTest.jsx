import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';

const DamageEditorPageTest = () => {
  const navigate = useNavigate();
  const location = useLocation();

  console.log('[TEST DamageEditor] Página cargada');
  console.log('[TEST DamageEditor] location.state:', location.state);

  const { imageSrc, damageInfo } = location.state || {};

  return (
    <div className="min-h-screen bg-slate-900 text-white p-4">
      <button
        onClick={() => navigate(-1)}
        className="flex items-center gap-2 px-4 py-2 bg-slate-700 rounded mb-4"
      >
        <ArrowLeft className="w-4 h-4" />
        Regresar
      </button>

      <h1 className="text-2xl font-bold mb-4">DAMAGE EDITOR TEST</h1>

      <div className="bg-slate-800 p-4 rounded">
        <h2 className="text-xl mb-2">Datos recibidos:</h2>
        <pre className="text-xs overflow-auto">
          {JSON.stringify(location.state, null, 2)}
        </pre>
      </div>

      {imageSrc && (
        <div className="mt-4">
          <img src={imageSrc} alt="Test" className="max-w-full h-auto" />
        </div>
      )}
    </div>
  );
};

export default DamageEditorPageTest;

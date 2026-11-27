# VND Platform v2 - Documentación Técnica Completa

## 📋 Índice
1. [Resumen Ejecutivo](#resumen-ejecutivo)
2. [Arquitectura del Sistema](#arquitectura-del-sistema)
3. [Tecnologías y Stack](#tecnologías-y-stack)
4. [Estructura del Proyecto](#estructura-del-proyecto)
5. [Sistema de Autenticación y Roles](#sistema-de-autenticación-y-roles)
6. [Módulos Principales](#módulos-principales)
7. [Base de Datos](#base-de-datos)
8. [Componentes UI](#componentes-ui)
9. [Servicios y APIs](#servicios-y-apis)
10. [Sistema de Traducción](#sistema-de-traducción)
11. [Configuración y Despliegue](#configuración-y-despliegue)
12. [Flujos de Trabajo](#flujos-de-trabajo)

---

## Resumen Ejecutivo

**VND Platform v2** (también conocida como **Visus AI** o **Vind Report Platform**) es una aplicación web integral desarrollada en React para la gestión completa de proyectos de inspección de turbinas eólicas. La plataforma proporciona herramientas especializadas para captura de datos, generación de reportes técnicos, seguimiento de progreso, y administración de proyectos con un sistema de roles robusto.

### Información del Proyecto
- **Nombre**: Visus AI / VND Platform v2
- **Versión**: 2.0.1
- **Tipo**: Aplicación Web SPA (Single Page Application)
- **Propietario**: VIND GROUP
- **Estado**: Producción

### Características Principales
- ✅ Sistema de autenticación multi-rol con Supabase
- ✅ Gestión completa de proyectos de inspección
- ✅ Captura masiva y optimización de imágenes
- ✅ Generación de reportes PDF y DOCX
- ✅ Sistema de permisos granular por rol
- ✅ Traducción automática ES/EN con LibreTranslate
- ✅ Dashboard interactivo con métricas en tiempo real
- ✅ Visualización 3D de palas de turbina
- ✅ Sistema de navegación por alturas de pala
- ✅ Interface responsive y moderna

---

## Arquitectura del Sistema

### Arquitectura General

```
┌─────────────────────────────────────────────────────────────┐
│                        FRONTEND (React)                     │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐       │
│  │   Pages      │  │  Components  │  │   Contexts   │       │
│  │  (Routing)   │  │     (UI)     │  │   (State)    │       │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘       │
│         │                  │                  │             │
│  ┌──────┴──────────────────┴──────────────────┴────────┐    │
│  │              React Router + State Management         │   │
│  └──────────────────────────┬──────────────────────────┘    │
└─────────────────────────────┼───────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                   CAPA DE SERVICIOS                         │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐       │
│  │   Supabase   │  │LibreTranslate│  │    Utils     │       │
│  │   Client     │  │  Translation │  │   Services   │       │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘       │
└─────────┼──────────────────┼──────────────────┼─────────────┘
          │                  │                  │
          ▼                  ▼                  ▼
┌─────────────────────────────────────────────────────────────┐
│                      BACKEND (Supabase)                     │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐       │
│  │  PostgreSQL  │  │     Auth     │  │   Storage    │       │
│  │   Database   │  │   (RLS/JWT)  │  │   (Images)   │       │
│  └──────────────┘  └──────────────┘  └──────────────┘       │
└─────────────────────────────────────────────────────────────┘
```

### Patrones de Diseño Implementados

1. **Component-Based Architecture**: Componentes React reutilizables
2. **Context API**: Manejo de estado global (autenticación, idioma)
3. **Custom Hooks**: Lógica reutilizable (useRolePermissions)
4. **Service Layer**: Separación de lógica de negocio
5. **Route Guards**: Protección de rutas por roles
6. **Optimistic UI**: Actualizaciones inmediatas con sincronización posterior

---

## Tecnologías y Stack

### Frontend Core
```json
{
  "react": "^18.2.0",
  "react-dom": "^18.2.0",
  "react-router-dom": "^6.16.0",
  "vite": "^4.4.5"
}
```

### UI Framework y Componentes
```json
{
  "tailwindcss": "^3.3.3",
  "@radix-ui/react-*": "^1.0.x - ^2.0.x",
  "lucide-react": "^0.292.0",
  "framer-motion": "^10.16.4",
  "class-variance-authority": "^0.7.0"
}
```

**Radix UI Components utilizados**:
- Alert Dialog, Avatar, Checkbox, Dialog, Dropdown Menu
- Label, Popover, Select, Slider, Slot, Tabs, Toast

### Backend as a Service
```json
{
  "@supabase/supabase-js": "^2.55.0"
}
```

**Servicios de Supabase utilizados**:
- Authentication (con gestión de roles)
- PostgreSQL Database (con RLS)
- Storage (para imágenes de inspección)
- Realtime subscriptions
- Edge Functions (RPC)

### Generación de Reportes
```json
{
  "docx": "^9.5.1",
  "jspdf": "^3.0.1",
  "html2canvas": "^1.4.1"
}
```

### Visualización 3D
```json
{
  "three": "^0.180.0",
  "@types/three": "^0.180.0"
}
```

### Internacionalización
```json
{
  "i18next": "^25.4.2",
  "react-i18next": "^15.7.3"
}
```

### Servidor y Middleware
```json
{
  "express": "^4.18.2",
  "cors": "^2.8.5"
}
```

### Herramientas de Desarrollo
```json
{
  "@vitejs/plugin-react": "^4.0.3",
  "autoprefixer": "^10.4.16",
  "postcss": "^8.4.31",
  "eslint": "^8.57.1",
  "terser": "^5.39.0"
}
```

---

## Estructura del Proyecto

### Árbol de Directorios

```
VNDplatformv2/
├── src/
│   ├── components/           # Componentes React reutilizables
│   │   ├── ui/              # Componentes UI base (Radix UI)
│   │   │   ├── button.jsx
│   │   │   ├── card.jsx
│   │   │   ├── dialog.jsx
│   │   │   ├── input.jsx
│   │   │   ├── select.jsx
│   │   │   ├── toast.jsx
│   │   │   └── ...
│   │   ├── DeleteProjectDialog.jsx
│   │   ├── EditableImageViewer.jsx
│   │   ├── Header.jsx
│   │   ├── HeightNavigation.jsx
│   │   ├── ImageLoadingStats.jsx
│   │   ├── ImagePlaceholder.jsx
│   │   ├── LanguagePdfDialog.jsx
│   │   ├── LanguageSwitcher.jsx
│   │   ├── OptimizedImage.jsx
│   │   ├── PageGuard.jsx
│   │   ├── ReportGenerator.jsx
│   │   ├── ReportPreview.jsx
│   │   ├── RoleGuard.jsx
│   │   ├── RoleInfo.jsx
│   │   ├── TurbineBlade3DModel.jsx
│   │   ├── TurbineIdImageViewer.jsx
│   │   ├── UserManagement.jsx
│   │   └── WindTurbineIcon.jsx
│   │
│   ├── pages/               # Páginas principales de la aplicación
│   │   ├── AdminPage.jsx
│   │   ├── DashboardPage.jsx
│   │   ├── DataCapturePage.jsx
│   │   ├── GeneralProgressPage.jsx
│   │   ├── InvitePage.jsx
│   │   ├── LoginPage.jsx
│   │   ├── PasswordResetPage.jsx
│   │   ├── ProjectsPage.jsx
│   │   ├── ReportEditorPage.jsx
│   │   ├── ReportsPortalPage.jsx
│   │   └── ReportViewerPage.jsx
│   │
│   ├── contexts/            # React Contexts para estado global
│   │   └── LanguageContext.jsx
│   │
│   ├── hooks/               # Custom React Hooks
│   │   └── useRolePermissions.js
│   │
│   ├── utils/               # Funciones utilitarias de negocio
│   │   ├── blades.js
│   │   ├── dataSync.js
│   │   ├── deleteProjectCascade.js
│   │   ├── navigationUtils.js
│   │   ├── projectFiltering.js
│   │   ├── projectPermissions.js
│   │   ├── smartUpload.js
│   │   ├── translationUtils.js
│   │   ├── turbineProgress.js
│   │   └── userManagement.js
│   │
│   ├── services/            # Servicios externos
│   │   ├── hybridTranslationService.js
│   │   └── libreTranslationService.js
│   │
│   ├── api/                 # APIs y endpoints
│   │   └── heightNavigation.js
│   │
│   ├── config/              # Archivos de configuración
│   │   └── translationConfig.js
│   │
│   ├── lib/                 # Librerías y configuraciones externas
│   │   ├── supabase.js
│   │   └── utils.js
│   │
│   ├── i18n/                # Configuración de internacionalización
│   │   └── i18n.js
│   │
│   ├── locales/             # Archivos de traducción
│   │   ├── es/
│   │   │   ├── common.json
│   │   │   └── reports.json
│   │   └── en/
│   │       ├── common.json
│   │       └── reports.json
│   │
│   ├── docs/                # Documentación del proyecto
│   │   ├── Arquitectura.md
│   │   ├── Componentes.md
│   │   ├── Configuracion.md
│   │   ├── Despliegue.md
│   │   ├── GuiaDesarrollo.md
│   │   ├── ImageOptimization.md
│   │   ├── Indice.md
│   │   ├── README.md
│   │   └── Utilidades.md
│   │
│   ├── App.jsx              # Componente principal de la app
│   ├── main.jsx             # Punto de entrada
│   └── index.css            # Estilos globales
│
├── public/                  # Archivos estáticos públicos
├── dist/                    # Build de producción
├── tools/                   # Herramientas de build
│   ├── generate-llms.js
│   └── post-build.js
├── middleware/              # Middleware del servidor
├── node_modules/            # Dependencias
│
├── .env.local               # Variables de entorno locales
├── package.json             # Dependencias y scripts
├── vite.config.js           # Configuración de Vite
├── tailwind.config.js       # Configuración de Tailwind
├── postcss.config.js        # Configuración de PostCSS
├── vercel.json              # Configuración de Vercel
├── serve-spa.js             # Servidor SPA local
├── test-spa.js              # Test del servidor SPA
├── index.html               # HTML principal
└── README.md                # Documentación general
```

---

## Sistema de Autenticación y Roles

### Roles Definidos

El sistema implementa 3 roles principales:

```javascript
export const USER_ROLES = Object.freeze({
  ADMIN: 'admin',
  TECHNICIAN: 'technician',
  CLIENT: 'client',
});
```

### Jerarquía de Permisos

```
┌──────────────────────────────────────────────────────┐
│                      ADMIN                           │
│  ✓ Gestión completa de proyectos                     │
│  ✓ Creación/edición/eliminación de proyectos         │
│  ✓ Gestión de usuarios y roles                       │
│  ✓ Acceso a todas las páginas                        │
│  ✓ Configuración de traducción                       │
│  ✓ Visualización de todos los reportes               │
└──────────────────────────────────────────────────────┘
                         │
                         ▼
┌──────────────────────────────────────────────────────┐
│                   TECHNICIAN                         │
│  ✓ Captura de datos (DataCapturePage)                │
│  ✓ Carga de imágenes                                 │
│  ✓ Solo proyectos asignados                          │
│  ✗ No acceso a reportes                              │
│  ✗ No gestión de proyectos                           │
└──────────────────────────────────────────────────────┘
                         │
                         ▼
┌──────────────────────────────────────────────────────┐
│                     CLIENT                           │
│  ✓ Visualización de progreso                        │
│  ✓ Portal de reportes (lectura)                     │
│  ✓ Visor de reportes                                │
│  ✓ Solo proyectos donde está asignado               │
│  ✗ No captura de datos                              │
│  ✗ No edición de proyectos                          │
└──────────────────────────────────────────────────────┘
```

### Mapa de Acceso por Rol

```javascript
export const ROLE_ACCESS = Object.freeze({
  [USER_ROLES.ADMIN]: [
    '/',                  // Dashboard
    '/projects',          // Gestión de Proyectos
    '/progress',          // Progreso General
    '/capture',           // Captura de Datos
    '/reports-portal',    // Portal de Reportes
    '/report-viewer',     // Visor de Reportes
    '/report-editor',     // Editor de Reportes
    '/admin'              // Panel de Administración
  ],
  [USER_ROLES.TECHNICIAN]: [
    '/',                  // Dashboard (redirige automáticamente)
    '/capture'            // SOLO acceso a captura de datos
  ],
  [USER_ROLES.CLIENT]: [
    '/',                  // Dashboard
    '/progress',          // Avance General
    '/reports-portal',    // Portal de Reportes
    '/report-viewer'      // Visualización de reportes
  ],
});
```

### Implementación de Autenticación

#### 1. Flujo de Login
```
Usuario ingresa credenciales
         ↓
Supabase Auth valida
         ↓
Se genera JWT token
         ↓
Se obtiene rol del usuario desde user_profiles
         ↓
Se actualiza estado global (React Context)
         ↓
Se redirige al Dashboard apropiado
```

#### 2. Componentes de Protección

**RoleGuard**: Protege componentes individuales
```jsx
<RoleGuard role={role} requiredRole="admin">
  <AdminPage />
</RoleGuard>
```

**PageGuard**: Protege páginas completas
```jsx
<PageGuard allowedRoles={['admin', 'client']}>
  <ReportsPortalPage />
</PageGuard>
```

#### 3. Custom Hook: useRolePermissions

```javascript
const {
  role,           // Rol actual del usuario
  loading,        // Estado de carga
  hasPermission,  // Función para verificar permisos
  canAccess,      // Función para verificar acceso a rutas
  isAdmin,        // Helper boolean
  isTechnician,   // Helper boolean
  isClient,       // Helper boolean
  refreshRole     // Función para refrescar el rol
} = useRolePermissions();
```

### Gestión de Sesiones

- **Persistencia**: Supabase mantiene sesión en localStorage
- **Auto-refresh**: Tokens se actualizan automáticamente
- **Detección de cambios**: onAuthStateChange detecta login/logout
- **Timeout**: Sesión expira según configuración de Supabase

---

## Módulos Principales

### 1. Dashboard (DashboardPage)

**Ruta**: `/`

**Funcionalidad**:
- Punto de entrada principal de la aplicación
- Muestra tarjetas de acceso rápido según rol
- Redirige automáticamente a técnicos a /capture
- Diseño responsivo con animaciones Framer Motion

**Tarjetas por Rol**:
- **Admin**: Projects, Progress, Capture, Reports Portal
- **Technician**: Capture (redirige automáticamente)
- **Client**: Progress, Reports Portal

---

### 2. Gestión de Proyectos (ProjectsPage)

**Ruta**: `/projects`
**Acceso**: Solo Admin

**Funcionalidades**:
- ✅ Creación de proyectos con formulario completo
- ✅ Edición de proyectos existentes
- ✅ Eliminación cascada de proyectos
- ✅ Gestión de equipo técnico por proyecto
- ✅ Configuración de:
  - Nombre del proyecto
  - Parque eólico
  - Cliente
  - Estado del proyecto
  - Número de turbinas
  - Fechas de inicio y fin
  - Gerente de parque
  - Líder técnico
  - Contratista
  - Personal de revisión
- ✅ Asignación de múltiples técnicos
- ✅ Validación de correos únicos por proyecto

**Campos del Formulario de Proyecto**:
```javascript
{
  name: String,                    // Requerido
  wind_farm: String,               // Requerido
  client: String,                  // Requerido
  status: Enum,                    // Planeación, En progreso, Completado, etc.
  turbine_count: Integer,          // Requerido
  start_date: Date,
  end_date: Date,
  park_manager: String,
  technical_lead: String,
  contractor: String,
  review_personnel: String,
  review_personnel_email: Email,
  staff: Array[{                   // Requerido (mínimo 1)
    full_name: String,
    role: String,
    email: String
  }]
}
```

---

### 3. Captura de Datos (DataCapturePage)

**Ruta**: `/capture`
**Acceso**: Admin, Technician

**Funcionalidades Principales**:

#### Carga de Imágenes
- Drag & drop de carpetas completas
- Organización automática por turbina
- Detección inteligente de blade/sección desde nombre de archivo
- Validación de formato de archivos
- Preview de imágenes antes de subir

#### Sistema de Organización
```
Estructura esperada:
TurbineName_BladeID_Section_Height.jpg

Ejemplo:
T01_A_LE_10.jpg
  ↓
Turbina: T01
Blade: A
Sección: LE (Leading Edge)
Altura: 10m
```

#### Smart Upload
- Evita duplicados usando hash MD5
- Optimización automática de imágenes
- Barra de progreso en tiempo real
- Manejo de errores por archivo
- Estadísticas de carga

#### Gestión de Blades
```javascript
// Sistema de blades por defecto
const DEFAULT_BLADES = ['A', 'B', 'C'];

// Secciones permitidas
const SECTIONS = ['TE', 'PS', 'LE', 'SS'];
```

#### Features Especiales
- 📊 Estadísticas de proyecto en tiempo real
- 🔄 Sincronización automática con DB
- 📁 Organización por turbina/blade/sección
- 🎯 Validación de integridad de datos
- ⚡ Carga masiva optimizada

---

### 4. Progreso General (GeneralProgressPage)

**Ruta**: `/progress`
**Acceso**: Admin, Client

**Funcionalidades**:

#### Vista de Proyectos
- Listado de todos los proyectos con acceso
- Filtrado por estado
- Métricas generales:
  - Total de turbinas
  - Progreso de captura
  - Estado del proyecto
  - Equipo asignado

#### Vista de Turbinas por Proyecto
- Progreso detallado por turbina
- Desglose por blade (A, B, C)
- Conteo de imágenes por sección
- Indicadores visuales de completitud
- Cálculo automático de progreso

#### Métricas de Progreso
```javascript
calculateTurbineProgress(imagesCount) {
  // Mínimo 100 imágenes = 100% completado
  return Math.min((imagesCount / 100) * 100, 100);
}
```

#### Indicadores Visuales
- 🟢 Verde: > 80% completado
- 🟡 Amarillo: 50-80% completado
- 🔴 Rojo: < 50% completado

---

### 5. Portal de Reportes (ReportsPortalPage)

**Ruta**: `/reports-portal`
**Acceso**: Admin, Client

**Funcionalidades**:
- Listado de todos los proyectos con reportes
- Navegación a reportes por turbina
- Filtros por:
  - Proyecto
  - Estado
  - Fecha
- Búsqueda de turbinas
- Visualización de metadatos:
  - Fecha de inspección
  - Total de imágenes
  - Estado de revisión

---

### 6. Visor de Reportes (ReportViewerPage)

**Ruta**: `/report-viewer/:projectId/:turbineName`
**Acceso**: Admin, Client

**Funcionalidades Principales**:

#### Visualización de Imágenes
- Navegación por altura de pala (Height Navigation)
- Visualización por sección (TE, PS, LE, SS)
- Zoom y pan de imágenes
- Comparación lado a lado
- Visualización en grid o lista

#### Edición de Imágenes (Solo Admin)
- Anotaciones con canvas
- Marcado de defectos
- Clasificación de severidad
- Comentarios por imagen

#### Modelo 3D
- Visualización 3D de la pala
- Rotación e inspección interactiva
- Indicadores de posición de defectos

#### Generación de Reportes
```javascript
Formatos disponibles:
- PDF (A4/Letter)
- DOCX (Word)
- Preview en navegador
```

#### Sistema de Traducción
- Traducción automática ES ↔ EN
- Integración con LibreTranslate (Space de Hugging Face)
- Fallback a sistema local
- Cache de traducciones

---

### 7. Editor de Reportes (ReportEditorPage)

**Ruta**: `/report-editor/:projectId/:turbineId`
**Acceso**: Solo Admin

**Funcionalidades**:
- Edición completa del reporte
- Gestión de secciones:
  - Resumen ejecutivo
  - Metodología
  - Hallazgos
  - Recomendaciones
  - Conclusiones
- Editor WYSIWYG
- Inserción de imágenes
- Formato de texto
- Vista previa en tiempo real
- Guardado automático

---

### 8. Panel de Administración (AdminPage)

**Ruta**: `/admin`
**Acceso**: Solo Admin

**Funcionalidades**:

#### Gestión de Usuarios
- Listado de todos los usuarios
- Cambio de roles
- Información de perfiles:
  - Email
  - Nombre completo
  - Empresa
  - Teléfono
  - Estado de invitación
  - Fecha de registro

#### Sistema de Invitaciones
- Envío de invitaciones por email
- Asignación de rol predefinido
- Tracking de invitaciones pendientes
- Reenvío de invitaciones

#### Configuración de traducción
- URL del Space de LibreTranslate (`VITE_LIBRETRANSLATE_URL`)
- Token opcional (`VITE_LIBRETRANSLATE_TOKEN`)
- Idiomas soportados: español e inglés

#### Estadísticas del Sistema
- Total de usuarios por rol
- Total de proyectos
- Total de turbinas
- Total de imágenes
- Uso de storage

---

## Base de Datos

### Esquema de Supabase PostgreSQL

#### Tabla: `user_profiles`
```sql
CREATE TABLE user_profiles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) UNIQUE NOT NULL,
  email TEXT UNIQUE NOT NULL,
  role TEXT CHECK (role IN ('admin', 'technician', 'client')) DEFAULT 'client',
  full_name TEXT,
  company TEXT,
  phone TEXT,
  invitation_accepted BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
```

**Políticas RLS**:
- ✅ Los usuarios pueden leer su propio perfil
- ✅ Solo admins pueden leer todos los perfiles
- ✅ Solo admins pueden actualizar roles

---

#### Tabla: `projects`
```sql
CREATE TABLE projects (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  wind_farm TEXT NOT NULL,
  client TEXT NOT NULL,
  status TEXT DEFAULT 'Planeación',
  turbine_count INTEGER NOT NULL,
  start_date TIMESTAMPTZ,
  end_date TIMESTAMPTZ,
  park_manager TEXT,
  technical_lead TEXT,
  contractor TEXT,
  review_personnel TEXT,
  review_personnel_email TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
```

**Índices**:
- `idx_projects_name` on name
- `idx_projects_client` on client
- `idx_projects_status` on status

---

#### Tabla: `staff`
```sql
CREATE TABLE staff (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  role TEXT NOT NULL,
  email TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);
```

**Restricciones**:
- Email único por proyecto (no globalmente)
- Relación cascada: eliminar proyecto elimina staff

---

#### Tabla: `turbines`
```sql
CREATE TABLE turbines (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  turbine_name TEXT NOT NULL,
  model TEXT,
  status TEXT DEFAULT 'Pendiente',
  inspection_date DATE,
  blade_length DECIMAL(10,2),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(project_id, turbine_name)
);
```

---

#### Tabla: `blades`
```sql
CREATE TABLE blades (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  turbine_id UUID REFERENCES turbines(id) ON DELETE CASCADE,
  blade_name TEXT NOT NULL, -- 'A', 'B', 'C'
  total_sections INTEGER DEFAULT 4, -- TE, PS, LE, SS
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(turbine_id, blade_name)
);
```

---

#### Tabla: `images`
```sql
CREATE TABLE images (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  blade_id UUID REFERENCES blades(id) ON DELETE CASCADE,
  turbine_id UUID REFERENCES turbines(id) ON DELETE CASCADE,
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  file_path TEXT NOT NULL,
  file_name TEXT NOT NULL,
  file_hash TEXT, -- MD5 hash para detección de duplicados
  section TEXT, -- 'TE', 'PS', 'LE', 'SS'
  height DECIMAL(10,2),
  file_size BIGINT,
  mime_type TEXT,
  metadata JSONB, -- Metadatos adicionales
  annotations JSONB, -- Anotaciones y marcas
  uploaded_at TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ DEFAULT now()
);
```

**Índices Importantes**:
- `idx_images_project` on project_id
- `idx_images_turbine` on turbine_id
- `idx_images_blade` on blade_id
- `idx_images_section` on section
- `idx_images_hash` on file_hash
- `idx_images_height` on height

---

#### Tabla: `reports`
```sql
CREATE TABLE reports (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  turbine_id UUID REFERENCES turbines(id) ON DELETE CASCADE,
  report_type TEXT, -- 'preliminary', 'final', 'technical'
  title TEXT,
  content JSONB, -- Contenido estructurado del reporte
  language TEXT DEFAULT 'es', -- 'es' o 'en'
  version INTEGER DEFAULT 1,
  status TEXT DEFAULT 'draft', -- 'draft', 'review', 'approved'
  created_by UUID REFERENCES auth.users(id),
  reviewed_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  published_at TIMESTAMPTZ
);
```

---

### Funciones RPC de Supabase

#### `get_current_user_role()`
```sql
CREATE OR REPLACE FUNCTION get_current_user_role()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN (
    SELECT role
    FROM user_profiles
    WHERE user_id = auth.uid()
  );
END;
$$;
```

#### `update_user_role(target_user_id UUID, new_role TEXT, updated_by_user_id UUID)`
```sql
CREATE OR REPLACE FUNCTION update_user_role(
  target_user_id UUID,
  new_role TEXT,
  updated_by_user_id UUID
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Validar que el usuario que actualiza sea admin
  IF (SELECT role FROM user_profiles WHERE user_id = updated_by_user_id) != 'admin' THEN
    RAISE EXCEPTION 'Only admins can update roles';
  END IF;

  -- Actualizar el rol
  UPDATE user_profiles
  SET role = new_role, updated_at = now()
  WHERE user_id = target_user_id;
END;
$$;
```

---

### Storage Buckets

#### Bucket: `images`
```javascript
Configuración:
- Public: false (requiere autenticación)
- File size limit: 50MB por archivo
- Allowed MIME types: image/jpeg, image/png, image/webp
- Policies: Solo usuarios autenticados pueden subir/leer
```

**Estructura de carpetas**:
```
images/
├── projects/
│   ├── {project_id}/
│   │   ├── {turbine_name}/
│   │   │   ├── {blade_name}/
│   │   │   │   ├── {section}/
│   │   │   │   │   └── {filename}.jpg
```

**Ejemplo**:
```
images/projects/550e8400-e29b-41d4-a716-446655440000/T01/A/LE/T01_A_LE_10.jpg
```

---

## Componentes UI

### Componentes Base (Radix UI)

Todos los componentes base están en `src/components/ui/` y están construidos sobre Radix UI para asegurar accesibilidad.

#### Button
```jsx
<Button
  variant="default|destructive|outline|ghost"
  size="sm|md|lg"
  disabled={boolean}
>
  Click me
</Button>
```

#### Card
```jsx
<Card>
  <CardHeader>
    <CardTitle>Título</CardTitle>
    <CardDescription>Descripción</CardDescription>
  </CardHeader>
  <CardContent>
    {/* Contenido */}
  </CardContent>
</Card>
```

#### Dialog
```jsx
<Dialog open={isOpen} onOpenChange={setIsOpen}>
  <DialogTrigger>Abrir</DialogTrigger>
  <DialogContent>
    <DialogHeader>
      <DialogTitle>Título</DialogTitle>
    </DialogHeader>
    {/* Contenido */}
  </DialogContent>
</Dialog>
```

#### Toast
```jsx
import { useToast } from '@/components/ui/use-toast';

const { toast } = useToast();

toast({
  title: "Éxito",
  description: "Operación completada",
  variant: "default|destructive"
});
```

---

### Componentes Especializados

#### OptimizedImage
Componente para carga optimizada de imágenes con lazy loading y placeholders.

```jsx
<OptimizedImage
  src={imageUrl}
  alt="Descripción"
  width={800}
  height={600}
  showStats={true}
  priority={false}
/>
```

**Features**:
- Lazy loading automático
- Placeholder mientras carga
- Estadísticas de carga
- Optimización de tamaño

---

#### EditableImageViewer
Visor de imágenes con capacidades de edición y anotación.

```jsx
<EditableImageViewer
  image={imageData}
  onSave={handleSave}
  onAnnotate={handleAnnotate}
  canEdit={isAdmin}
/>
```

**Features**:
- Zoom y pan
- Herramientas de dibujo
- Anotaciones
- Guardado de cambios
- Canvas HTML5

---

#### HeightNavigation
Navegador por alturas de pala para organizar imágenes.

```jsx
<HeightNavigation
  blade={bladeData}
  currentHeight={selectedHeight}
  onHeightChange={setSelectedHeight}
  sections={['TE', 'PS', 'LE', 'SS']}
/>
```

**Features**:
- Navegación vertical por altura
- Agrupación por sección
- Indicadores visuales de contenido
- Scroll suave

---

#### TurbineBlade3DModel
Visualizador 3D de palas de turbina con Three.js.

```jsx
<TurbineBlade3DModel
  bladeData={blade}
  defects={defectsList}
  onDefectClick={handleDefectClick}
/>
```

**Features**:
- Modelo 3D interactivo
- Rotación con mouse
- Indicadores de defectos
- Materiales realistas
- Iluminación dinámica

---

#### UserManagement
Componente completo para gestión de usuarios (Admin only).

```jsx
<UserManagement
  currentUser={user}
  onUserUpdate={handleUpdate}
/>
```

**Features**:
- Listado de usuarios
- Cambio de roles
- Invitaciones
- Filtros y búsqueda

---

## Servicios y APIs

### Servicio de Traducción

#### LibreTranslate Service

**Archivo**: `src/services/libreTranslationService.js`

Cliente de LibreTranslate alojado en un Space de Hugging Face (solo es ↔ en),
llamado directo desde el navegador (sin backend). Si el Space está dormido,
espera a que `GET /lt-status` responda `ready: true` antes de reintentar.

#### Hybrid Translation Service

**Archivo**: `src/services/hybridTranslationService.js`

Sistema de traducción con respaldo:

1. **LibreTranslate** (principal)
   - `POST {VITE_LIBRETRANSLATE_URL}/lt/translate`
   - Preserva saltos de línea

2. **Diccionario técnico local** (es → en)
   - Términos de turbinas eólicas y daños

3. **Texto original** (fallback final)
   - Si todo falla, devuelve el original

**Uso**:
```javascript
import translateTextHybrid from '@/services/hybridTranslationService';

const traducido = await translateTextHybrid('Hola mundo', 'en');
// Output: "Hello world"
```

---

### Utilidades de Gestión de Usuarios

**Archivo**: `src/utils/userManagement.js`

```javascript
// Obtener rol del usuario actual
const role = await getCurrentUserRole();

// Actualizar rol de un usuario
await updateUserRole(userId, 'admin', currentUserId);

// Obtener todos los usuarios
const { data: users } = await getAllUsers();

// Obtener usuarios por rol
const { data: admins } = await getUsersByRole('admin');

// Verificar permisos
const hasAdminAccess = hasRole(userRole, 'admin');

// Refrescar rol en toda la app
await refreshUserRole();
```

---

### Utilidades de Proyectos

**Archivo**: `src/utils/projectPermissions.js`

```javascript
// Verificar acceso a proyecto
const canAccess = hasProjectAccess(user, role, project);

// Filtrar proyectos por permisos
const filteredProjects = filterProjectsByPermissions(
  allProjects,
  user,
  role
);

// Obtener proyectos del usuario
const userProjects = await fetchUserProjects(user, role);

// Verificar permisos de edición
const canEdit = canEditProject(user, role, project);
const canDelete = canDeleteProject(user, role, project);
const canCreate = canCreateProject(role);
```

---

### Smart Upload

**Archivo**: `src/utils/smartUpload.js`

Sistema inteligente de carga de archivos con:
- Detección de duplicados (MD5 hash)
- Optimización de imágenes
- Progreso en tiempo real
- Manejo de errores por archivo

```javascript
import { smartUpload, getProjectFileStats } from '@/utils/smartUpload';

// Subir archivos
const results = await smartUpload(
  files,                    // Array de archivos
  projectId,                // ID del proyecto
  turbineName,              // Nombre de turbina
  (progress) => {           // Callback de progreso
    console.log(`${progress}% completado`);
  }
);

// Obtener estadísticas
const stats = await getProjectFileStats(projectId);
// {
//   totalFiles: 250,
//   totalSize: 125000000,
//   filesByType: { jpg: 200, png: 50 }
// }
```

---

### Cálculo de Progreso de Turbina

**Archivo**: `src/utils/turbineProgress.js`

```javascript
import { calculateTurbineProgress } from '@/utils/turbineProgress';

// Calcular progreso basado en imágenes
const progress = calculateTurbineProgress(imageCount);

// Lógica:
// - 0-99 imágenes: progreso lineal
// - 100+ imágenes: 100% completado
```

---

### Eliminación Cascada de Proyectos

**Archivo**: `src/utils/deleteProjectCascade.js`

Elimina un proyecto y todos sus datos relacionados de forma segura:

```javascript
import { deleteProjectCascade } from '@/utils/deleteProjectCascade';

await deleteProjectCascade(
  project,
  (progressMessage) => {
    console.log(progressMessage);
  },
  t // función de traducción
);
```

**Proceso**:
1. Eliminar imágenes de storage
2. Eliminar registros de images tabla
3. Eliminar blades
4. Eliminar turbinas
5. Eliminar staff
6. Eliminar proyecto

---

## Sistema de Traducción

### Configuración i18n

**Archivo**: `src/i18n/i18n.js`

```javascript
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

i18n
  .use(initReactI18next)
  .init({
    resources: {
      es: { common: esCommon, reports: esReports },
      en: { common: enCommon, reports: enReports }
    },
    lng: 'es',
    fallbackLng: 'es',
    ns: ['common', 'reports'],
    defaultNS: 'common'
  });
```

### Estructura de Traducciones

**Español** (`src/locales/es/common.json`):
```json
{
  "dashboard": {
    "title": "Panel de Control",
    "subtitle": "Bienvenido a la plataforma",
    "cards": {
      "projects": {
        "title": "Proyectos",
        "description": "Gestión de proyectos"
      }
    }
  },
  "status": {
    "pending": "Pendiente",
    "inProgress": "En progreso",
    "completed": "Completado"
  }
}
```

**Inglés** (`src/locales/en/common.json`):
```json
{
  "dashboard": {
    "title": "Dashboard",
    "subtitle": "Welcome to the platform",
    "cards": {
      "projects": {
        "title": "Projects",
        "description": "Project management"
      }
    }
  },
  "status": {
    "pending": "Pending",
    "inProgress": "In Progress",
    "completed": "Completed"
  }
}
```

### Uso en Componentes

```jsx
import { useTranslation } from 'react-i18next';

const MyComponent = () => {
  const { t, i18n } = useTranslation('common');

  return (
    <div>
      <h1>{t('dashboard.title')}</h1>
      <p>{t('dashboard.subtitle')}</p>

      {/* Cambiar idioma */}
      <button onClick={() => i18n.changeLanguage('en')}>
        English
      </button>
      <button onClick={() => i18n.changeLanguage('es')}>
        Español
      </button>
    </div>
  );
};
```

### LanguageSwitcher Component

```jsx
<LanguageSwitcher />
```

Componente que muestra un selector de idioma en el header.

---

## Configuración y Despliegue

### Variables de Entorno

**Archivo**: `.env.local`

```bash
# Supabase Configuration
VITE_SUPABASE_URL=https://<project-ref>.supabase.co
VITE_SUPABASE_ANON_KEY=<anon-key>

# LibreTranslate (Space de Hugging Face)
VITE_LIBRETRANSLATE_URL=https://TU-USUARIO-TU-SPACE.hf.space
# Opcional: solo si definiste PROXY_TOKEN en el Space (queda visible en el bundle)
VITE_LIBRETRANSLATE_TOKEN=
```

**⚠️ Importante**:
- Nunca commitear `.env.local` al repositorio
- Usar `.env.example` como plantilla
- Actualizar variables en Vercel/producción

---

### Scripts de NPM

```json
{
  "scripts": {
    "dev": "vite",
    "build": "node tools/generate-llms.js || true && vite build && node tools/post-build.js",
    "preview": "vite preview",
    "serve": "node serve-spa.js",
    "dev:spa": "vite --host 0.0.0.0",
    "test:spa": "node test-spa.js"
  }
}
```

**Comandos comunes**:

```bash
# Desarrollo local
npm run dev

# Build de producción
npm run build

# Preview del build
npm run preview

# Servidor SPA local
npm run serve

# Test del servidor
npm run test:spa
```

---

### Configuración de Vite

**Archivo**: `vite.config.js`

```javascript
export default defineConfig({
  plugins: [
    react(),
    // Plugins personalizados para error handling
    addTransformIndexHtml
  ],
  server: {
    cors: true,
    headers: {
      'Cross-Origin-Embedder-Policy': 'credentialless',
    },
    historyApiFallback: {
      index: '/index.html',
      rewrites: [
        { from: /^\/report-viewer\/.*$/, to: '/index.html' },
        { from: /^\/.*$/, to: '/index.html' }
      ]
    }
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  build: {
    rollupOptions: {
      external: [
        '@babel/parser',
        '@babel/traverse',
        '@babel/generator',
        '@babel/types'
      ]
    }
  }
});
```

---

### Configuración de Tailwind

**Archivo**: `tailwind.config.js`

```javascript
module.exports = {
  darkMode: 'class',
  content: [
    './index.html',
    './src/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        // Paleta personalizada de VND
        slate: {
          800: '#1e293b',
          900: '#0f172a',
        },
        yellow: {
          500: '#eab308',
        }
      },
      animation: {
        'spin-slow': 'spin 3s linear infinite',
      }
    },
  },
  plugins: [
    require('tailwindcss-animate')
  ],
}
```

---

### Despliegue en Vercel

**Archivo**: `vercel.json`

```json
{
  "buildCommand": "npm run build",
  "outputDirectory": "dist",
  "framework": "vite",
  "rewrites": [
    {
      "source": "/(.*)",
      "destination": "/index.html"
    }
  ],
  "headers": [
    {
      "source": "/(.*)",
      "headers": [
        {
          "key": "Cross-Origin-Embedder-Policy",
          "value": "credentialless"
        }
      ]
    }
  ]
}
```

**Pasos de despliegue**:

1. Conectar repositorio GitHub a Vercel
2. Configurar variables de entorno en Vercel
3. Deploy automático en cada push a main
4. Preview deployments para cada PR

---

## Flujos de Trabajo

### Flujo de Creación de Proyecto

```
1. Admin accede a /projects
         ↓
2. Completa formulario de proyecto
   - Datos básicos (nombre, parque, cliente)
   - Configuración (fechas, estado, turbinas)
   - Personal (gerente, líder técnico)
   - Equipo técnico (staff)
         ↓
3. Validación del formulario
   - Campos requeridos
   - Mínimo 1 miembro del equipo
   - Emails únicos en el proyecto
         ↓
4. Creación en base de datos
   - Insertar proyecto en 'projects'
   - Insertar staff en 'staff'
         ↓
5. Proyecto creado exitosamente
   - Toast de confirmación
   - Refresco de lista de proyectos
```

---

### Flujo de Captura de Datos

```
1. Técnico accede a /capture
         ↓
2. Selecciona proyecto del dropdown
         ↓
3. Arrastra carpeta con imágenes
   (Estructura: TurbineName_BladeID_Section_Height.jpg)
         ↓
4. Sistema organiza archivos automáticamente
   - Detecta turbina
   - Detecta blade (A/B/C)
   - Detecta sección (TE/PS/LE/SS)
   - Detecta altura
         ↓
5. Preview y validación
   - Muestra árbol de archivos organizados
   - Valida formatos
   - Detecta posibles errores
         ↓
6. Usuario confirma carga
         ↓
7. Smart Upload ejecuta:
   - Calcula hash MD5 por archivo
   - Verifica duplicados
   - Optimiza imágenes
   - Sube a Supabase Storage
   - Crea registros en DB
   - Actualiza progreso en tiempo real
         ↓
8. Finalización
   - Reporte de archivos subidos
   - Archivos duplicados ignorados
   - Errores reportados
```

---

### Flujo de Generación de Reporte

```
1. Usuario (Admin/Client) accede a /reports-portal
         ↓
2. Selecciona proyecto
         ↓
3. Selecciona turbina específica
         ↓
4. Sistema navega a /report-viewer/:projectId/:turbineName
         ↓
5. Carga de datos:
   - Imágenes de todas las blades
   - Datos de la turbina
   - Información del proyecto
   - Anotaciones existentes
         ↓
6. Visualización interactiva:
   - Height Navigation
   - Visor por sección
   - Modelo 3D
         ↓
7. (Si es Admin) Edición:
   - Agregar anotaciones
   - Marcar defectos
   - Clasificar severidad
   - Comentarios
         ↓
8. Generación de reporte:
   - Usuario selecciona idioma (ES/EN)
   - Usuario selecciona formato (PDF/DOCX)
         ↓
9. Si idioma != español:
   - Sistema traduce con LibreTranslate
   - Cache de traducciones
   - Fallback a alternativas
         ↓
10. Generación del documento:
    - Compilación de datos
    - Inserción de imágenes
    - Formato según template
    - Generación de archivo
         ↓
11. Descarga automática del reporte
```

---

### Flujo de Gestión de Usuarios (Admin)

```
1. Admin accede a /admin
         ↓
2. Ve listado de todos los usuarios
   - Email
   - Nombre
   - Rol actual
   - Estado
         ↓
3. OPCIÓN A: Cambiar rol de usuario existente
   - Selecciona nuevo rol
   - Confirma cambio
   - Sistema actualiza en DB
   - Notificación global de cambio de rol
         ↓
4. OPCIÓN B: Invitar nuevo usuario
   - Ingresa email
   - Selecciona rol inicial
   - Sistema envía invitación por Supabase Auth
   - Usuario recibe email con link mágico
         ↓
5. Nuevo usuario accede al link
   - Redirige a /invite
   - Crea contraseña
   - Completa perfil
   - Marca invitación como aceptada
         ↓
6. Usuario puede acceder según su rol
```

---

## Mejores Prácticas y Convenciones

### Nomenclatura de Archivos

- Componentes: `PascalCase.jsx` (ej. `DashboardPage.jsx`)
- Utilidades: `camelCase.js` (ej. `userManagement.js`)
- Configuración: `camelCase.js` (ej. `vite.config.js`)
- Estilos: `kebab-case.css` (ej. `index.css`)

### Estructura de Componentes

```jsx
// 1. Imports
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

// 2. Componente
const MyComponent = ({ prop1, prop2 }) => {
  // 3. Hooks
  const { t } = useTranslation('common');
  const navigate = useNavigate();
  const [state, setState] = useState(null);

  // 4. Effects
  useEffect(() => {
    // ...
  }, []);

  // 5. Handlers
  const handleClick = () => {
    // ...
  };

  // 6. Render
  return (
    <div>
      {/* JSX */}
    </div>
  );
};

// 7. Export
export default MyComponent;
```

### Manejo de Errores

```javascript
try {
  // Operación
  const result = await someAsyncOperation();

  // Éxito
  toast({
    title: "✅ Éxito",
    description: "Operación completada"
  });

} catch (error) {
  // Error
  console.error('Error en operación:', error);

  toast({
    title: "❌ Error",
    description: error.message || "Algo salió mal",
    variant: "destructive"
  });
}
```

### Consultas a Supabase

```javascript
// ✅ Buena práctica: manejo de errores
const { data, error } = await supabase
  .from('projects')
  .select('*')
  .eq('status', 'active');

if (error) {
  console.error('Database error:', error);
  throw error;
}

// ❌ Mala práctica: asumir que siempre funciona
const { data } = await supabase
  .from('projects')
  .select('*');
```

---

## Solución de Problemas Comunes

### Problema: Usuario no ve proyectos

**Diagnóstico**:
1. Verificar rol del usuario: `await getCurrentUserRole()`
2. Verificar asignación en tabla `staff` o `review_personnel_email`
3. Verificar políticas RLS en Supabase

**Solución**:
```javascript
// Refrescar rol
await refreshUserRole();

// Verificar permisos
const canAccess = hasProjectAccess(user, role, project);
console.log('Can access:', canAccess);
```

---

### Problema: Imágenes no se cargan

**Diagnóstico**:
1. Verificar conectividad con Supabase Storage
2. Verificar políticas de bucket `images`
3. Verificar rutas de archivos en DB

**Solución**:
```javascript
// Test de conectividad
const { data, error } = await supabase.storage
  .from('images')
  .list('projects/', { limit: 1 });

console.log('Storage test:', { data, error });
```

---

### Problema: Traducción no funciona

**Diagnóstico**:
1. Verificar `VITE_LIBRETRANSLATE_URL`
2. Verificar que el Space esté activo (puede estar dormido)
3. Si usas token, verificar `VITE_LIBRETRANSLATE_TOKEN`

**Solución**:
```bash
curl https://TU-USUARIO-TU-SPACE.hf.space/lt-status
# Debe responder {"ready":true,"error":null}
```

---

### Problema: Duplicados al subir imágenes

**Diagnóstico**:
El sistema debe detectar duplicados por hash MD5.

**Verificación**:
```sql
-- Buscar posibles duplicados en DB
SELECT file_hash, COUNT(*)
FROM images
GROUP BY file_hash
HAVING COUNT(*) > 1;
```

**Solución**:
Si hay duplicados reales, ejecutar limpieza:
```javascript
// Script de limpieza (ejecutar con precaución)
const { data: duplicates } = await supabase
  .from('images')
  .select('file_hash, id')
  .order('uploaded_at', { ascending: true });

// Mantener solo el más antiguo por hash
// (implementar lógica de limpieza)
```

---

## Roadmap y Mejoras Futuras

### Funcionalidades Planificadas

#### Corto Plazo (1-3 meses)
- [ ] Sistema de notificaciones en tiempo real
- [ ] Dashboard de métricas avanzadas
- [ ] Exportación masiva de reportes
- [ ] Búsqueda global en la plataforma
- [ ] Filtros avanzados en todas las vistas

#### Mediano Plazo (3-6 meses)
- [ ] App móvil (React Native)
- [ ] Modo offline con sincronización
- [ ] Análisis de imágenes con IA
- [ ] Detección automática de defectos
- [ ] Sistema de workflows personalizables

#### Largo Plazo (6-12 meses)
- [ ] Integración con drones
- [ ] Realidad aumentada para inspecciones
- [ ] Predicción de mantenimiento
- [ ] API pública para integraciones
- [ ] Marketplace de extensiones

---

## Contacto y Soporte

### Equipo de Desarrollo
- **Empresa**: VIND GROUP
- **Proyecto**: VND Platform v2 / Visus AI
- **Versión**: 2.0.1

### Recursos
- **Repositorio**: (privado)
- **Documentación**: Ver carpeta `/src/docs/`
- **Supabase Dashboard**: https://app.supabase.com
- **Vercel Dashboard**: https://vercel.com/dashboard

---

## Apéndices

### A. Glosario de Términos

- **Blade**: Pala de turbina eólica (A, B, C)
- **Section**: Sección de la pala (TE, PS, LE, SS)
- **Height**: Altura en metros desde la raíz de la pala
- **RLS**: Row Level Security (Supabase)
- **JWT**: JSON Web Token (autenticación)
- **RPC**: Remote Procedure Call (funciones de Supabase)
- **SPA**: Single Page Application
- **SSR**: Server Side Rendering

### B. Códigos de Estado de Proyecto

```javascript
const PROJECT_STATUS = {
  PLANNING: 'Planeación',
  IN_PROGRESS: 'En progreso',
  COMPLETED: 'Completado',
  PAUSED: 'Pausado',
  CANCELLED: 'Cancelado',
  REVIEW: 'Revisión',
  PENDING: 'Pendiente'
};
```

### C. Códigos de Sección de Pala

```javascript
const BLADE_SECTIONS = {
  TE: 'Trailing Edge',   // Borde de salida
  LE: 'Leading Edge',    // Borde de ataque
  PS: 'Pressure Side',   // Lado de presión
  SS: 'Suction Side'     // Lado de succión
};
```

---

**Última actualización**: 2025-10-03
**Versión del documento**: 1.0
**Autor**: Análisis automático del proyecto VND Platform v2 desarrollado por Jesús Enrique Garcia Hernandez
---

## Internacionalización (es / en)

- **Textos con clave:** `t("seccion.clave")` con `useTranslation()`; las claves viven en `src/locales/{es,en}/common.json` (y `reports.json` para el PDF).
- **Textos fijos en español:** `tx("Texto en español")` (`import { tx } from "@/i18n/tx"`). En español devuelve el mismo texto; en inglés lo busca en `src/i18n/literals.en.json` (clave = texto en español). Admite variables: `tx("Radio: {{value}} mm", { value })`. En desarrollo avisa por consola si falta la traducción.
- **Fechas:** `toLocaleDateString(dateLocale(), ...)` para que sigan el idioma activo.
- **No traducir:** nombres de proyecto, parque eólico, cliente, turbina y demás datos del proyecto, ni valores que se guardan o comparan en la base de datos (p. ej. `status`).
- Los componentes que usan `tx` deben llamar a `useTranslation()` (o colgar de uno que lo haga) para redibujarse al cambiar de idioma.
- Los textos libres escritos por usuarios (notas de daños) se traducen con LibreTranslate; ver `huggingface-space/`.

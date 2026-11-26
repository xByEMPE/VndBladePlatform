# Equivalencias de puestos (`user_profiles.job_title`)

Origen: columna `TIPO_CARGO` de la hoja de colaboradores de RH. El Excel **no** trae un puesto por persona; solo estas categorías
son concretas. Valor aprobado → `job_title` (texto exacto del catálogo de Puestos de RH cuando existe).

| Valor en TIPO_CARGO (tras recortar espacios y pasar a mayúsculas) | job_title |
|---|---|
| TECNICO EN MANTENIMIENTO, TECNICO MANTENIMIENTO, TECNICO A MANTENIMIENTO | TECNICO DE MANTENIMIENTO |
| SUPERVISOR DE OEPRACIONES | SUPERVISOR DE OPERACIONES |
| AUXILIAR DE CERTIFICACIONES | AUXILIAR DE CERTIFICACIONES |
| ESPECIALISTA DE COMPRAS-ZE | ESPECIALISTA DE COMPRAS |
| REPARADOR | REPARADOR DE PALAS |
| AUXILIAR | AUXILIAR OPERATIVO |
| OPER., OPERATIVO, OPERTIVO, MIXTO, ADM., ADM. / OPER., ADMINISTRATIVO, ADMON-OPERATIVO, vacío, cualquier otro genérico | NULL (RH lo asigna) |

Criterio de limpieza de la carga (reutilizable en producción): correo en minúsculas y sin espacios; una fila por correo;
dominio solo `vindgroup.com.mx` o `bo.vindgroup.com.mx`; `NA`, vacíos y dominios mal escritos van a un reporte, no se cargan.

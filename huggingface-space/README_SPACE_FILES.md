# Space de Hugging Face (LibreTranslate + glosario)

Archivos del Space `EnriqueVND/LibreTranslate`. Se suben tal cual al repositorio del Space.

| Archivo | Qué hace |
|---|---|
| `app.py` | Arranca LibreTranslate (es,en) y expone `/lt/*` (proxy), `/tr/translate` (con glosario), `/tr/glossary` y `/lt-status` |
| `glossary.json` | Glosario es -> en de inspección de turbinas. Se edita con un commit |
| `glossary.py` | Carga el glosario y protege/restaura términos con marcadores `Xqk<n>` |
| `tr_service.py` | Traduce con glosario y reintenta sin protección si se pierde un marcador |
| `test_glossary.py` | Pruebas: `python test_glossary.py` |

## Editar el glosario
Añade pares `"Español": "English"` en `glossary.json`:
- `components` y `damage_types`: aceptan alternativas con ` / ` (con espacios) y paréntesis; se usa la primera alternativa en inglés.
- `severities_and_actions` y `geometry_and_units`: claves exactas.
- `additional_terms`: prioridad máxima (plurales y términos sueltos; resuelve ambigüedades como "concha").

Tras editar, haz commit al Space (se reinicia solo) y revisa `GET /lt-status` -> `glossaryTerms`.

No hace falta tocar equirements.txt (sigue siendo solo httpx) ni el README.md del Space.

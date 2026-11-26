"""
Glosario es -> en de inspección de turbinas eólicas.

LibreTranslate traduce mal este vocabulario ("pala" -> "shovel"), así que los términos del
glosario se sustituyen por marcadores antes de traducir y se restauran en inglés después.
Los datos viven en glossary.json (se edita con un commit al repositorio del Space).
"""

import json
import re
import unicodedata
from pathlib import Path

ROOT_KEY = "wind_energy_inspection_dictionary"

# Categorías cuyas claves/valores se simplifican y se parten por "/" y paréntesis
SPLIT_CATEGORIES = {"components", "damage_types"}
# Categorías con prioridad: sobrescriben términos derivados ambiguos
EXPLICIT_CATEGORIES = {"additional_terms"}

# Marcador "Xqk<n>": LibreTranslate lo trata como nombre propio y traduce bien las palabras de alrededor
# (probados "Zzg0zz" y "[[0]]": el primero dejaba "de la" sin traducir y el segundo se deformaba)
_PLACEHOLDER_RE = re.compile(r"(?<![A-Za-z])xqk(\d+)(?!\d)", re.IGNORECASE)
_PAREN_RE = re.compile(r"\s*\([^)]*\)")


def strip_accents(text):
    return "".join(c for c in unicodedata.normalize("NFD", text) if unicodedata.category(c) != "Mn")


def _short_en(value):
    """'Crack / Fissure' -> 'Crack'; 'Leading edge erosion (LEE)' -> 'Leading edge erosion'."""
    return _PAREN_RE.sub("", value.split(" / ")[0]).strip()


def _apply_case(en, upper):
    """Mayúscula inicial solo si el término original la tenía; respeta siglas y categorías ("Cat 1 ...")."""
    if upper:
        return en[:1].upper() + en[1:]
    if en.startswith("Cat ") or en[:2].isupper():
        return en
    return en[:1].lower() + en[1:]


def _split_terms(key):
    """'Concha (lado de succión / extradós)' -> Concha, lado de succión, extradós (+ la clave completa)."""
    terms = {key.strip()}
    base = _PAREN_RE.sub("", key).strip()
    for part in base.split(" / "):
        if part.strip():
            terms.add(part.strip())
    for inner in re.findall(r"\(([^)]*)\)", key):
        for part in inner.split(" / "):
            if part.strip():
                terms.add(part.strip())
    return terms


class Glossary:
    def __init__(self, data):
        self.raw = data
        self.terms = self._build_terms(data.get(ROOT_KEY, data))
        ordered = sorted(self.terms, key=len, reverse=True)  # frases largas primero
        pattern = "|".join(re.escape(t) for t in ordered)
        self._regex = re.compile(rf"(?<!\w)(?:{pattern})(?!\w)", re.IGNORECASE) if ordered else None

    @classmethod
    def load(cls, path):
        return cls(json.loads(Path(path).read_text(encoding="utf-8")))

    @staticmethod
    def _build_terms(categories):
        derived = {}      # término -> conjunto de traducciones posibles
        explicit = {}

        for category, entries in categories.items():
            if not isinstance(entries, dict):
                continue
            for es, en in entries.items():
                if category in EXPLICIT_CATEGORIES:
                    explicit[es.lower()] = en
                    continue
                if category in SPLIT_CATEGORIES:
                    value = _short_en(en)
                    keys = _split_terms(es)
                else:
                    # "Cat 4 - Structural / Severe" se conserva; en el resto se usa la primera alternativa
                    value = en if es.startswith("Cat ") else en.split(" / ")[0].strip()
                    keys = {es.strip()}
                for key in keys:
                    derived.setdefault(key.lower(), set()).add(value)

        terms = {}
        for key, values in derived.items():
            if len(values) == 1:  # términos ambiguos (p. ej. "concha") se descartan
                terms[key] = next(iter(values))
        terms.update(explicit)

        # Variantes sin tilde ("gondola", "delaminacion") apuntan a la misma traducción
        for key, value in list(terms.items()):
            plain = strip_accents(key)
            if plain != key:
                terms.setdefault(plain, value)
        return terms

    def _lookup(self, matched):
        key = matched.lower()
        return self.terms.get(key) or self.terms.get(strip_accents(key))

    def protect(self, text):
        """Devuelve (texto con marcadores, lista de {'en', 'upper'})."""
        found = []
        if not self._regex or not text:
            return text, found

        def repl(match):
            term = match.group(0)
            index = len(found)
            found.append({"en": self._lookup(term), "upper": term[:1] != term[:1].lower()})
            return f"Xqk{index}"

        return self._regex.sub(repl, text), found

    @staticmethod
    def restore(text, found):
        """Devuelve (texto restaurado, completo). completo=False si se perdió algún marcador."""
        seen = set()

        def repl(match):
            index = int(match.group(1))
            if index >= len(found):
                return match.group(0)
            seen.add(index)
            entry = found[index]
            return _apply_case(entry["en"], entry["upper"])

        restored = _PLACEHOLDER_RE.sub(repl, text)
        return restored, len(seen) == len(found)

"""Traducción con glosario: protege términos, llama a LibreTranslate y los restaura."""


class TranslationError(Exception):
    def __init__(self, status, detail):
        super().__init__(detail)
        self.status = status
        self.detail = detail


async def _lt_translate(client, lt_url, texts, source, target):
    response = await client.post(
        f"{lt_url}/translate",
        json={"q": texts, "source": source, "target": target, "format": "text"},
    )
    if response.status_code != 200:
        raise TranslationError(response.status_code, response.text[:300])
    out = response.json().get("translatedText")
    if isinstance(out, str):
        out = [out]
    if not isinstance(out, list) or len(out) != len(texts):
        raise TranslationError(502, "respuesta inválida de LibreTranslate")
    return out


async def translate(glossary, client, lt_url, items, source, target):
    """
    Traduce una lista de textos. El glosario solo se aplica a es -> en.
    Si LibreTranslate pierde algún marcador de un texto, ese texto se traduce de nuevo sin protección.
    Devuelve (traducciones, número de términos del glosario aplicados).
    """
    use_glossary = source[:2].lower() == "es" and target[:2].lower() == "en"
    positions = [i for i, text in enumerate(items) if text.strip()]
    results = list(items)  # los textos vacíos se devuelven tal cual
    if not positions:
        return results, 0

    prepared, founds = [], []
    for i in positions:
        text, found = glossary.protect(items[i]) if use_glossary else (items[i], [])
        prepared.append(text)
        founds.append(found)

    translated = await _lt_translate(client, lt_url, prepared, source, target)

    applied = 0
    for k, i in enumerate(positions):
        out = translated[k]
        if founds[k]:
            restored, complete = glossary.restore(out, founds[k])
            if complete:
                out = restored
                # Si LibreTranslate movió un término al inicio, mantener la mayúscula inicial del original
                if items[i][:1].isupper() and out[:1].islower():
                    out = out[:1].upper() + out[1:]
                applied += len(founds[k])
            else:
                out = (await _lt_translate(client, lt_url, [items[i]], source, target))[0]
        results[i] = out
    return results, applied

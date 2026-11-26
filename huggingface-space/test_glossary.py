"""Pruebas del glosario. Ejecutar: python -I test_glossary.py  (o pytest)"""

from pathlib import Path

from glossary import Glossary

G = Glossary.load(Path(__file__).with_name("glossary.json"))


def roundtrip(text):
    protected, found = G.protect(text)
    # Simula a LibreTranslate dejando los marcadores intactos
    restored, complete = G.restore(protected, found)
    return restored, complete


def test_simple_terms():
    assert roundtrip("Grieta en la pala")[0] == "Crack en la blade"


def test_longest_phrase_wins():
    out, _ = roundtrip("Daño en el borde de salida de la pala")
    assert "trailing edge" in out and "blade" in out


def test_capitalization_is_preserved():
    assert roundtrip("PALAS dañadas")[0].startswith("Blades")
    assert roundtrip("hay palas dañadas")[0] == "hay blades dañadas"


def test_split_alternatives():
    out, _ = roundtrip("Hay una fisura y un vástago dañado")
    assert "fissure" in out and "spar cap" in out


def test_ambiguous_concha_uses_explicit_entry():
    assert roundtrip("Concha dañada")[0] == "Shell dañada"
    assert "suction side" in roundtrip("Daño en el lado de succión")[0]


def test_unaccented_variants():
    assert roundtrip("delaminacion en gondola")[0] == "delamination en nacelle"


def test_no_partial_word_matches():
    out, found = G.protect("Palabra y palacio")
    assert found == [] and out == "Palabra y palacio"


def test_user_dictionary_terms():
    out, _ = roundtrip("Exposición de fibra de vidrio y filtración de humedad")
    assert "Fiberglass exposure" in out and "moisture ingress" in out
    out, _ = roundtrip("Se requiere inspección por ultrasonido")
    assert "ultrasonic testing (UT)" in out
    out, _ = roundtrip("Daño clasificado como Cat 1 - Cosmético")
    assert "Cat 1 - Cosmetic" in out
    out, _ = roundtrip("Área afectada de 20 cm")
    assert out.startswith("Affected area")


def test_slash_without_spaces_is_not_split():
    assert roundtrip("núcleo de balsa/espuma")[0].lower() == "balsa/foam core"
    protected, found = G.protect("la espuma")
    assert found == []


def test_lost_placeholder_is_reported():
    _, found = G.protect("Grieta en la pala")
    assert G.restore("Crack in the blade", found)[1] is False


def test_empty_and_plain_text():
    assert G.protect("") == ("", [])
    assert G.protect("Texto sin términos") == ("Texto sin términos", [])


if __name__ == "__main__":
    failures = 0
    for name, fn in sorted(globals().items()):
        if name.startswith("test_") and callable(fn):
            try:
                fn()
                print("ok  ", name)
            except AssertionError as exc:
                failures += 1
                print("FAIL", name, exc)
    print(f"{len(G.terms)} términos cargados")
    raise SystemExit(1 if failures else 0)

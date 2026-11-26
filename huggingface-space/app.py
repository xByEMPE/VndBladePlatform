import sys
import os
import subprocess
import threading
import time
from pathlib import Path

import spaces

# Requerido por el hardware ZeroGPU: debe haber al menos una función @spaces.GPU
@spaces.GPU
def _gpu_placeholder():
    return None

os.environ["GRADIO_SSR_MODE"] = "false"

import gradio as gr
import httpx
import uvicorn
from fastapi import FastAPI, HTTPException, Request, Response
from fastapi.middleware.cors import CORSMiddleware

from glossary import Glossary
from tr_service import TranslationError, translate as glossary_translate

LT_PORT = 5000
LT_URL = f"http://127.0.0.1:{LT_PORT}"
LANGS = "es,en"

# Opcionales (Settings → Variables and secrets del Space)
ALLOWED_ORIGINS = os.getenv("ALLOWED_ORIGINS", "*").split(",")
PROXY_TOKEN = os.getenv("PROXY_TOKEN")  # si lo defines, exige header X-API-Token

GLOSSARY = Glossary.load(Path(__file__).with_name("glossary.json"))

VENV = "/tmp/ltvenv"
state = {"ready": False, "error": None}


def start_libretranslate():
    try:
        exe = f"{VENV}/bin/libretranslate"
        if not os.path.exists(exe):
            print(">>> creando venv e instalando libretranslate...", flush=True)
            # venv aislado: su resolución de dependencias no choca con Gradio
            subprocess.check_call([sys.executable, "-m", "venv", "--system-site-packages", VENV])
            subprocess.check_call([f"{VENV}/bin/pip", "install", "--no-cache-dir", "libretranslate"])

        print(">>> arrancando libretranslate (es,en)...", flush=True)
        subprocess.Popen([
            exe,
            "--host", "127.0.0.1",
            "--port", str(LT_PORT),
            "--load-only", LANGS,
            "--disable-web-ui",
        ])
        t0 = time.time()
        while time.time() - t0 < 1800:
            try:
                if httpx.get(f"{LT_URL}/languages", timeout=2).status_code == 200:
                    state["ready"] = True
                    print(">>> LibreTranslate está listo y respondiendo", flush=True)
                    return
            except httpx.HTTPError:
                pass
            time.sleep(3)
        state["error"] = "timeout esperando a LibreTranslate"
        print(f">>> ERROR: {state['error']}", flush=True)
    except Exception as e:  # visible en /lt-status y en los logs
        state["error"] = str(e)
        print(f">>> ERROR: {e}", flush=True)


threading.Thread(target=start_libretranslate, daemon=True).start()

app = FastAPI()
app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_methods=["*"],
    allow_headers=["*"],
)


def check_access(request: Request):
    if PROXY_TOKEN and request.headers.get("x-api-token") != PROXY_TOKEN:
        raise HTTPException(401, "token inválido")
    if not state["ready"]:
        raise HTTPException(503, "LibreTranslate se está iniciando, reintenta en unos segundos")


@app.get("/lt-status")
def status():
    return {"ready": state["ready"], "error": state["error"], "glossaryTerms": len(GLOSSARY.terms)}


@app.get("/tr/glossary")
def glossary_info(request: Request):
    """Glosario cargado: términos es -> en que se aplican y el JSON original."""
    if PROXY_TOKEN and request.headers.get("x-api-token") != PROXY_TOKEN:
        raise HTTPException(401, "token inválido")
    return {"count": len(GLOSSARY.terms), "terms": GLOSSARY.terms, "dictionary": GLOSSARY.raw}


@app.post("/tr/translate")
async def tr_translate(request: Request):
    """
    Igual que /lt/translate (q, source, target -> translatedText) pero aplicando el glosario
    de inspección en es -> en. q puede ser un texto o una lista de textos.
    """
    check_access(request)
    try:
        body = await request.json()
    except ValueError:
        raise HTTPException(400, "JSON inválido")

    q = body.get("q")
    items = [q] if isinstance(q, str) else q
    if not isinstance(items, list) or not all(isinstance(t, str) for t in items):
        raise HTTPException(400, "q debe ser un texto o una lista de textos")
    source = str(body.get("source") or "es")
    target = str(body.get("target") or "en")

    try:
        async with httpx.AsyncClient(timeout=60) as client:
            translated, applied = await glossary_translate(GLOSSARY, client, LT_URL, items, source, target)
    except TranslationError as e:
        raise HTTPException(e.status, e.detail)
    except httpx.HTTPError as e:
        raise HTTPException(502, f"error contactando con LibreTranslate: {e}")

    return {
        "translatedText": translated[0] if isinstance(q, str) else translated,
        "glossaryTerms": applied,
    }


@app.api_route("/lt/{path:path}", methods=["GET", "POST"])
async def proxy(path: str, request: Request):
    check_access(request)
    try:
        async with httpx.AsyncClient(timeout=60) as client:
            r = await client.request(
                request.method,
                f"{LT_URL}/{path}",
                content=await request.body(),
                headers={"content-type": request.headers.get("content-type", "application/json")},
            )
    except httpx.HTTPError as e:
        raise HTTPException(502, f"error contactando con LibreTranslate: {e}")
    return Response(r.content, r.status_code, media_type=r.headers.get("content-type"))


def translate(text: str, direction: str):
    if not state["ready"]:
        return "⏳ El motor se está iniciando (descarga de modelos). Reintenta en un minuto."
    if not text.strip():
        return ""
    source, target = ("es", "en") if direction == "Español → Inglés" else ("en", "es")
    try:
        r = httpx.post(
            f"{LT_URL}/translate",
            json={"q": text, "source": source, "target": target, "format": "text"},
            timeout=60,
        )
        return r.json().get("translatedText", r.text)
    except Exception as e:
        return f"Error: {e}"


demo = gr.Interface(
    fn=translate,
    inputs=[
        gr.Textbox(label="Texto", lines=4),
        gr.Radio(["Español → Inglés", "Inglés → Español"], value="Español → Inglés", label="Dirección"),
    ],
    outputs=gr.Textbox(label="Traducción", lines=4),
    title="LibreTranslate ES ↔ EN",
    api_name="translate",
)

# Se monta al final para que /tr/*, /lt/* y /lt-status tengan prioridad
app = gr.mount_gradio_app(app, demo, path="/", ssr_mode=False)

if __name__ == "__main__":
    # EXPERIMENTO: lanza Gradio en un puerto auxiliar solo para que ZeroGPU
    # ejecute su detección de @spaces.GPU. El tráfico público sigue en 7860.
    try:
        demo.launch(
            server_name="127.0.0.1",
            server_port=7861,
            prevent_thread_lock=True,
            ssr_mode=False,
            show_api=False,
        )
    except Exception as e:
        print(f">>> aviso: demo.launch auxiliar falló: {e}", flush=True)
    uvicorn.run(app, host="0.0.0.0", port=7860)

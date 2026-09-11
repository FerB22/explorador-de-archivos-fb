"""
app.py — Punto de entrada de la aplicación Explorador de Archivos.
Crea la ventana pywebview y conecta el puente API con el frontend.
"""

import sys
import os
import json

if getattr(sys, "frozen", False):
    APP_DIR = os.path.dirname(sys.executable)
    BUNDLE_DIR = getattr(sys, "_MEIPASS", APP_DIR)
else:
    APP_DIR = os.path.dirname(os.path.abspath(__file__))
    BUNDLE_DIR = APP_DIR

if APP_DIR not in sys.path:
    sys.path.insert(0, APP_DIR)

# Optimización de aceleración por GPU y reducción de sobrecarga en WebView2 / Chromium
os.environ["WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS"] = (
    "--disable-features=Translate,OptimizationHints "
    "--enable-gpu-rasterization "
    "--enable-zero-copy"
)

import webview
from api import AppApi


def _load_config() -> dict:
    config_path = os.path.join(APP_DIR, "config.json")
    if not os.path.exists(config_path):
        config_path = os.path.join(BUNDLE_DIR, "config.json")
    try:
        with open(config_path, "r", encoding="utf-8") as f:
            return json.load(f)
    except Exception:
        return {"theme": "auto", "width": 1000, "height": 700, "window_title": "Explorador de Archivos"}


from services.window_theme import WindowThemeManager, is_system_dark_mode


def main():
    cfg = _load_config()
    theme_manager = WindowThemeManager()
    api = AppApi(window_theme_manager=theme_manager)

    html_path = os.path.join(BUNDLE_DIR, "web", "index.html")
    if not os.path.exists(html_path):
        html_path = os.path.join(APP_DIR, "web", "index.html")

    saved_theme = cfg.get("theme", "auto")
    is_dark = (saved_theme == "dark") or (saved_theme == "auto" and is_system_dark_mode())
    bg = "#0b0c10" if is_dark else "#f8fafc"

    window = webview.create_window(
        title=cfg.get("window_title", "Explorador FB"),
        url=html_path,
        js_api=api,
        width=cfg.get("width", 1000),
        height=cfg.get("height", 700),
        min_size=(640, 480),
        background_color=bg,
        maximized=cfg.get("maximized", True)
    )

    def on_window_shown():
        try:
            if hasattr(window, "native") and window.native:
                hwnd = int(window.native.Handle.ToInt64())
                theme_manager.set_hwnd(hwnd)
                theme_manager.apply_theme(saved_theme)
                if cfg.get("maximized", True):
                    theme_manager.maximize_window()
                else:
                    theme_manager.center_window()
        except Exception as e:
            print(f"Error al inicializar ventana: {e}")

    window.events.shown += on_window_shown

    webview.start(debug=False)


if __name__ == "__main__":
    main()

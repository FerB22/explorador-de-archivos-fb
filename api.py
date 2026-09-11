"""
api.py — Puente entre el frontend JavaScript y el backend Python.
"""

import os
import sys
import json
import base64
import tkinter as tk
from tkinter import filedialog

if getattr(sys, "frozen", False):
    APP_DIR = os.path.dirname(sys.executable)
    BUNDLE_DIR = getattr(sys, "_MEIPASS", APP_DIR)
else:
    APP_DIR = os.path.dirname(os.path.abspath(__file__))
    BUNDLE_DIR = APP_DIR

if APP_DIR not in sys.path:
    sys.path.insert(0, APP_DIR)

from services.file_explorer_service import FileExplorerService
from services.document_reader_service import DocumentReaderService
from services.trash_service import TrashService

def _get_config_path_read() -> str:
    path_app = os.path.join(APP_DIR, "config.json")
    if os.path.exists(path_app):
        return path_app
    path_bundle = os.path.join(BUNDLE_DIR, "config.json")
    if os.path.exists(path_bundle):
        return path_bundle
    return path_app

def _get_config_path_write() -> str:
    return os.path.join(APP_DIR, "config.json")

MAX_TEXT_BYTES  = 512 * 1024       # 500 KB para texto/código/markdown
MAX_IMAGE_BYTES = 8 * 1024 * 1024  # 8 MB para imágenes

IMAGE_EXTS    = {'.png', '.jpg', '.jpeg', '.gif', '.svg', '.webp', '.bmp', '.ico'}
MARKDOWN_EXTS = {'.md', '.markdown'}
CODE_EXTS = {
    '.py', '.js', '.ts', '.jsx', '.tsx', '.html', '.htm', '.css', '.scss',
    '.sql', '.json', '.xml', '.yaml', '.yml', '.java', '.cs', '.cpp', '.c',
    '.h', '.rs', '.go', '.php', '.rb', '.sh', '.bat', '.ps1', '.r',
    '.kt', '.swift', '.dart', '.toml', '.ini', '.conf', '.env',
}
TEXT_EXTS = {'.txt', '.log', '.csv', '.tsv', '.rst'}

LANG_MAP = {
    '.py': 'python', '.js': 'javascript', '.ts': 'typescript',
    '.jsx': 'javascript', '.tsx': 'typescript', '.html': 'html',
    '.htm': 'html', '.css': 'css', '.scss': 'scss', '.sql': 'sql',
    '.json': 'json', '.xml': 'xml', '.yaml': 'yaml', '.yml': 'yaml',
    '.java': 'java', '.cs': 'csharp', '.cpp': 'cpp', '.c': 'c',
    '.h': 'c', '.rs': 'rust', '.go': 'go', '.php': 'php',
    '.rb': 'ruby', '.sh': 'bash', '.bat': 'dos', '.ps1': 'powershell',
    '.r': 'r', '.kt': 'kotlin', '.swift': 'swift', '.dart': 'dart',
    '.toml': 'toml', '.ini': 'ini', '.env': 'bash',
}

MIME_MAP = {
    '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
    '.gif': 'image/gif', '.svg': 'image/svg+xml', '.webp': 'image/webp',
    '.bmp': 'image/bmp', '.ico': 'image/x-icon',
}


def get_default_root_path() -> str:
    """Devuelve una ruta inicial segura y portable (Documentos del usuario o Home)."""
    docs = os.path.join(os.path.expanduser("~"), "Documents")
    if os.path.exists(docs):
        return docs
    return os.path.expanduser("~")

def _load_config() -> dict:
    cfg_path = _get_config_path_read()
    default_root = get_default_root_path()
    try:
        with open(cfg_path, "r", encoding="utf-8") as f:
            data = json.load(f)
    except Exception:
        data = {}

    # Si no hay ruta configurada o apunta a un directorio inexistente, recurrir a la ruta portable
    current_root = data.get("root_path", "")
    if not current_root or not os.path.exists(current_root):
        data["root_path"] = default_root

    data.setdefault("theme", "auto")
    data.setdefault("sound_fx_enabled", True)
    data.setdefault("sidebar_width", 290)
    data.setdefault("window_title", "Explorador FB")
    data.setdefault("width", 1000)
    data.setdefault("height", 680)
    data.setdefault("maximized", True)
    return data


def _save_config(cfg: dict) -> None:
    cfg_copy = dict(cfg)
    cfg_path = _get_config_path_write()
    try:
        with open(cfg_path, "w", encoding="utf-8") as f:
            json.dump(cfg_copy, f, indent=2, ensure_ascii=False)
    except Exception as e:
        print(f"Error guardando config.json: {e}", file=sys.stderr)


class AppApi:
    def __init__(self, window_theme_manager=None):
        self._explorer = FileExplorerService()
        self._trash    = TrashService()
        self._config   = _load_config()
        self._window_theme_manager = window_theme_manager

    # ── Explorador ────────────────────────────────────────────────────────────

    def get_files(self, path: str = "") -> dict:
        root   = self._config.get("root_path", "")
        target = path.strip() if path and path.strip() else root
        nodes  = self._explorer.list_directory(target)
        return {"root": root, "path": target, "nodes": nodes}

    def open_file(self, path: str) -> dict:
        return self._explorer.open_item(path)

    def reveal_file(self, path: str) -> dict:
        target = path.strip() if path and path.strip() else self._config.get("root_path", "")
        return self._explorer.reveal_in_explorer(target)

    # ── Visor de contenido ────────────────────────────────────────────────────

    def read_file(self, path: str) -> dict:
        """
        Lee el contenido de un archivo y retorna su tipo, contenido
        y metadatos para renderizarlo en el panel de vista previa.

        Retorna
        -------
        dict con las claves:
          - type      : 'image' | 'markdown' | 'code' | 'text' | 'none'
          - content   : str  (texto plano o data-URL base64 para imágenes)
          - name      : str  (nombre del archivo)
          - extension : str  (extensión sin punto, en minúsculas)
          - size      : int  (bytes)
          - language  : str  (nombre del lenguaje para highlight.js; '' si no aplica)
          - message   : str  (mensaje descriptivo cuando type == 'none')
        """
        if not path or not os.path.isfile(path):
            return self._no_preview("", "", 0, "Archivo no encontrado")

        name = os.path.basename(path)
        _, ext = os.path.splitext(name)
        ext  = ext.lower()
        size = os.path.getsize(path)
        base = {"name": name, "extension": ext.lstrip("."), "size": size, "language": ""}

        try:
            # ── Archivos PDF ──────────────────────────────────────────────────
            if ext == '.pdf':
                MAX_PDF_BYTES = 50 * 1024 * 1024  # 50 MB
                if size > MAX_PDF_BYTES:
                    return self._no_preview(name, ext, size,
                        f"Documento PDF demasiado grande ({size // (1024*1024)} MB). Límite: 50 MB.")
                with open(path, "rb") as f:
                    data = base64.b64encode(f.read()).decode("utf-8")
                return {**base, "type": "pdf",
                        "content": data, "message": ""}

            # ── Imágenes ──────────────────────────────────────────────────────
            if ext in IMAGE_EXTS:
                if size > MAX_IMAGE_BYTES:
                    return self._no_preview(name, ext, size,
                        f"Imagen demasiado grande ({size // (1024*1024)} MB). Límite: 8 MB.")
                with open(path, "rb") as f:
                    data = base64.b64encode(f.read()).decode("utf-8")
                mime = MIME_MAP.get(ext, "image/png")
                return {**base, "type": "image",
                        "content": f"data:{mime};base64,{data}", "message": ""}

            # ── Texto, código y markdown ──────────────────────────────────────
            if ext in MARKDOWN_EXTS | CODE_EXTS | TEXT_EXTS:
                if size > MAX_TEXT_BYTES:
                    return self._no_preview(name, ext, size,
                        f"Archivo demasiado grande ({size // 1024} KB). Límite: 500 KB.")

                content = None
                for enc in ("utf-8-sig", "utf-8", "latin-1", "cp1252"):
                    try:
                        with open(path, "r", encoding=enc) as f:
                            content = f.read()
                        break
                    except (UnicodeDecodeError, LookupError):
                        continue

                if content is None:
                    return self._no_preview(name, ext, size,
                        "No se puede leer el archivo (binario o codificación no soportada).")

                if ext in MARKDOWN_EXTS:
                    return {**base, "type": "markdown", "content": content, "message": ""}
                elif ext in {'.html', '.htm'}:
                    dir_path = os.path.dirname(os.path.abspath(path))
                    return {**base, "type": "html", "content": content,
                            "language": "html", "dir_path": dir_path, "path": path, "message": ""}
                elif ext in CODE_EXTS:
                    return {**base, "type": "code", "content": content,
                            "language": LANG_MAP.get(ext, ""), "message": ""}
                else:
                    return {**base, "type": "text", "content": content, "message": ""}

            # ── Documentos Word (.docx) ───────────────────────────────────────
            if ext == '.docx':
                doc_res = DocumentReaderService.read_docx(path, size)
                return {**base, **doc_res}

            # ── Hojas de cálculo Excel (.xlsx, .xls) ───────────────────────────
            if ext in {'.xlsx', '.xls'}:
                xls_res = DocumentReaderService.read_excel(path, size)
                return {**base, **xls_res}

            # ── Presentaciones PowerPoint (.pptx) ─────────────────────────────
            if ext == '.pptx':
                pptx_res = DocumentReaderService.read_pptx(path, size)
                return {**base, **pptx_res}

            # ── Archivos comprimidos (.zip, .tar, .gz, etc.) ──────────────────
            if ext in {'.zip', '.tar', '.gz', '.tgz', '.bz2'}:
                arch_res = DocumentReaderService.read_archive(path, ext, size)
                return {**base, **arch_res}

            # ── Audio (.mp3, .wav, .ogg, .m4a, .aac, .flac) ───────────────────
            if ext in {'.mp3', '.wav', '.ogg', '.m4a', '.aac', '.flac'}:
                audio_res = DocumentReaderService.read_media(path, ext, size, "audio")
                return {**base, **audio_res}

            # ── Video (.mp4, .webm, .mov) ─────────────────────────────────────
            if ext in {'.mp4', '.webm', '.mov'}:
                video_res = DocumentReaderService.read_media(path, ext, size, "video")
                return {**base, **video_res}

            # ── Cuadernos Jupyter (.ipynb) ────────────────────────────────────
            if ext == '.ipynb':
                nb_res = DocumentReaderService.read_notebook(path, size)
                return {**base, **nb_res}

            # ── Sin vista previa disponible ───────────────────────────────────
            return self._no_preview(name, ext, size, "")

        except PermissionError:
            return self._no_preview(name, ext, size, "Sin permiso para leer este archivo.")
        except OSError as e:
            return self._no_preview(name, ext, size, str(e))

    @staticmethod
    def _no_preview(name: str, ext: str, size: int, message: str) -> dict:
        return {
            "type": "none", "content": "", "message": message,
            "name": name, "extension": ext.lstrip("."), "size": size, "language": ""
        }

    # ── Configuración ─────────────────────────────────────────────────────────

    def get_config(self) -> dict:
        self._config = _load_config()
        return self._config

    def select_root_folder(self, persist: bool = False) -> dict:
        root_tk = tk.Tk()
        root_tk.withdraw()
        root_tk.attributes("-topmost", True)
        folder = filedialog.askdirectory(
            parent=root_tk,
            title="Seleccionar carpeta raíz del explorador",
            initialdir=self._config.get("root_path", get_default_root_path())
        )
        root_tk.destroy()
        if folder:
            norm_folder = folder.replace("/", "\\")
            self._config["root_path"] = norm_folder
            if persist:
                _save_config(self._config)
            return {"success": True, "path": norm_folder}
        return {"success": False, "path": ""}

    def save_root_folder_persistent(self, folder_path: str) -> dict:
        if not folder_path or not os.path.exists(folder_path):
            return {"success": False, "message": "La ruta especificada no existe en el sistema."}
        self._config["root_path"] = folder_path.replace("/", "\\")
        _save_config(self._config)
        return {"success": True, "path": self._config["root_path"]}

    def get_app_settings(self) -> dict:
        return {
            "root_path": self._config.get("root_path", get_default_root_path()),
            "default_system_path": get_default_root_path(),
            "theme": self._config.get("theme", "auto"),
            "sound_fx_enabled": bool(self._config.get("sound_fx_enabled", True)),
            "sidebar_width": int(self._config.get("sidebar_width", 290)),
            "version": "4.0.0"
        }

    def reset_to_default_root(self) -> dict:
        default_root = get_default_root_path()
        self._config["root_path"] = default_root
        _save_config(self._config)
        return {"success": True, "path": default_root}

    def save_theme(self, theme: str) -> dict:
        self._config["theme"] = theme
        _save_config(self._config)
        if self._window_theme_manager:
            self._window_theme_manager.apply_theme(theme)
        return {"success": True}

    # ── Papelera y almacenamiento ─────────────────────────────────────────────

    def get_trash_data(self) -> dict:
        return self._trash.get_trash_data()

    def toss_to_trash(self, path: str) -> dict:
        return self._trash.toss_to_trash(path)

    def restore_trash_item(self, item_id: str) -> dict:
        return self._trash.restore_item(item_id)

    def delete_trash_item_permanently(self, item_id: str) -> dict:
        return self._trash.delete_permanently(item_id)

    def empty_trash(self) -> dict:
        return self._trash.empty_trash()

    def get_sound_setting(self) -> bool:
        return bool(self._config.get("sound_fx_enabled", True))

    def save_sound_setting(self, enabled: bool) -> dict:
        self._config["sound_fx_enabled"] = enabled
        _save_config(self._config)
        return {"success": True}

    def save_sidebar_width(self, width: int) -> dict:
        try:
            self._config["sidebar_width"] = max(180, min(int(width), 1200))
            _save_config(self._config)
            return {"success": True}
        except Exception as e:
            return {"success": False, "message": str(e)}

    # ── Operaciones de sistema de archivos (Fase 1 CRUD) ────────────────────────

    def create_folder(self, parent_path: str, name: str = "Nueva carpeta") -> dict:
        target_dir = parent_path if parent_path else self._config.get("root_path", "")
        return self._explorer.create_directory(target_dir, name)

    def create_file(self, parent_path: str, name: str = "Nuevo documento.txt") -> dict:
        target_dir = parent_path if parent_path else self._config.get("root_path", "")
        return self._explorer.create_file(target_dir, name)

    def save_file_content(self, file_path: str, content: str) -> dict:
        return self._explorer.save_file_content(file_path, content)

    def rename_item(self, old_path: str, new_name: str) -> dict:
        return self._explorer.rename_item(old_path, new_name)

    def copy_item(self, source_path: str, target_dir: str) -> dict:
        return self._explorer.copy_item(source_path, target_dir)

    def move_item(self, source_path: str, target_dir: str) -> dict:
        return self._explorer.move_item(source_path, target_dir)

    def duplicate_item(self, source_path: str) -> dict:
        return self._explorer.duplicate_item(source_path)

    def get_folders_list(self, root_path: str = "") -> dict:
        target_root = root_path if root_path else self._config.get("root_path", "")
        return {"folders": self._explorer.get_all_folders(target_root)}

    # ── Potencia, búsqueda y metadatos (Fase 3) ─────────────────────────────────

    def search_files(self, query: str, root_path: str = "") -> dict:
        target_root = root_path.strip() if root_path and root_path.strip() else self._config.get("root_path", "")
        return self._explorer.search_files(target_root, query)

    def get_item_properties(self, path: str) -> dict:
        return self._explorer.get_item_properties(path)



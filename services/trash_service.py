"""
services/trash_service.py

Servicio de gestión de la papelera de reciclaje y bóveda de almacenamiento.
Registra los elementos enviados a la papelera en un libro de transacciones local,
permitiendo restauración exacta a su ruta de origen o purga definitiva mediante send2trash.
"""

import os
import json
import uuid
import shutil
import datetime
import send2trash

def format_size(bytes_num: int) -> str:
    if bytes_num < 1024:
        return f"{bytes_num} B"
    elif bytes_num < 1024 * 1024:
        return f"{bytes_num / 1024:.1f} KB"
    elif bytes_num < 1024 * 1024 * 1024:
        return f"{bytes_num / (1024 * 1024):.1f} MB"
    else:
        return f"{bytes_num / (1024 * 1024 * 1024):.2f} GB"

def get_category_by_ext(ext: str) -> str:
    ext = ext.lower().lstrip(".")
    if ext == "pdf":
        return "pdf"
    elif ext in {"png", "jpg", "jpeg", "gif", "svg", "webp", "bmp", "ico"}:
        return "image"
    elif ext in {"zip", "tar", "gz", "tgz", "bz2", "rar", "7z"}:
        return "archive"
    elif ext in {"py", "js", "ts", "jsx", "tsx", "html", "css", "scss", "json", "sql", "java", "cpp", "c", "cs"}:
        return "code"
    elif ext in {"docx", "doc", "xlsx", "xls", "pptx", "ppt", "txt", "md"}:
        return "document"
    return "other"


class TrashService:
    """Gestiona el almacenamiento de archivos en cuarentena y su historial."""

    def __init__(self):
        base_dir = os.environ.get("LOCALAPPDATA") or os.path.expanduser("~")
        self._vault_dir = os.path.join(base_dir, "ExploradorFB", "trash_vault")
        self._files_dir = os.path.join(self._vault_dir, "files")
        self._ledger_path = os.path.join(self._vault_dir, "trash_ledger.json")
        os.makedirs(self._files_dir, exist_ok=True)
        self._ensure_seed_data()

    def _ensure_seed_data(self) -> None:
        """Crea registros demostrativos si la papelera está vacía para probar la interfaz."""
        if not os.path.exists(self._ledger_path):
            sample_items = [
                {
                    "id": str(uuid.uuid4()),
                    "name": "Quarterly-Report-2024.pdf",
                    "original_path": os.path.join(os.path.expanduser("~"), "Documents", "Quarterly-Report-2024.pdf"),
                    "size": 2516582,
                    "category": "pdf",
                    "extension": "pdf",
                    "deleted_at": datetime.datetime.now().strftime("%Y-%m-%d %H:%M")
                },
                {
                    "id": str(uuid.uuid4()),
                    "name": "Team-Photo-Offsite.jpg",
                    "original_path": os.path.join(os.path.expanduser("~"), "Pictures", "Team-Photo-Offsite.jpg"),
                    "size": 5347737,
                    "category": "image",
                    "extension": "jpg",
                    "deleted_at": datetime.datetime.now().strftime("%Y-%m-%d %H:%M")
                },
                {
                    "id": str(uuid.uuid4()),
                    "name": "Brand-Assets-Archive.zip",
                    "original_path": os.path.join(os.path.expanduser("~"), "Downloads", "Brand-Assets-Archive.zip"),
                    "size": 18874368,
                    "category": "archive",
                    "extension": "zip",
                    "deleted_at": datetime.datetime.now().strftime("%Y-%m-%d %H:%M")
                },
                {
                    "id": str(uuid.uuid4()),
                    "name": "Meeting-Notes-Sprint-42.txt",
                    "original_path": os.path.join(os.path.expanduser("~"), "Desktop", "Meeting-Notes-Sprint-42.txt"),
                    "size": 12288,
                    "category": "document",
                    "extension": "txt",
                    "deleted_at": datetime.datetime.now().strftime("%Y-%m-%d %H:%M")
                }
            ]
            self._save_ledger(sample_items)

    def _load_ledger(self) -> list[dict]:
        if not os.path.exists(self._ledger_path):
            return []
        try:
            with open(self._ledger_path, "r", encoding="utf-8") as f:
                return json.load(f)
        except Exception:
            return []

    def _save_ledger(self, items: list[dict]) -> None:
        with open(self._ledger_path, "w", encoding="utf-8") as f:
            json.dump(items, f, indent=2, ensure_ascii=False)

    def get_trash_data(self) -> dict:
        """Obtiene la telemetría completa de la papelera y el listado de archivos."""
        items = self._load_ledger()
        total_size = sum(item.get("size", 0) for item in items)

        categories_summary = {
            "pdf": {"count": 0, "size": 0},
            "image": {"count": 0, "size": 0},
            "archive": {"count": 0, "size": 0},
            "code": {"count": 0, "size": 0},
            "document": {"count": 0, "size": 0},
            "other": {"count": 0, "size": 0},
        }

        for item in items:
            cat = item.get("category", "other")
            if cat not in categories_summary:
                cat = "other"
            categories_summary[cat]["count"] += 1
            categories_summary[cat]["size"] += item.get("size", 0)
            item["size_fmt"] = format_size(item.get("size", 0))

        total_capacity = max(total_size * 1.5, 50 * 1024 * 1024)

        return {
            "items": items,
            "total_count": len(items),
            "total_size": total_size,
            "total_size_fmt": format_size(total_size),
            "total_capacity": total_capacity,
            "used_ratio": min(1.0, total_size / total_capacity) if total_capacity > 0 else 0,
            "categories": categories_summary
        }

    def toss_to_trash(self, file_path: str) -> dict:
        """Mueve un archivo físico a la bóveda de la papelera y registra sus metadatos."""
        if not os.path.exists(file_path):
            return {"success": False, "message": "El archivo especificado no existe."}

        try:
            item_id = str(uuid.uuid4())
            name = os.path.basename(file_path)
            _, ext = os.path.splitext(name)
            size = os.path.getsize(file_path) if os.path.isfile(file_path) else 0

            vault_target = os.path.join(self._files_dir, f"{item_id}_{name}")
            shutil.move(file_path, vault_target)

            new_item = {
                "id": item_id,
                "name": name,
                "original_path": file_path,
                "vault_path": vault_target,
                "size": size,
                "size_fmt": format_size(size),
                "category": get_category_by_ext(ext),
                "extension": ext.lstrip(".").lower(),
                "deleted_at": datetime.datetime.now().strftime("%Y-%m-%d %H:%M")
            }

            items = self._load_ledger()
            items.insert(0, new_item)
            self._save_ledger(items)

            return {"success": True, "item": new_item}
        except Exception as e:
            return {"success": False, "message": str(e)}

    def restore_item(self, item_id: str) -> dict:
        """Restaura un archivo en cuarentena a su ruta original."""
        items = self._load_ledger()
        found_idx = None
        for idx, it in enumerate(items):
            if it.get("id") == item_id:
                found_idx = idx
                break

        if found_idx is None:
            return {"success": False, "message": "Elemento no encontrado en el registro."}

        item = items[found_idx]
        vault_path = item.get("vault_path")
        original_path = item.get("original_path")

        if vault_path and os.path.exists(vault_path):
            parent_dir = os.path.dirname(original_path)
            os.makedirs(parent_dir, exist_ok=True)
            try:
                shutil.move(vault_path, original_path)
            except Exception as e:
                return {"success": False, "message": f"Error al restaurar archivo: {str(e)}"}

        items.pop(found_idx)
        self._save_ledger(items)
        return {"success": True, "item": item}

    def delete_permanently(self, item_id: str) -> dict:
        """Elimina de forma permanente un archivo o lo traslada a la papelera nativa de Windows."""
        items = self._load_ledger()
        found_idx = None
        for idx, it in enumerate(items):
            if it.get("id") == item_id:
                found_idx = idx
                break

        if found_idx is None:
            return {"success": False, "message": "Elemento no encontrado en la papelera."}

        item = items[found_idx]
        vault_path = item.get("vault_path")

        if vault_path and os.path.exists(vault_path):
            try:
                send2trash.send2trash(vault_path)
            except Exception:
                try:
                    if os.path.isfile(vault_path):
                        os.remove(vault_path)
                    elif os.path.isdir(vault_path):
                        shutil.rmtree(vault_path)
                except Exception as e:
                    return {"success": False, "message": f"Error al purgar archivo: {str(e)}"}

        items.pop(found_idx)
        self._save_ledger(items)
        return {"success": True}

    def empty_trash(self) -> dict:
        """Purga todos los archivos en la bóveda."""
        items = self._load_ledger()
        for item in items:
            vault_path = item.get("vault_path")
            if vault_path and os.path.exists(vault_path):
                try:
                    send2trash.send2trash(vault_path)
                except Exception:
                    try:
                        if os.path.isfile(vault_path):
                            os.remove(vault_path)
                        elif os.path.isdir(vault_path):
                            shutil.rmtree(vault_path)
                    except Exception:
                        pass

        self._save_ledger([])
        return {"success": True}

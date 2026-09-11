"""
services/file_explorer_service.py

Servicio de exploración del sistema de archivos local.
Proporciona listado por nivel, apertura nativa con os.startfile
y revelado de archivos en el Explorador de Windows.
"""

import os
import subprocess

# Directorios técnicos que se ocultan al usuario.
EXCLUDED_DIRS = {
    "node_modules", ".git", ".venv", "venv", "__pycache__",
    ".idea", ".vscode", "dist", "build", ".next", ".nuxt",
    "$RECYCLE.BIN", "System Volume Information"
}

# Archivos del sistema que se excluyen de la vista.
EXCLUDED_FILES = {
    "desktop.ini", "thumbs.db", ".ds_store", ".gitignore",
    ".gitkeep", "thumbs.db:encryptable"
}


class FileExplorerService:
    """Gestiona la lectura y apertura de archivos y directorios locales."""

    def list_directory(self, path: str) -> list[dict]:
        """
        Lista el contenido de un directorio en un único nivel.
        Retorna carpetas primero (orden alfabético) y luego archivos,
        excluyendo entradas técnicas no relevantes.
        """
        if not os.path.isdir(path):
            return []

        dirs = []
        files = []

        try:
            entries = os.scandir(path)
        except PermissionError:
            return []

        with entries:
            for entry in entries:
                name_lower = entry.name.lower()

                if entry.name.startswith(".") or entry.name.startswith("$"):
                    continue

                try:
                    stat = entry.stat(follow_symlinks=False)
                    size = stat.st_size
                    mtime = stat.st_mtime
                except (OSError, PermissionError):
                    size = 0
                    mtime = 0.0

                if entry.is_dir(follow_symlinks=False):
                    if entry.name in EXCLUDED_DIRS:
                        continue
                    dirs.append({
                        "name": entry.name,
                        "path": entry.path,
                        "is_dir": True,
                        "extension": "",
                        "size": size,
                        "modified": mtime
                    })
                else:
                    if name_lower in EXCLUDED_FILES:
                        continue
                    _, ext = os.path.splitext(entry.name)
                    files.append({
                        "name": entry.name,
                        "path": entry.path,
                        "is_dir": False,
                        "extension": ext.lstrip(".").lower(),
                        "size": size,
                        "modified": mtime
                    })

        dirs.sort(key=lambda n: n["name"].lower())
        files.sort(key=lambda n: n["name"].lower())

        return dirs + files

    def open_item(self, path: str) -> dict:
        """Abre un archivo o carpeta con el programa predeterminado de Windows."""
        try:
            os.startfile(path)
            return {"success": True}
        except Exception as e:
            return {"success": False, "message": str(e)}

    def reveal_in_explorer(self, path: str) -> dict:
        """
        Abre el Explorador de Windows con el elemento seleccionado.
        Si es archivo, lo selecciona dentro de su carpeta contenedora.
        """
        try:
            if os.path.isfile(path):
                subprocess.run(["explorer", f"/select,{path}"], check=False)
            else:
                subprocess.run(["explorer", path], check=False)
            return {"success": True}
        except Exception as e:
            return {"success": False, "message": str(e)}

    def create_directory(self, parent_path: str, name: str = "Nueva carpeta") -> dict:
        """Crea una nueva carpeta resolviendo colisiones secuenciales."""
        if not os.path.isdir(parent_path):
            return {"success": False, "message": "El directorio contenedor no existe."}

        clean_name = name.strip() or "Nueva carpeta"
        invalid_chars = {'\\', '/', ':', '*', '?', '"', '<', '>', '|'}
        if any(c in invalid_chars for c in clean_name):
            return {"success": False, "message": "El nombre contiene caracteres inválidos."}

        candidate = clean_name
        counter = 2
        while os.path.exists(os.path.join(parent_path, candidate)):
            candidate = f"{clean_name} ({counter})"
            counter += 1

        target_path = os.path.join(parent_path, candidate)
        try:
            os.makedirs(target_path, exist_ok=False)
            return {
                "success": True,
                "path": target_path,
                "name": candidate,
                "is_dir": True
            }
        except Exception as e:
            return {"success": False, "message": f"Error al crear carpeta: {str(e)}"}

    def create_file(self, parent_path: str, name: str = "Nuevo documento.txt") -> dict:
        """Crea un nuevo archivo vacío en disco resolviendo colisiones de nombres."""
        if not os.path.isdir(parent_path):
            return {"success": False, "message": "El directorio contenedor no existe."}

        clean_name = name.strip() or "Nuevo documento.txt"
        invalid_chars = {'\\', '/', ':', '*', '?', '"', '<', '>', '|'}
        if any(c in invalid_chars for c in clean_name):
            return {"success": False, "message": "El nombre contiene caracteres inválidos."}

        base, ext = os.path.splitext(clean_name)
        if not ext:
            ext = ".txt"
            clean_name = base + ext

        candidate = clean_name
        counter = 2
        while os.path.exists(os.path.join(parent_path, candidate)):
            candidate = f"{base} ({counter}){ext}"
            counter += 1

        target_path = os.path.join(parent_path, candidate)
        try:
            with open(target_path, "w", encoding="utf-8") as f:
                f.write("")
            return {
                "success": True,
                "path": target_path,
                "name": candidate,
                "is_dir": False
            }
        except Exception as e:
            return {"success": False, "message": f"Error al crear archivo: {str(e)}"}

    def save_file_content(self, file_path: str, content: str) -> dict:
        """Guarda el contenido en texto plano / UTF-8 de un archivo existente."""
        if not os.path.exists(file_path):
            return {"success": False, "message": "El archivo a editar no existe en el disco."}
        if os.path.isdir(file_path):
            return {"success": False, "message": "La ruta especificada es un directorio, no un archivo."}

        try:
            with open(file_path, "w", encoding="utf-8") as f:
                f.write(content)
            stat = os.stat(file_path)
            return {
                "success": True,
                "path": file_path,
                "size": stat.st_size,
                "mtime": stat.st_mtime,
                "message": "Archivo guardado correctamente"
            }
        except Exception as e:
            return {"success": False, "message": f"Error al guardar el archivo: {str(e)}"}

    def rename_item(self, old_path: str, new_name: str) -> dict:
        """Renombra un archivo o carpeta en el sistema de archivos."""
        if not os.path.exists(old_path):
            return {"success": False, "message": "El elemento especificado no existe."}

        clean_name = new_name.strip()
        if not clean_name:
            return {"success": False, "message": "El nombre no puede estar vacío."}

        invalid_chars = {'\\', '/', ':', '*', '?', '"', '<', '>', '|'}
        if any(c in invalid_chars for c in clean_name):
            return {"success": False, "message": "El nombre contiene caracteres inválidos."}

        parent_dir = os.path.dirname(old_path)
        new_path = os.path.join(parent_dir, clean_name)

        if os.path.abspath(old_path).lower() == os.path.abspath(new_path).lower():
            # Cambio únicamente de mayúsculas/minúsculas en Windows
            temp_path = os.path.join(parent_dir, f"__tmp_rename_{os.getpid()}_{clean_name}")
            try:
                os.rename(old_path, temp_path)
                os.rename(temp_path, new_path)
                return {"success": True, "old_path": old_path, "path": new_path, "new_path": new_path, "name": clean_name}
            except Exception as e:
                return {"success": False, "message": str(e)}

        if os.path.exists(new_path):
            return {"success": False, "message": "Ya existe un elemento con ese nombre en esta ubicación."}

        try:
            os.rename(old_path, new_path)
            return {"success": True, "old_path": old_path, "path": new_path, "new_path": new_path, "name": clean_name}
        except Exception as e:
            return {"success": False, "message": f"Error al renombrar: {str(e)}"}

    def copy_item(self, source_path: str, target_dir: str) -> dict:
        """Copia un archivo o carpeta hacia un directorio destino con resolución de colisiones."""
        import shutil

        if not os.path.exists(source_path):
            return {"success": False, "message": "El elemento origen no existe."}
        if not os.path.isdir(target_dir):
            return {"success": False, "message": "La carpeta de destino no existe."}

        src_abs = os.path.abspath(source_path)
        tgt_abs = os.path.abspath(target_dir)

        if os.path.isdir(src_abs) and tgt_abs.lower().startswith(src_abs.lower() + os.sep):
            return {"success": False, "message": "No es posible copiar una carpeta dentro de sí misma."}

        base_name = os.path.basename(src_abs)
        dest_candidate = os.path.join(tgt_abs, base_name)

        if os.path.exists(dest_candidate):
            if os.path.isfile(src_abs):
                name_part, ext_part = os.path.splitext(base_name)
                candidate_name = f"{name_part} - copia{ext_part}"
                c = 2
                while os.path.exists(os.path.join(tgt_abs, candidate_name)):
                    candidate_name = f"{name_part} - copia ({c}){ext_part}"
                    c += 1
                dest_candidate = os.path.join(tgt_abs, candidate_name)
            else:
                candidate_name = f"{base_name} - copia"
                c = 2
                while os.path.exists(os.path.join(tgt_abs, candidate_name)):
                    candidate_name = f"{base_name} - copia ({c})"
                    c += 1
                dest_candidate = os.path.join(tgt_abs, candidate_name)

        try:
            if os.path.isdir(src_abs):
                shutil.copytree(src_abs, dest_candidate)
            else:
                shutil.copy2(src_abs, dest_candidate)

            return {
                "success": True,
                "path": dest_candidate,
                "target_path": dest_candidate,
                "new_path": dest_candidate,
                "name": os.path.basename(dest_candidate),
                "new_name": os.path.basename(dest_candidate),
                "is_dir": os.path.isdir(dest_candidate)
            }
        except Exception as e:
            return {"success": False, "message": f"Error al copiar elemento: {str(e)}"}

    def move_item(self, source_path: str, target_dir: str) -> dict:
        """Mueve un archivo o carpeta hacia un nuevo directorio destino."""
        import shutil

        if not os.path.exists(source_path):
            return {"success": False, "message": "El elemento origen no existe."}
        if not os.path.isdir(target_dir):
            return {"success": False, "message": "La carpeta de destino no existe."}

        src_abs = os.path.abspath(source_path)
        tgt_abs = os.path.abspath(target_dir)

        if os.path.dirname(src_abs).lower() == tgt_abs.lower():
            return {"success": False, "message": "El elemento ya se encuentra en la carpeta indicada."}

        if os.path.isdir(src_abs) and tgt_abs.lower().startswith(src_abs.lower() + os.sep):
            return {"success": False, "message": "No es posible mover una carpeta dentro de sí misma."}

        base_name = os.path.basename(src_abs)
        dest_candidate = os.path.join(tgt_abs, base_name)

        if os.path.exists(dest_candidate):
            if os.path.isfile(src_abs):
                name_part, ext_part = os.path.splitext(base_name)
                candidate_name = f"{name_part} ({os.getpid()}){ext_part}"
                dest_candidate = os.path.join(tgt_abs, candidate_name)
            else:
                dest_candidate = os.path.join(tgt_abs, f"{base_name} ({os.getpid()})")

        try:
            shutil.move(src_abs, dest_candidate)
            return {
                "success": True,
                "old_path": src_abs,
                "path": dest_candidate,
                "target_path": dest_candidate,
                "new_path": dest_candidate,
                "name": os.path.basename(dest_candidate),
                "new_name": os.path.basename(dest_candidate),
                "is_dir": os.path.isdir(dest_candidate)
            }
        except Exception as e:
            return {"success": False, "message": f"Error al mover elemento: {str(e)}"}

    def duplicate_item(self, source_path: str) -> dict:
        """Duplica un archivo o carpeta en su misma carpeta contenedora."""
        parent_dir = os.path.dirname(source_path)
        return self.copy_item(source_path, parent_dir)

    def get_all_folders(self, root_path: str) -> list[dict]:
        """
        Explora y retorna la lista de carpetas accesibles bajo la raíz para el selector emergente.
        """
        if not os.path.isdir(root_path):
            return []

        folders = [{
            "name": os.path.basename(root_path) or root_path,
            "path": root_path,
            "relative": "/"
        }]

        root_abs = os.path.abspath(root_path)

        for current_root, dir_names, _ in os.walk(root_abs):
            # Filtrar exclusiones in-place
            dir_names[:] = [
                d for d in dir_names
                if not d.startswith(".") and not d.startswith("$") and d not in EXCLUDED_DIRS
            ]
            dir_names.sort(key=lambda s: s.lower())

            for d in dir_names:
                full_p = os.path.join(current_root, d)
                rel_p = os.path.relpath(full_p, root_abs).replace("\\", "/")
                folders.append({
                    "name": d,
                    "path": full_p,
                    "relative": rel_p
                })

        return folders

    def search_files(self, root_path: str, query: str, max_results: int = 150) -> dict:
        """
        Búsqueda recursiva optimizada en el árbol de directorios a partir de root_path.
        Retorna coincidencias de archivos y carpetas cuyo nombre contenga 'query'.
        """
        if not root_path or not os.path.isdir(root_path):
            return {"success": False, "results": [], "total": 0, "message": "Directorio no válido"}

        q = query.strip().lower()
        if not q:
            return {"success": True, "results": [], "total": 0, "message": "Término vacío"}

        results = []
        root_abs = os.path.abspath(root_path)

        try:
            for current_root, dir_names, file_names in os.walk(root_abs):
                # Filtrar exclusiones in-place para que os.walk no descienda en ellas
                dir_names[:] = [
                    d for d in dir_names
                    if not d.startswith(".") and not d.startswith("$") and d not in EXCLUDED_DIRS
                ]

                # 1. Comprobar carpetas
                for d in dir_names:
                    if q in d.lower():
                        full_p = os.path.join(current_root, d)
                        rel_p = os.path.relpath(full_p, root_abs).replace("\\", "/")
                        try:
                            st = os.stat(full_p)
                            mtime = st.st_mtime
                        except OSError:
                            mtime = 0.0

                        results.append({
                            "name": d,
                            "path": full_p,
                            "relative": rel_p,
                            "is_dir": True,
                            "extension": "",
                            "size": 0,
                            "modified": mtime
                        })
                        if len(results) >= max_results:
                            break

                if len(results) >= max_results:
                    break

                # 2. Comprobar archivos
                for f in file_names:
                    if f.startswith(".") or f.startswith("$") or f.lower() in EXCLUDED_FILES:
                        continue
                    if q in f.lower():
                        full_p = os.path.join(current_root, f)
                        rel_p = os.path.relpath(full_p, root_abs).replace("\\", "/")
                        _, ext = os.path.splitext(f)
                        try:
                            st = os.stat(full_p)
                            size = st.st_size
                            mtime = st.st_mtime
                        except OSError:
                            size = 0
                            mtime = 0.0

                        results.append({
                            "name": f,
                            "path": full_p,
                            "relative": rel_p,
                            "is_dir": False,
                            "extension": ext.lstrip(".").lower(),
                            "size": size,
                            "modified": mtime
                        })
                        if len(results) >= max_results:
                            break

                if len(results) >= max_results:
                    break

            return {"success": True, "results": results, "total": len(results)}
        except Exception as e:
            return {"success": False, "results": [], "total": 0, "message": str(e)}

    def get_item_properties(self, path: str) -> dict:
        """
        Calcula metadatos consolidados de un archivo o carpeta.
        Para carpetas, suma recursivamente el tamaño de archivos y cuenta elementos.
        """
        if not path or not os.path.exists(path):
            return {"success": False, "message": "El elemento no existe"}

        is_dir = os.path.isdir(path)
        name = os.path.basename(path) or path
        _, ext = os.path.splitext(name)
        extension = ext.lstrip(".").lower() if not is_dir else ""

        try:
            stat = os.stat(path)
            created = stat.st_ctime
            modified = stat.st_mtime
            accessed = stat.st_atime
        except OSError as e:
            return {"success": False, "message": f"Error de acceso: {str(e)}"}

        total_size = 0
        file_count = 0
        dir_count = 0

        if is_dir:
            try:
                for root, dirs, files in os.walk(path):
                    dirs[:] = [d for d in dirs if not d.startswith(".") and d not in EXCLUDED_DIRS]
                    dir_count += len(dirs)
                    for f in files:
                        if f.startswith(".") or f.lower() in EXCLUDED_FILES:
                            continue
                        file_count += 1
                        fp = os.path.join(root, f)
                        try:
                            total_size += os.path.getsize(fp)
                        except OSError:
                            pass
            except Exception:
                pass
        else:
            total_size = stat.st_size

        return {
            "success": True,
            "name": name,
            "path": path,
            "parent_dir": os.path.dirname(path),
            "is_dir": is_dir,
            "extension": extension,
            "size": total_size,
            "file_count": file_count,
            "dir_count": dir_count,
            "total_items": file_count + dir_count,
            "created": created,
            "modified": modified,
            "accessed": accessed
        }


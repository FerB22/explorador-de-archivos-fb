"""
services/media_server.py

Micro-servidor HTTP local multihilo para transmision de archivos multimedia (Audio y Video).
Implementa 'HTTP Range Requests' (RFC 7233) para permitir:
1. Carga instantanea de archivos de cualquier tamano (incluso videos de varios gigabytes).
2. Desplazamiento temporal fluido (scrubbing) sin precargar el archivo completo.
3. Consumo minimo y constante de memoria RAM (< 20 MB).
"""

import os
import sys
import mimetypes
import socket
from urllib.parse import urlparse, parse_qs
from http.server import HTTPServer, BaseHTTPRequestHandler
from socketserver import ThreadingMixIn
import threading

class ThreadingHTTPServer(ThreadingMixIn, HTTPServer):
    daemon_threads = True

class MediaRequestHandler(BaseHTTPRequestHandler):
    def log_message(self, format, *args):
        pass

    def do_HEAD(self):
        self._serve_media(head_only=True)

    def do_GET(self):
        self._serve_media(head_only=False)

    def _serve_media(self, head_only: bool = False):
        parsed = urlparse(self.path)
        qs = parse_qs(parsed.query)
        path_list = qs.get("path")

        if not path_list or not path_list[0]:
            self.send_error(400, "Parametro 'path' requerido.")
            return

        file_path = path_list[0]
        if not os.path.isfile(file_path):
            self.send_error(404, "Archivo multimedia no encontrado.")
            return

        try:
            file_size = os.path.getsize(file_path)
        except OSError:
            self.send_error(500, "Error al acceder a los metadatos del archivo.")
            return

        ext = os.path.splitext(file_path)[1].lower()
        mime_types = {
            '.mp3': 'audio/mpeg',
            '.wav': 'audio/wav',
            '.ogg': 'audio/ogg',
            '.m4a': 'audio/mp4',
            '.aac': 'audio/aac',
            '.flac': 'audio/flac',
            '.mp4': 'video/mp4',
            '.webm': 'video/webm',
            '.mov': 'video/quicktime',
            '.mkv': 'video/x-matroska',
        }
        content_type = mime_types.get(ext, mimetypes.guess_type(file_path)[0] or "application/octet-stream")

        range_header = self.headers.get("Range")
        start = 0
        end = file_size - 1
        status_code = 200

        if range_header and range_header.startswith("bytes="):
            try:
                ranges = range_header.replace("bytes=", "").split("-")
                if ranges[0]:
                    start = int(ranges[0])
                if len(ranges) > 1 and ranges[1]:
                    end = int(ranges[1])
                status_code = 206
            except (ValueError, IndexError):
                start = 0
                end = file_size - 1
                status_code = 200

        if start >= file_size or end >= file_size or start > end:
            self.send_response(416)
            self.send_header("Content-Range", f"bytes */{file_size}")
            self.end_headers()
            return

        content_length = end - start + 1

        self.send_response(status_code)
        self.send_header("Content-Type", content_type)
        self.send_header("Content-Length", str(content_length))
        self.send_header("Accept-Ranges", "bytes")
        self.send_header("Access-Control-Allow-Origin", "*")

        if status_code == 206:
            self.send_header("Content-Range", f"bytes {start}-{end}/{file_size}")

        self.end_headers()

        if head_only:
            return

        chunk_size = 64 * 1024
        try:
            with open(file_path, "rb") as f:
                f.seek(start)
                bytes_left = content_length
                while bytes_left > 0:
                    read_len = min(chunk_size, bytes_left)
                    data = f.read(read_len)
                    if not data:
                        break
                    self.wfile.write(data)
                    bytes_left -= len(data)
        except (ConnectionResetError, BrokenPipeError):
            pass
        except Exception:
            pass


class LocalMediaServer:
    _instance = None
    _lock = threading.Lock()

    def __init__(self):
        self.server = None
        self.port = 0
        self.thread = None
        self._start_server()

    @classmethod
    def get_instance(cls):
        with cls._lock:
            if cls._instance is None:
                cls._instance = LocalMediaServer()
            return cls._instance

    def _start_server(self):
        self.server = ThreadingHTTPServer(("127.0.0.1", 0), MediaRequestHandler)
        self.port = self.server.server_port
        self.thread = threading.Thread(target=self.server.serve_forever, daemon=True)
        self.thread.start()

    def get_media_url(self, file_path: str) -> str:
        from urllib.parse import quote
        abs_path = os.path.abspath(file_path)
        encoded_path = quote(abs_path)
        return f"http://127.0.0.1:{self.port}/media?path={encoded_path}"

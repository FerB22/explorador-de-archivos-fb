"""
services/window_theme.py

Gestor nativo de ventana para Windows (DWM y User32).
Permite:
1. Centrar la ventana en el monitor adecuado usando GetMonitorInfoW y el área rcWork.
2. Pintar la barra de título, texto y bordes con los colores nativos de la aplicación,
   anulando el color de acento genérico de Windows.
"""

import sys
import ctypes
from ctypes import wintypes
import winreg
from typing import Optional

# Constantes de atributos de ventana en DWM (Desktop Window Manager)
DWMWA_USE_IMMERSIVE_DARK_MODE = 20
DWMWA_BORDER_COLOR = 34
DWMWA_CAPTION_COLOR = 35
DWMWA_TEXT_COLOR = 36


class RECT(ctypes.Structure):
    _fields_ = [
        ("left", wintypes.LONG),
        ("top", wintypes.LONG),
        ("right", wintypes.LONG),
        ("bottom", wintypes.LONG),
    ]


class MONITORINFO(ctypes.Structure):
    _fields_ = [
        ("cbSize", wintypes.DWORD),
        ("rcMonitor", RECT),
        ("rcWork", RECT),
        ("dwFlags", wintypes.DWORD),
    ]


def hex_to_colorref(hex_str: str) -> int:
    """Convierte una cadena hexadecimal (#RRGGBB) al formato nativo COLORREF (0x00BBGGRR)."""
    hex_clean = hex_str.lstrip('#')
    if len(hex_clean) == 3:
        hex_clean = ''.join([c * 2 for c in hex_clean])
    r = int(hex_clean[0:2], 16)
    g = int(hex_clean[2:4], 16)
    b = int(hex_clean[4:6], 16)
    return (b << 16) | (g << 8) | r


def is_system_dark_mode() -> bool:
    """Determina si Windows tiene activo el modo oscuro mediante la lectura del registro."""
    try:
        key = winreg.OpenKey(
            winreg.HKEY_CURRENT_USER,
            r"Software\Microsoft\Windows\CurrentVersion\Themes\Personalize",
            0,
            winreg.KEY_READ,
        )
        val, _ = winreg.QueryValueEx(key, "AppsUseLightTheme")
        winreg.CloseKey(key)
        return val == 0
    except Exception:
        return True


class WindowThemeManager:
    """
    Gestiona la barra de título y centrado de ventana en Windows mediante DWM y Win32 API.
    """
    _serializable = False

    def __init__(self, hwnd: Optional[int] = None) -> None:
        self._hwnd: Optional[int] = hwnd

    def set_hwnd(self, hwnd: int) -> None:
        self._hwnd = int(hwnd)

    @property
    def hwnd(self) -> Optional[int]:
        return self._hwnd

    def center_window(self) -> bool:
        """
        Centra la ventana en el monitor activo considerando el área de trabajo real (rcWork),
        descontando la barra de tareas y respetando el escalado DPI.
        """
        if sys.platform != "win32":
            return False

        target_hwnd = self.hwnd
        if not target_hwnd:
            return False

        try:
            user32 = ctypes.windll.user32
            h_wnd = wintypes.HWND(target_hwnd)

            rect = RECT()
            if not user32.GetWindowRect(h_wnd, ctypes.byref(rect)):
                return False

            win_w = rect.right - rect.left
            win_h = rect.bottom - rect.top

            # MONITOR_DEFAULTTONEAREST = 2
            h_monitor = user32.MonitorFromWindow(h_wnd, 2)
            if not h_monitor:
                return False

            mi = MONITORINFO()
            mi.cbSize = ctypes.sizeof(MONITORINFO)
            if not user32.GetMonitorInfoW(h_monitor, ctypes.byref(mi)):
                return False

            work_w = mi.rcWork.right - mi.rcWork.left
            work_h = mi.rcWork.bottom - mi.rcWork.top

            x = mi.rcWork.left + (work_w - win_w) // 2
            y = mi.rcWork.top + (work_h - win_h) // 2

            # SWP_NOSIZE = 0x0001, SWP_NOZORDER = 0x0004
            user32.SetWindowPos(h_wnd, 0, x, y, 0, 0, 0x0001 | 0x0004)
            return True
        except Exception as err:
            print(f"No fue posible centrar la ventana: {err}")
            return False

    def maximize_window(self) -> bool:
        """
        Maximiza la ventana en el monitor actual ocupando el área de trabajo completa,
        respetando la barra de tareas y mostrando la barra de título (sin modo F11/fullscreen).
        """
        if sys.platform != "win32":
            return False

        target_hwnd = self.hwnd
        if not target_hwnd:
            return False

        try:
            user32 = ctypes.windll.user32
            h_wnd = wintypes.HWND(target_hwnd)
            # SW_MAXIMIZE = 3 en Windows User32
            user32.ShowWindow(h_wnd, 3)
            return True
        except Exception as err:
            print(f"No fue posible maximizar la ventana: {err}")
            return False

    def apply_theme(self, theme_mode: str = "auto") -> bool:
        """
        Aplica los colores de la aplicación a la barra de título, texto y bordes.
        """
        if sys.platform != "win32":
            return False

        target_hwnd = self.hwnd
        if not target_hwnd:
            return False

        is_dark = (theme_mode == "dark") or (theme_mode == "auto" and is_system_dark_mode())

        if is_dark:
            caption_color = "#0f1118"
            text_color = "#f8fafc"
            border_color = "#1f2333"
        else:
            caption_color = "#f1f5f9"
            text_color = "#0f172a"
            border_color = "#cbd5e1"

        try:
            dwmapi = ctypes.windll.dwmapi
            h_wnd = wintypes.HWND(target_hwnd)

            # 1. Modo inmersivo oscuro / claro
            dark_flag = ctypes.c_int(1 if is_dark else 0)
            dwmapi.DwmSetWindowAttribute(
                h_wnd,
                DWMWA_USE_IMMERSIVE_DARK_MODE,
                ctypes.byref(dark_flag),
                ctypes.sizeof(dark_flag)
            )

            # 2. Color de fondo de la barra de título (DWMWA_CAPTION_COLOR = 35)
            caption_ref = ctypes.c_int(hex_to_colorref(caption_color))
            dwmapi.DwmSetWindowAttribute(
                h_wnd,
                DWMWA_CAPTION_COLOR,
                ctypes.byref(caption_ref),
                ctypes.sizeof(caption_ref)
            )

            # 3. Color del texto del título (DWMWA_TEXT_COLOR = 36)
            text_ref = ctypes.c_int(hex_to_colorref(text_color))
            dwmapi.DwmSetWindowAttribute(
                h_wnd,
                DWMWA_TEXT_COLOR,
                ctypes.byref(text_ref),
                ctypes.sizeof(text_ref)
            )

            # 4. Color del borde exterior (DWMWA_BORDER_COLOR = 34)
            border_ref = ctypes.c_int(hex_to_colorref(border_color))
            dwmapi.DwmSetWindowAttribute(
                h_wnd,
                DWMWA_BORDER_COLOR,
                ctypes.byref(border_ref),
                ctypes.sizeof(border_ref)
            )
            return True
        except Exception as err:
            print(f"No fue posible aplicar el color a la barra de título: {err}")
            return False

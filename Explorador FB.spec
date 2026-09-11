# -*- mode: python ; coding: utf-8 -*-
# Explorador FB.spec
# Generado para pywebview (EdgeChromium/WebView2) en Windows

from PyInstaller.utils.hooks import collect_all

datas         = [('web', 'web'), ('config.json', '.')]
binaries      = []
hiddenimports = [
    'services',
    'services.file_explorer_service',
    'services.document_reader_service',
    'services.trash_service',
    'services.window_theme',
    'mammoth',
    'openpyxl',
    'pptx',
    'pptx.oxml',
    'openpyxl.cell._writer',
    'win32com',
    'win32com.client',
    'pythoncom',
    'pypdfium2',
    'send2trash',
]

for pkg in ['pywebview', 'pptx', 'openpyxl', 'mammoth', 'pypdfium2', 'send2trash']:
    try:
        tmp = collect_all(pkg)
        datas         += tmp[0]
        binaries      += tmp[1]
        hiddenimports += tmp[2]
    except Exception:
        pass

a = Analysis(
    ['app.py'],
    pathex=['.'],
    binaries=binaries,
    datas=datas,
    hiddenimports=hiddenimports,
    hookspath=[],
    hooksconfig={},
    runtime_hooks=[],
    excludes=[],
    noarchive=False,
    optimize=0,
)

pyz = PYZ(a.pure)

exe = EXE(
    pyz,
    a.scripts,
    [],
    exclude_binaries=True,
    name='Explorador FB',
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=True,
    console=False,
    disable_windowed_traceback=False,
    argv_emulation=False,
    target_arch=None,
    codesign_identity=None,
    entitlements_file=None,
    icon=['logo.ico'],
)

coll = COLLECT(
    exe,
    a.binaries,
    a.datas,
    strip=False,
    upx=True,
    upx_exclude=[],
    name='Explorador FB',
)

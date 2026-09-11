# Explorador FB — Explorador de Archivos y Visor Integrado para Windows

Un explorador de archivos ligero, moderno y ergonómico para Windows desarrollado con **Python** y **pywebview (Edge WebView2)**. Diseñado como una estación de trabajo centrada en la visualización rápida de documentos, código, datos multimedia y navegación ágil en disco sin la sobrecarga de aplicaciones pesadas basadas en Electron.

---

## Características Principales

- **Visor Multiformato Integrado**:
  - **Documentos Word (`.docx`)**: Renderizado dinámico en HTML estructurado preservando tipografía y tablas mediante `mammoth`.
  - **Hojas de Cálculo (`.xlsx`)**: Navegación de pestañas con cuadrícula estilizada y formateo de datos vía `openpyxl`.
  - **Presentaciones PowerPoint (`.pptx`)**: Motor híbrido triple (renderizado nativo mediante automatización COM de PowerPoint, LibreOffice + `pypdfium2`, o extracción estructurada con `python-pptx`).
  - **PDF nativo**: Visualizador embebido fluido con navegación por páginas y zoom.
  - **Código fuente y Markdown**: Editor de texto integrado con resaltado de sintaxis (soporta `.py`, `.js`, `.json`, `.css`, `.html`, `.md`, `.txt`, `.sql`, etc.) y guardado directo con <kbd>Ctrl</kbd> + <kbd>S</kbd>.
  - **Multimedia y Archivos Comprimidos**: Reproducción de audio y vídeo con controles nativos, e inspección del árbol interno de archivos `.zip` y `.tar`.
  
- **Navegación Ergonómica de Alto Rendimiento**:
  - **Soporte total para ruedas laterales y gestos**: Diseñado específicamente para ratones como el Logitech MX Master 3S (rueda de pulgar) y combinaciones <kbd>Shift</kbd> + rueda, garantizando desplazamiento horizontal síncrono y sin bloqueos en el árbol y visores de código.
  - **Sistema de Pestañas**: Pestañas múltiples con atajos estilo navegador (<kbd>Ctrl</kbd> + <kbd>T</kbd>, <kbd>Ctrl</kbd> + <kbd>W</kbd>, reordenación).
  - **Acceso Rápido / Favoritos**: Fijación de carpetas y archivos frecuentes en la barra lateral con sincronización persistente y selección de iconos según tipo de archivo.
  - **Búsqueda Recursiva Ultrarrápida**: Ventana flotante de búsqueda global en disco (<kbd>Ctrl</kbd> + <kbd>P</kbd>) con navegación por teclado.
  - **Papelera de Reciclaje Integrada**: Inspección y restauración de archivos eliminados mediante `send2trash`.

- **Ajustes y Personalización**:
  - Modal de configuración persistente (<kbd>Ctrl</kbd> + <kbd>,</kbd>) para definir la carpeta raíz de arranque, conmutar temas (Claro / Oscuro / Auto) y alternar efectos de sonido sutiles.

---

## Estructura del Proyecto

```text
├── api.py                           # Puente API entre Python y el entorno WebView
├── app.py                           # Entrada principal del proceso de escritorio
├── config.json                      # Configuración de usuario persistida
├── requirements.txt                 # Dependencias del proyecto
├── Explorador FB.spec               # Configuración de empaquetado con PyInstaller
├── crear_exe.bat                    # Script para compilar el ejecutable
├── services/                        # Servicios modulares de backend
│   ├── document_reader_service.py   # Extracción y lectura de Word, Excel, PPTX, etc.
│   ├── file_explorer_service.py     # Operaciones de sistema de archivos en disco
│   ├── trash_service.py             # Integración con la papelera de Windows
│   └── window_theme.py              # Personalización de barra de título nativa
└── web/                             # Frontend desacoplado (HTML5 / CSS3 / JS Modular)
    ├── index.html                   # Estructura de la aplicación
    ├── style.css                    # Sistema de estilos y variables de tema
    ├── app.js                       # Orquestador de arranque
    └── js/                          # 21 módulos organizados por dominio
        ├── core/                    # Estado global y utilidades
        ├── modals/                  # Modales (Ajustes, Búsqueda, Propiedades)
        ├── ui/                      # Controles, menús contextuales y árbol
        └── views/                   # Vistas de contenido, visor y favoritos
```

---

## Requisitos del Sistema

- **Sistema Operativo**: Windows 10 / Windows 11 (64 bits).
- **Entorno WebView**: Microsoft Edge WebView2 Runtime (preinstalado en Windows 10/11).
- **Python**: Versión 3.10 o superior (para ejecución o desarrollo desde código fuente).

---

## Instalación y Ejecución Local

1. **Clonar el repositorio**:
   ```powershell
   git clone https://github.com/tu-usuario/explorador-fb.git
   cd explorador-fb
   ```

2. **Crear y activar un entorno virtual**:
   ```powershell
   python -m venv .venv
   .\.venv\Scripts\Activate.ps1
   ```

3. **Instalar dependencias**:
   ```powershell
   pip install -r requirements.txt
   ```

4. **Lanzar la aplicación**:
   ```powershell
   python app.py
   ```

---

## Compilación del Ejecutable Autónomo

Para generar la versión portable distribuible para Windows:

```powershell
.\crear_exe.bat
```

El ejecutable resultante se encontrará ubicado en `dist\Explorador FB\Explorador FB.exe`.

---

## Atajos de Teclado Principales

| Atajo | Acción |
| :--- | :--- |
| <kbd>Ctrl</kbd> + <kbd>,</kbd> | Abrir panel de Ajustes |
| <kbd>Ctrl</kbd> + <kbd>P</kbd> | Búsqueda rápida de archivos en disco |
| <kbd>Ctrl</kbd> + <kbd>T</kbd> | Abrir nueva pestaña |
| <kbd>Ctrl</kbd> + <kbd>W</kbd> | Cerrar pestaña activa |
| <kbd>Ctrl</kbd> + <kbd>S</kbd> | Guardar archivo en edición activa |
| <kbd>Ctrl</kbd> + <kbd>B</kbd> | Colapsar o expandir barra lateral |
| <kbd>F5</kbd> | Actualizar árbol y directorio actual |
| <kbd>Escape</kbd> | Cerrar modales, menús contextuales o cancelar edición |

---

## Licencia

Este proyecto está bajo la Licencia MIT. Consulta el archivo `LICENSE` para más información.

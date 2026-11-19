# RG Cubos

Juego 3D de mundo de bloques para Android (Three.js + Capacitor).

## Compilar el APK en GitHub
1. Crea un repositorio nuevo en GitHub (por ejemplo `rg-cubos`).
2. Sube todo el contenido de esta carpeta (incluida la carpeta oculta `.github`).
3. Ve a la pestaña **Actions** → "Compilar APK". Se ejecuta solo con cada cambio en `main` (o usa "Run workflow").
4. Al terminar (unos 5 min), abre la ejecución y descarga **RG-Cubos-apk** en "Artifacts". Dentro está `app-debug.apk`.
5. Instálalo en el celular (permitir "orígenes desconocidos").

## Probar en el navegador
Sirve la carpeta `www` con cualquier servidor local, por ejemplo `npx serve www`.

## Archivos
- `www/index.html` – interfaz y controles
- `www/game.js` – motor del juego (mundo, física, bloques, guardado)
- `www/three.module.js` – librería Three.js r170

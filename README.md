# SIGCR Demo (SPA sin backend)

Prototipo web **listo para GitHub + Netlify** que simula un *Sistema Integrado de Gestión de Campañas y Recursos*.

- **Sin base de datos**: persistencia local con `localStorage`.
- **UX cuidada**: UI moderna, animaciones, panel con sidebar + topbar, modales, toasts.
- **Tiempo real (demo)**: simulación de KPIs, integraciones y ETL cada ~5s.
- **RBAC**: roles (Admin, Supervisor, Analista, Operador) con permisos por módulo.
- **Módulos**: Dashboard, Campañas, Recursos, Integraciones, Data Hub, Calidad, Incidentes, Reportes, Seguridad, Arquitectura.

---

## Credenciales (demo)

> Contraseña para todos: **Fortel2025!**

- **Admin:** `admin@demo.com`
- **Supervisor:** `supervisor@demo.com`
- **Analista:** `analista@demo.com`
- **Operador:** `operador@demo.com`

---

## Cómo ejecutar local (opcional)

Por ser un proyecto estático, basta con servirlo con cualquier servidor.

Ejemplos:

### Opción A) VS Code Live Server
1. Abre la carpeta del proyecto.
2. Click derecho en `index.html` → **Open with Live Server**.

### Opción B) Python
```bash
python -m http.server 5173
```
Luego abre `http://localhost:5173`.

> Evita abrir el HTML con doble click (file://) si tu navegador bloquea módulos ES.

---

## Deploy en Netlify

### Método 1: “Drag & Drop”
1. En Netlify → **Add new site** → **Deploy manually**.
2. Arrastra la carpeta del proyecto (o un `.zip`) tal cual.
3. Listo.

### Método 2: Desde GitHub (recomendado)
1. Sube este proyecto a GitHub.
2. En Netlify → **Add new site** → **Import an existing project**.
3. Selecciona el repo.
4. Configuración:
   - **Build command:** *(vacío)*
   - **Publish directory:** `.`

El proyecto incluye `netlify.toml` con redirect a `index.html`.

---

## Notas importantes (para tu expo)

- Todo se guarda en el navegador (localStorage).  
  Si quieres “reiniciar” a estado inicial:
  - Entra como **Admin** → módulo **Seguridad** → **Restablecer demo**.

- “Tiempo real” se puede pausar en la barra superior (Topbar).

---

## Estructura

- `index.html` → Shell de la SPA
- `styles.css` → UI/UX
- `js/`
  - `app.js` → arranque, listeners globales
  - `router.js` → rutas `#/`
  - `state.js` → estado, persistencia, RBAC, CRUD, auditoría
  - `simulator.js` → simulación de KPIs/ETL/Integraciones
  - `pages/` → módulos del sistema
  - `components/` → sidebar, topbar, charts
  - `lib/icons.js` → iconos SVG inline
- `assets/` → logo, favicon, etc.

---

## Personalización rápida

- Cambia nombre/logo: `assets/logo.svg`
- Cambia datos semilla: `js/state.js` (función `seedDB()`)
- Colores/tema: `styles.css` (variables CSS en `:root`)

---

## Licencia
Uso académico / demo.

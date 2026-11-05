# GiraFest

React + Vite + Firebase (Firestore). Animaciones con CSS, confeti con canvas-confetti.

## 1. Crear la base de datos (gratis)
1. Entra a https://console.firebase.google.com y crea un proyecto.
2. En el proyecto: Build > Firestore Database > Crear base de datos (modo producción, cualquier región).
3. Pestaña Reglas: pega el contenido de `firestore.rules` y publica.
4. Configuración del proyecto (engranaje) > Tus apps > icono web `</>` > registra la app y copia los datos de `firebaseConfig`.

## 2. Configurar
Copia `.env.example` a `.env` y llena los valores (apiKey, authDomain, projectId, appId).
`VITE_ADMIN_PIN` es el PIN con el que entras como organizadora (botón 🔒 al final de la página).

## 3. Correr
    npm install   # instala también 'qrcode' para el código QR
    npm run dev

## 4. Publicar (link para todos)
Opción fácil: sube la carpeta a GitHub y conéctala en https://vercel.com o https://netlify.com.
Comando de build: `npm run build`, carpeta de salida: `dist`.
Agrega las mismas variables del `.env` en el panel del hosting.

## Notas
- El PIN y las reglas son simples (pensado para un grupo de confianza). Cualquiera con conocimientos técnicos podría saltárselos.
- Para "una sola vez por persona" la app marca el nombre en la base de datos y recuerda el navegador. Si alguien pierde su sesión, usa "Liberar" en el Panel.
- Diseños y colores: objeto `THEMES` al inicio de `src/main.jsx`.

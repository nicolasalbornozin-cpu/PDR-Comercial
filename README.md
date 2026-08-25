# PDR Comercial

Primera versión completa de la aplicación móvil comercial de Parque del Recuerdo. Está pensada para que ejecutivos y equipos consulten rápidamente ventas en UF, mora, productividad por negocios, Salesforce, rankings, metas, noticias, eventos y reconocimientos desde una experiencia móvil premium.

## Estado del MVP

- Autenticación real preparada para Supabase y modo demostración cuando no hay credenciales.
- Login, registro y cierre de sesión.
- Perfil Ejecutivo con venta acumulada, indicadores, metas y actividad reciente.
- Detalle completo de Mis metas, incluyendo productividad medida en negocios y semáforo de mora.
- Ranking Global interactivo para vendedores, equipos y jefaturas, con filtros por competencias de períodos configurables.
- Noticias, detalle de artículos y galería fotográfica navegable.
- Perfil administrativo y centro de notificaciones.
- Datos demostrativos centralizados y contrato de servicio listo para sustituirlos por API, Supabase o importadores Excel.

## Tecnologías

- React Native 0.86
- Expo SDK 57
- TypeScript estricto
- Expo Router
- Supabase Auth opcional
- React Native Web para validación y vista previa

## Instalación

Requiere Node.js LTS y npm.

```bash
npm install
```

## Ejecución

```bash
npx expo start
```

Luego puedes abrir el proyecto en Expo Go, un simulador iOS, un emulador Android o el navegador. También existen comandos directos:

```bash
npm run android
npm run ios
npm run web
```

En modo demostración el formulario de acceso viene precargado. Cualquier correo y contraseña no vacíos permiten navegar por el MVP.

## Variables de entorno

Copia `.env.example` a `.env` y completa las variables solamente cuando exista un proyecto Supabase:

```dotenv
EXPO_PUBLIC_SUPABASE_URL=
EXPO_PUBLIC_SUPABASE_ANON_KEY=
```

Si ambas están vacías, la aplicación activa automáticamente el modo demostración. No se incluyen secretos en el repositorio.

## Estructura

```text
app/                  Rutas y pantallas con Expo Router
assets/               Fotografías, iconos y recursos locales
src/components/       Sistema de componentes reutilizables
src/context/          Estado global de autenticación
src/data/             Datos mock y registro central de assets
src/hooks/            Hooks compartidos
src/services/         Supabase, autenticación y contrato comercial
src/theme/            Colores, tipografía, espaciado y sombras
src/types/            Modelo de dominio TypeScript
src/utils/            Formateadores y utilidades puras
```

## Calidad

```bash
npm run typecheck
npm run lint
npm run export:web
```

## Próximas integraciones

El contrato `CommercialDataSource` permite incorporar adaptadores para ventas, mora y Salesforce sin reescribir las vistas. Las siguientes etapas contemplan importación real de Excel, persistencia de métricas y reglas avanzadas de competencias.

## Generar un APK Android de prueba con EAS

El proyecto incluye un perfil `preview` en `eas.json` que genera un APK de distribución interna, instalable directamente en un teléfono Android.

1. Crea una cuenta gratuita en [Expo](https://expo.dev/signup).
2. Inicia sesión desde esta carpeta:

```bash
eas login
```

3. Genera el APK:

```bash
npm run build:preview:android
```

En la primera ejecución, EAS puede pedir crear o vincular el proyecto y generar una clave de firma Android. Acepta que Expo administre la clave. Al terminar, EAS mostrará un enlace y un código QR para descargar e instalar el APK.

El perfil `production` queda reservado para generar posteriormente el archivo AAB destinado a Google Play:

```bash
npm run build:production:android
```

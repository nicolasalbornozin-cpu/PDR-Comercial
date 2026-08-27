# PDR Comercial

Primera versión completa de la aplicación móvil comercial de Parque del Recuerdo. Está pensada para que ejecutivos y equipos consulten rápidamente ventas en UF, mora, productividad por negocios, Salesforce, rankings, metas, noticias, eventos y reconocimientos desde una experiencia móvil premium.

## Estado del MVP

- Autenticación real por RUT y contraseña conectada a Supabase, con modo demostración cuando no hay credenciales.
- Cuentas administradas sin autorregistro público y recuperación resuelta por el administrador.
- Paneles separados para vendedor, coordinador, jefe de ventas y administrador.
- Panel administrativo para cuentas, accesos y cargas CSV exportadas desde Excel.
- Fotos publicables de avance comercial, Senior, categorización, Mora/Sauce, Salesforce y ranking.
- Detalle completo de Mis metas, incluyendo productividad medida en negocios y semáforo de mora.
- Ranking Global interactivo para vendedores, equipos y jefaturas, con filtros por competencias de períodos configurables.
- Noticias, detalle de artículos y galería fotográfica navegable.
- Centro de notificaciones y perfil personal.
- Datos demostrativos centralizados como respaldo cuando Supabase no está configurado.

## Tecnologías

- React Native 0.86
- Expo SDK 57
- TypeScript estricto
- Expo Router
- Supabase Auth y PostgreSQL con Row Level Security (RLS)
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

En modo demostración el formulario de acceso viene precargado. Con Supabase configurado, el acceso se realiza con el RUT del trabajador y su contraseña.

## Variables de entorno

Copia `.env.example` a `.env` y completa las variables solamente cuando exista un proyecto Supabase:

```dotenv
EXPO_PUBLIC_SUPABASE_URL=
EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY=
```

La clave `publishable` es la clave pública para clientes móviles; nunca agregues una clave `secret` o `service_role` a la aplicación. Si ambas variables están vacías, la aplicación activa automáticamente el modo demostración. El archivo `.env` local está excluido de Git.

## Base de datos Supabase

El esquema reproducible está en `supabase/migrations/`. Incluye perfiles vinculados a Supabase Auth, jerarquías, lotes de carga, fotos agregadas, metas, rankings, mora, noticias y auditoría administrativa.

- Todas las tablas tienen RLS habilitado.
- Los usuarios anónimos no tienen acceso a las tablas comerciales.
- Cada vendedor solo lee sus datos; coordinadores y jefes ven únicamente su jerarquía; el administrador gestiona el conjunto.
- Los roles nunca se aceptan desde el cliente: las cuentas se crean mediante una Edge Function que comprueba el rol administrador.
- Las funciones de administración usan la clave de servicio únicamente en el servidor; esa clave nunca entra a la app.
- El ranking global comparte solo nombre, equipo, posición y UF, sin RUT ni correo.

El procedimiento y las columnas permitidas para las cargas están en [docs/IMPORTACION_DATOS.md](docs/IMPORTACION_DATOS.md).

Para un proyecto nuevo, vincula Supabase CLI y aplica las migraciones revisadas:

```bash
npx supabase link --project-ref TU_PROJECT_REF
npx supabase db push
```

## Estructura

```text
app/                  Rutas y pantallas con Expo Router
assets/               Fotografías, iconos y recursos locales
src/components/       Sistema de componentes reutilizables
src/context/          Estado global de autenticación
src/data/             Datos mock y registro central de assets
src/hooks/            Hooks compartidos
src/services/         Supabase, autenticación, administración e importación
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

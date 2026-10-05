# Revisión de seguridad y capacidad — 5 de octubre de 2026

## Alcance y resultado

- Base revisada: 321 registros de dotación, 148 trabajadores activos (131 vendedores), 4.013 métricas, 16,6 MB de base y 170 MB de fotografías.
- No se encontraron tablas, columnas ni registros de clientes. La tabla operativa contenía solamente agregados por trabajador y quedó movida al esquema privado.
- Los importadores bloquean encabezados de clientes/contratos y publican únicamente métricas agregadas por trabajador. Las hojas crudas del Excel no se transmiten.
- `Ranking Plataforma.xlsx` se carga una sola vez: lee Ranking Anual Total, Ranking Anual, el Ranking del mes vigente y su hoja Emitido. El nombre del mes puede cambiar de septiembre a octubre, noviembre u otro mes en español.
- Las fotografías de Noticias pasan a un bucket privado y la aplicación usa enlaces firmados de diez minutos, disponibles solo para personal vigente.
- Se agregó una lista cerrada de campos admitidos a `sheet_metrics` y a las reglas de metas. Una escritura directa con campos desconocidos o estructuras anidadas queda rechazada por la base.
- Las noticias y fotografías quedan protegidas además por estado laboral y dotación vigente. Al cerrar sesión se eliminan las cachés de textos y enlaces firmados.
- No hay archivos Excel, `.env`, certificados ni claves privadas versionados en Git. La clave administrativa de Supabase continúa solo en las funciones del servidor.

## Dependencias

Se repararon las alertas compatibles de `decode-uri-component`, `js-yaml`, `brace-expansion` y `uuid`. El análisis de producción no reporta vulnerabilidades críticas. Permanecen alertas propagadas por herramientas internas de Expo/Metro (`braces` y `node-forge`) para las que aún no existe una versión corregida compatible; forzar la reparación sugerida por npm degradaría Expo y React Native a versiones incompatibles.

PostgreSQL del proyecto está en 17.6. Supabase ofrece 17.11 con correcciones de seguridad, pero el cambio requiere una ventana de mantenimiento y no se aplicó automáticamente.

## Capacidad estimada

Con la carga actual, 100 a 150 personas conectadas simultáneamente es un rango prudente de planificación para el plan Free. No es una garantía ni sustituye una prueba de carga. El límite público más cercano es de 200 conexiones Realtime simultáneas; 50.000 MAU es una cuota mensual, no 50.000 personas concurrentes.

El primer cuello de botella esperado no es la tabla de métricas, sino las fotografías: hoy promedian cerca de 2,93 MB. Cien personas viendo veinte fotografías en un mes pueden transferir aproximadamente 5,86 GB antes de considerar caché, por lo que conviene comprimir nuevas imágenes a WebP/JPEG y mantenerlas cerca de 300–700 KB.

## Riesgos aceptados o pendientes

- El registro inicial solo con RUT y contraseña permite que quien conozca un RUT vigente intente registrar primero una cuenta ajena. Este funcionamiento fue aceptado expresamente; la mitigación recomendada sigue siendo un código inicial entregado por la empresa.
- La sesión móvil se guarda mediante el almacenamiento estándar de React Native. Una futura versión nativa debería migrarla a almacenamiento cifrado del dispositivo.
- El contenido libre que un administrador publique en Noticias podría incluir información personal. Los controles técnicos evitan datos de clientes en las cargas comerciales, pero no pueden determinar el contenido visual o textual de una fotografía/noticia.
- Antes de ampliar significativamente la dotación o usar Noticias como galería masiva, se recomienda una prueba de carga en un entorno de prueba y revisar consumo real de egreso.

Fuentes de límites y controles: [Supabase Pricing](https://supabase.com/pricing), [Supabase Performance](https://supabase.com/docs/guides/platform/performance), [Row Level Security](https://supabase.com/docs/guides/database/postgres/row-level-security), [Storage privado y URLs firmadas](https://supabase.com/docs/guides/storage/buckets/fundamentals).

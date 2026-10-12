# Operación y seguridad — versión 1.2.0

## Publicar archivos

Dotación define acceso y jerarquías. Mantener RUT y contraseña y las excepciones autorizadas. El archivo original se procesa en el dispositivo; solo se envían campos permitidos y métricas agregadas, sin contratos ni clientes. Los nombres de dotación son dos apellidos seguidos de nombres; la presentación utiliza primer nombre y primer apellido.

Catego y Senior tienen cargas independientes Anterior y Vigente. La migración 20261012110705 asigna las cargas existentes a Anterior sin borrar datos. Se rechazan períodos solapados. Una nueva carga de estos orígenes conserva el archivo procesado anterior; el panel consulta solamente los dos períodos seleccionados.

Los demás orígenes conservan únicamente su última publicación a partir del próximo reemplazo exitoso. Mensual y anual son orígenes distintos. La transacción valida todas las filas, cambia el puntero y elimina los datos reemplazados; si falla se revierte todo. Dotación mantiene identidades referenciadas y estados de acceso; elimina los antiguos payloads de importación después de publicar. Conservar los Excel originales en un repositorio corporativo restringido si se requiere recuperación histórica.

## Sesiones y despliegue

Android/iOS usan SecureStore del sistema, con migración de la sesión de AsyncStorage. Los fragmentos se escriben antes del manifiesto; fallos de escritura no reemplazan una sesión válida. En web se usa sessionStorage, se elimina la sesión persistente anterior y cerrar la pestaña requiere iniciar sesión nuevamente. sessionStorage sigue siendo accesible a JavaScript: no reemplaza las defensas contra XSS.

La versión 1.2.0 requiere un binario nuevo con expo-secure-store y expo-crypto. No publicar este código mediante OTA al runtime Android 1.1.0. La validación en un dispositivo físico sigue siendo necesaria: actualizar APK, iniciar sesión, cerrar/abrir app, renovar sesión y cerrar sesión.

## Dependencias

Al 12-10-2026, braces 3.0.3 y node-forge 1.4.0 no tienen versiones corregidas en npm para GHSA-vfj7-8cjw-p6xm y GHSA-86w9-cpqp-85rv. Se incluyen mitigaciones locales de alcance limitado: profundidad/tamaño de AST antes de recorridos recursivos y validación estricta del número de elementos DigestAlgorithm RSA. No son versiones oficiales corregidas ni una garantía general.

`npm ci` ejecuta `scripts/apply-security-patches.cjs`. Este verifica versión y hashes de cada copia instalada y falla si cambia el código esperado. No usar `--ignore-scripts` sin ejecutar después `npm run security:verify`. El verificador es idempotente. No se modifican versiones para esconder avisos: `npm audit` continuará informando las dependencias afectadas. Revisar y retirar los parches cuando existan versiones oficiales adecuadas.

Fuentes: https://github.com/advisories/GHSA-vfj7-8cjw-p6xm y https://github.com/advisories/GHSA-86w9-cpqp-85rv.

## Respaldo y recuperación — pendiente de habilitar

No hay un respaldo externo configurado ni una restauración validada todavía. La elección del almacenamiento y la conexión administrativa deben completarse antes de considerar cerrado este punto. Nunca guardar volcados, contraseñas o claves en este repositorio público.

Procedimiento para TI:

1. Definir RPO/RTO, destino corporativo cifrado y responsables de recuperación. La opción gratuita exige ejecutar respaldos externos; verificar las condiciones vigentes de Supabase.
2. Configurar credenciales de conexión en un gestor de secretos o archivo pgpass restringido, con TLS. Exportar esquema, roles y datos según la guía oficial; respaldar separadamente los objetos de Storage. Un volcado de PostgreSQL no contiene los archivos del bucket.
3. Cifrar antes del traslado, verificar integridad y probar descifrado; preservar la clave en un destino separado. Rotar respaldos solamente después de verificar el nuevo.
4. Restaurar en un proyecto aislado, nunca sobre producción como prueba. Comprobar conteos por origen, punteros, dotación, archivos, RLS y login. Ejecutar las pruebas SQL de este repositorio; registrar duración y resultado.
5. Programar frecuencia y retención aprobadas y alertas de fallo. Revisar regularmente la restauración, no solo la existencia del archivo.

Guías: https://supabase.com/docs/guides/platform/backups y https://supabase.com/docs/guides/platform/migrating-within-supabase/backup-restore.

## Evidencia y límites

Las pruebas SQL `current_session_and_ranking.sql` y `upload_retention_and_slots.sql` usan datos sintéticos y terminan con ROLLBACK. Cubren autorización, aislamiento por equipo, baja de acceso, ranking sin RUT, reemplazo y conservación de carga ante fallo. Ejecutarlas en un entorno de prueba antes de futuros cambios. La segunda requiere la migración de slots.

El test local de dashboard verifica paginación con 1.000 ejecutivos y 50 cálculos concurrentes. No representa 50 conexiones de producción ni certifica capacidad de Supabase. Falta una prueba de carga de red/base de datos en un entorno aislado, con latencia, errores y consumo registrados.

Ante un incidente: restringir acceso del usuario afectado en los controles de registro/dotación, revocar sus sesiones, preservar logs en un destino restringido, evaluar alcance con TI, rotar solo las credenciales comprometidas y restaurar desde copia comprobada cuando corresponda. Verificar denegación desde una sesión ya emitida antes de cerrar el incidente.

El registro por RUT permite comprobar pertenencia, pero no prueba identidad. Se mantiene por decisión del responsable. La revisión legal, la auditoría de TI y el saneamiento de identificadores en el historial público siguen siendo tareas separadas.

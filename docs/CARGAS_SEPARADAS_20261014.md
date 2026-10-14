# Cargas separadas y control de acceso

## Archivos para Administrar → Actualizar datos

| Destino | Hojas que se leen |
| --- | --- |
| Catego vigente | Carga catego |
| Catego anterior | Carga catego |
| Carga Senior vigente | Carga Senior |
| Carga Senior anterior | Carga Senior |
| Dotación | Dotacion, Dotación o DOTACION VIG |
| Producción | produccion vendedores y produccion coordinadores; se conservan los alias anteriores Resumen vendedores/Resumen coordinadores |
| Mora por jefatura | Carga Titanes, Carga RBH o Carga MSC, un archivo por jefatura |
| Sauce | Carga Sauce; se conserva el alias Ranking Sauce Riesgo |
| Ranking Plataforma.xlsx | Ranking anual total, Ranking anual Emitido, Ranking mensual, Ranking mensual emitido y anulaciones |

Las cuatro cargas de metas tienen destinos independientes. Reemplazar la anterior no cambia la vigente, ni viceversa. Incluso si el archivo contiene el libro completo, para Senior y Catego solo se procesa su hoja de carga. No se importan CANTO, TRIO o resúmenes auxiliares desde ese archivo. El Excel debe estar guardado con los resultados de sus fórmulas calculados; una fórmula sin resultado se rechaza.

No se solicitan fechas comerciales ni el nombre del período durante la carga. Las fechas internas registran la publicación, no definen cierres comerciales. El nombre inicial de Senior/Catego se puede reconocer desde el nombre del archivo. El administrador puede editar, con el lápiz, el nombre del ranking mensual y de cada meta vigente/anterior. Estos cinco nombres se almacenan en Supabase y son compartidos por todos. Solo el administrador puede modificarlos.

El ranking utiliza los resultados calculados de las hojas de total, con las anulaciones que ya haya descontado el Excel: la app no vuelve a restarlas. El emitido proviene de las hojas correspondientes, sin recalcular estados desde hojas de ventas crudas. Se conservan los nombres mensuales antiguos, como Ranking Octubre, para los libros completos existentes. Las futuras cargas de cinco hojas pueden usar los nombres genéricos sin mes.

## Dotación y CURSO

Dotación es la fuente de identidad, estado laboral y relaciones vendedor → coordinador → jefe. Un archivo financiero no crea trabajadores ni habilita cuentas. Las coincidencias ambiguas se rechazan; las filas sin identidad de dotación se omiten y se informan al administrador.

- VIGENTE permite el acceso, sujeto a la cuenta y a los bloqueos manuales del administrador.
- CURSO se conserva con `status=course` y `active=false`. No permite registro, activación ni acceso con una sesión existente. La restricción de base de datos impide marcar CURSO como activo.
- Las ventas de CURSO contribuyen exclusivamente a los rankings y totales agregados de su equipo/unidad/canal. No se exponen sus fichas ni métricas individuales a coordinadores o jefes. El ranking individual de vendedores sigue limitado a VIGENTE.
- Licencia, vacaciones, finiquito y ausencia de la nómina siguen bloqueando el acceso. Se conservan las tres excepciones autorizadas y los administradores; CURSO no es una excepción.
- Al actualizar la misma persona a VIGENTE, conserva su identificador y sus ventas. No se altera su contraseña ni se levanta un bloqueo manual de cuenta.

Los totales del inicio y el ranking de equipos comparten la misma población de vendedores VIGENTE + CURSO. El contador de ejecutivos del ranking cuenta esa población de vendedores, no el número de filas de coordinadores/jefes. El carrusel verde alterna anual/mensual; cada página separa total bruto y emitido. Vendedor: propios; coordinador: equipo; jefe: unidad; roles superiores y administrador: canal.

## Anulaciones y días sin vender

Las hojas anual total, anual emitido, mensual, mensual emitido y anulaciones se publican juntas en una transacción: no se deja un ranking con una mitad de la carga nueva y otra antigua.

La fuente de anulaciones anuales es la hoja `anulaciones` de Ranking Plataforma. Se usa su columna de mes/año de cálculo para seleccionar el año de la carga. La fecha de última venta procede de su tabla Ejecutivo/Última venta; no se publican datos de clientes. Si la misma identidad tiene un fragmento de anulaciones y otro solo de fecha, se consolidan. Dos totales financieros no nulos para la misma identidad se rechazan en lugar de sumarlos silenciosamente.

Se considera sin venta mensual a un vendedor cuyo total UF mensual es exactamente cero. Sus días se calculan con la fecha de última venta y el día actual en Chile. Una fecha desconocida se muestra como desconocida, no como cero días. La vista de equipo muestra la suma de días de sus personas sin venta mensual y la cantidad de personas; el detalle respeta la jerarquía jefe → coordinador → vendedores.

## Privacidad y verificación

Los originales no se modifican ni se guardan en Supabase o en GitHub. El procesamiento es local: solo se transmiten identidades de trabajadores, jerarquías y métricas agregadas permitidas. No se publican nombres/RUT/contactos de clientes, contratos, operaciones ni observaciones libres. Los conteos de contratos en mora se agregan por trabajador; las UF del grupo 0–8% permanecen como un solo total.

Las comprobaciones de permisos ocurren en Supabase, no solo en la interfaz. `sales_scope_totals` verifica sesión habilitada y el alcance real del usuario; únicamente el administrador puede elegir otro usuario como destino. No se concedió acceso anónimo ni se relajó el registro por RUT para CURSO. Los eventos de actualización solo notifican nombres y punteros de cargas, no documentos originales.

Pruebas reproducibles:

- `scripts/test-dotacion.cjs`: formatos, CURSO, estados bloqueados, relaciones y minimización.
- `scripts/test-upload-contracts.cjs`: cinco hojas del ranking, anulaciones anuales, consolidación, etiquetas y cero mensual.
- `scripts/test-individual-dashboard.cjs`: alcance por rol, rechazo de CURSO y slots independientes.
- `supabase/tests/course_ranking_access.sql`: transacción con rollback; ventas CURSO incluidas, registro/sesión/datos bloqueados.
- `supabase/tests/goal_slots_and_settings.sql`: transacción con rollback; metas independientes, nombres protegidos y datos mínimos.

Estas pruebas no sustituyen una auditoría externa ni garantizan ausencia absoluta de vulnerabilidades. La revisión visual en un teléfono y la revisión de requisitos internos de la empresa siguen siendo necesarias.

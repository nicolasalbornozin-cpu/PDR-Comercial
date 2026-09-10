# Actualizar indicadores por hoja

En Administración → Cargas, selecciona el origen, escribe el período y sus fechas, elige el Excel y revisa las validaciones antes de publicar. Se reemplaza únicamente la versión visible de ese origen; las demás cargas y el historial se conservan. No se envían contratos ni datos de clientes, solamente indicadores agregados por trabajador.

| Origen | Hoja que se lee |
| --- | --- |
| Catego | Carga Catego |
| Producción vendedores | Resumen Vendedores |
| Producción coordinadores | Resumen Coordinadores |
| Senior y anulaciones | CARGA Senior |
| TITANES · Manuel Olmedo | Carga Titanes |
| RBH · Rodolfo | Carga RBH |
| MSC · Mauricio | Carga MSC |
| Riesgo Sauce | Ranking Sauce Riesgo |
| Ranking mensual emitido | Ranking mensual |
| Ranking anual emitido | Ranking anual |

Guarda el Excel después de recalcularlo: la app importa sus resultados, no ejecuta fórmulas. Conserva encabezados y columnas. Un error numérico obligatorio bloquea la carga; datos opcionales con errores se muestran como pendientes, nunca como cero. Los nombres sin RUT deben coincidir de forma única con la nómina.

Senior abierto utiliza el resultado neto de CARGA Senior. Para cerrar, recalcula el Excel con ventas emitidas y marca la confirmación de cierre antes de elegir el archivo. Al vencer el período, una carga abierta no se convierte automáticamente en emisión certificada: queda pendiente de cargar el cierre. Anulaciones se toma del encabezado Anulaciones de CARGA Senior; no del Excel separado.

Los rankings y UF anuales/mensuales proceden de las hojas de ranking emitido. Productividad conserva el cálculo del Excel de Producción. Riesgo Sauce y mora no son intercambiables. El grupo 0–8% es un único total. La nómina determina las personas vigentes y su jerarquía; no crea cuentas de acceso ni contraseñas.

En Perfil → Ver como, el administrador selecciona cargo y escribe al menos dos letras; aparecen hasta ocho coincidencias. La sesión sigue siendo administrativa, pero la vista queda limitada al trabajador o equipo seleccionado.

## Verificación técnica

Pruebas: `node scripts/test-individual-parser.cjs`, `node scripts/test-individual-dashboard.cjs`, `npx tsc --noEmit`. Prueba transaccional de acceso: `supabase/tests/independent_access.sql` (ajustar el identificador del administrador para otro entorno; todos los cambios de prueba se revierten).

Se verificaron las diez cargas iniciales, por identidad, indicadores y fila de origen, sin diferencias. La migración independiente y la de optimización de políticas se aplicaron y registraron en el proyecto antes de publicar la app. No ejecutar de nuevo la carga inicial privada ni aplicar migraciones históricas pendientes sin revisar sus efectos.

Advisor: se corrigieron las políticas SELECT duplicadas del nuevo módulo. Avisos preexistentes: protección contra contraseñas filtradas desactivada, función heredada ranking_leaderboard con ejecución definer autenticada y recomendaciones de índices. La app nueva utiliza individual_sheet_ranking, cuyo acceso por cargo fue probado; no se cambiaron silenciosamente funciones antiguas ni opciones de contratación del proyecto.

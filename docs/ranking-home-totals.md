# Ranking e Inicio: dos medidas distintas

La carga de `Ranking Plataforma.xlsx` sigue siendo única y atómica: ranking
anual, ranking mensual y anulaciones/última venta se publican juntos.

## Totales anuales de Inicio

Dentro de `Ranking anual total`, el lector reconoce las tablas tituladas
`Jefes` y `Coordinadores`, con los encabezados `Bruto` y `Emitido` en la fila
siguiente. No depende de una columna fija. Lee únicamente nombres y resultados
numéricos guardados; una fórmula sin resultado o un error de Excel bloquea la
carga. No se envían hojas originales, fórmulas ni datos de clientes.

Estos valores se publican como `homeAnnualGrossUf` y `homeAnnualEmittedUf`,
separados de `totalUf` y `emittedUf` del ranking. No se vuelven a descontar
anulaciones. La unión por nombre exige una identidad única; nunca modifica
el rol, vigencia o acceso que determina Dotación. Un coordinador histórico
que hoy tiene otro rol conserva esa métrica, pero no se convierte por ello
en coordinador.

Inicio utiliza la fila del coordinador o jefe correspondiente. La tabla Jefes
también puede incluir la identidad ya habilitada del gerente. Si está presente,
esa fila define el total del canal para Administrador, jefe comercial y gerente:
no se vuelve a sumar con las jefaturas, incluso si difiere de su suma por incluir
historia de jefaturas anteriores. Sin fila de gerente se utiliza una fila de jefe
comercial si existe; sin ambas se conserva la suma de jefaturas una sola vez. Los valores
mensuales y los vendedores conservan su cálculo anterior. Si una carga no
incluye la tabla o falta una fila, se recurre a la suma del ranking, sin
recuperar un total antiguo de una carga anterior.

## Modos del ranking

`individual_sheet_ranking_v2` ofrece `executives` y `teams` en ambos períodos.
El ranking conserva exactamente sus UF del Excel, incluidas sus anulaciones.

- Ejecutivo: ranking general de vendedores vigentes y equipos agregados.
- Coordinador: detalle de sus propios vendedores; comparación de equipos.
- Jefe de ventas: vendedores y equipos de su jefatura.
- Administrador, jefe comercial y gerente: comparación del canal completo.

Los agregados de equipos incluyen ventas de CURSO, pero esto no les habilita
acceso. Ninguna respuesta del ranking contiene RUT ni identificadores internos
de dotación: solo UUID opacos. Se comprueba la sesión y el destino de cualquier
vista previa en el servidor. El endpoint anterior se mantiene compatible.

Los nombres comerciales están en `commercial_workers.team_name`, protegidos
por las políticas existentes y conservados al actualizar Dotación. No se
incluyen datos personales de la nómina en migraciones del repositorio. Un equipo
sin nombre confirmado se identifica como tal, no con un nombre inventado.

Pruebas: `scripts/test-ranking-home-totals.cjs` y
`supabase/tests/ranking_home_totals_and_modes.sql` (siempre termina en rollback).

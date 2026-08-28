# Importación segura de datos comerciales

## Flujo habitual

1. Mantener el Excel original dentro del entorno corporativo.
2. En la app, entrar con el perfil administrador y abrir **Administrar → Cargas**.
3. Elegir el tipo de foto, indicar el período y seleccionar el archivo **Excel (.xlsx/.xls)** o **CSV UTF-8**.
4. Si es un Excel, confirmar la hoja resumen detectada por la app.
5. Revisar la cantidad de trabajadores, las columnas descartadas y cualquier error.
6. Publicar. La nueva foto queda visible para los perfiles autorizados.

El archivo original se procesa en el dispositivo y no se almacena ni se envía completo a Supabase. La base solo recibe el identificador interno del trabajador y los totales autorizados. El límite por Excel es de 20 MB para proteger la memoria del teléfono.

En los archivos originales de Sauce, la app puede contar localmente los clientes en mora usando las hojas de detalle. Los identificadores de esos clientes se descartan antes de publicar y nunca forman parte de la carga.

## Datos que nunca deben incluirse

- Nombre, RUT, correo, teléfono o dirección de clientes.
- Número de contrato, póliza, sepultura o identificador de negocio de un cliente.
- Detalle de cuotas, fechas de pago, deuda individual o motivo de mora.
- Observaciones comerciales libres que puedan identificar a una persona.
- Cualquier valor individual de un cliente, aunque su columna no tenga un nombre evidente.

En CSV, el importador bloquea la carga si encuentra columnas desconocidas. En Excel, solo ofrece hojas resumen seguras, descarta columnas administrativas no necesarias y bloquea las hojas que contengan encabezados de clientes, contratos, cuotas o pagos.

## Columnas generales

El identificador recomendado es `rut`, `rut_trabajador`, `rut_vendedor` o `rut_agente`. El RUT puede venir con o sin puntos y guion.

Si una hoja resumen oficial no contiene RUT, la app puede asociar `nombre`, `nombre_trabajador`, `nombre_vendedor`, `nombre_agente`, `vendedor` o `ejecutivo` con una cuenta activa. El nombre debe coincidir de forma única; si hay dos personas iguales o no existe la cuenta, la publicación se bloquea y solicita agregar/corregir el RUT.

## Fotos aceptadas

### Avance comercial

Columnas permitidas:

```text
rut;produccion_uf;produccion_bruta_uf;sepultura_uf;ssff_uf;cinerario_uf;ssaa_uf;emitido_uf;no_emitido_uf;no_subido_uf;cantidad_negocios
```

Solo `rut` y al menos un total son obligatorios.

### Senior

Columnas permitidas:

```text
rut;total_trimestre_uf;caidas_uf;total_valido_uf;cantidad_smad;cantidad_resto;cantidad_ssff;antiguedad_meses;nivel_senior;premio_estimado_clp
```

`nivel_senior` y `premio_estimado_clp` pueden venir calculados desde la planilla oficial. Las reglas de tramos también quedan versionadas en Supabase para auditoría.

### Categorización

Columnas permitidas:

```text
rut;produccion_uf;cantidad_smad;categoria;premio_estimado_clp
```

### Mora / Sauce

Columnas permitidas:

```text
rut;clientes_mora;porcentaje_mora
```

`clientes_mora` es la cantidad agregada de clientes caídos asociada al trabajador. No se carga ningún cliente individual. `porcentaje_mora` es opcional.

El Excel oficial también reconoce `RUT AGENTE`, `% RIESGO`/`PORC RIESGO` y calcula `clientes_mora` localmente desde las hojas de detalle cuando están disponibles.

### Salesforce

Columnas permitidas:

```text
rut;registros_salesforce
```

### Ranking

Columnas permitidas:

```text
rut;posicion_ranking;produccion_uf
```

El ranking compartido expone únicamente nombre del trabajador, equipo, posición y UF. Nunca expone RUT ni correo a otros vendedores.

## Orden recomendado para crear cuentas

1. Crear al jefe de ventas.
2. Crear al coordinador indicando el RUT del jefe de ventas y el nombre del equipo.
3. Crear a cada vendedor indicando el mismo equipo, el RUT del coordinador y el RUT del jefe de ventas.

Así, cada vendedor ve sus datos; el coordinador ve sus vendedores; el jefe de ventas ve sus coordinadores y vendedores; el administrador puede gestionar todo.

## Reglas de privacidad operativa

- Usar períodos explícitos en formato `AAAA-MM-DD`.
- Conservar el Excel original fuera de la aplicación.
- Verificar que la hoja sugerida corresponda al resumen esperado antes de publicar.
- Revisar el número de filas válidas antes de publicar.
- No reutilizar contraseñas entre trabajadores.
- Desactivar una cuenta apenas una persona deje de requerir acceso.
- Registrar como incidencia cualquier carga rechazada por columnas desconocidas en vez de intentar renombrar datos sensibles.

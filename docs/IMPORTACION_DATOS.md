# Importación segura de datos comerciales

## Flujo habitual

1. Mantener el Excel original dentro del entorno corporativo.
2. Crear una hoja auxiliar que contenga solo una fila por trabajador.
3. Exportar esa hoja como **CSV UTF-8**.
4. En la app, entrar con el perfil administrador y abrir **Administrar → Cargas**.
5. Elegir el tipo de foto, indicar el período, seleccionar el CSV y revisar la validación.
6. Publicar. La nueva foto queda visible para los perfiles autorizados; la foto anterior del mismo tipo y período queda reemplazada.

El archivo original se procesa en el dispositivo y no se almacena en Supabase. La base solo recibe el identificador interno del trabajador y los totales autorizados.

## Datos que nunca deben incluirse

- Nombre, RUT, correo, teléfono o dirección de clientes.
- Número de contrato, póliza, sepultura o identificador de negocio de un cliente.
- Detalle de cuotas, fechas de pago, deuda individual o motivo de mora.
- Observaciones comerciales libres que puedan identificar a una persona.
- Cualquier columna distinta de las indicadas abajo.

El importador bloquea la carga completa si encuentra una columna desconocida.

## Columnas generales

Todos los archivos requieren `rut`. Se acepta también `rut_trabajador`. El RUT puede venir con o sin puntos y guion.

`nombre`, `nombre_trabajador` o `vendedor` son opcionales y se usan solo para revisar visualmente la hoja: no se guardan en la foto porque el nombre ya pertenece a la cuenta.

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
- Revisar el número de filas válidas antes de publicar.
- No reutilizar contraseñas entre trabajadores.
- Desactivar una cuenta apenas una persona deje de requerir acceso.
- Registrar como incidencia cualquier carga rechazada por columnas desconocidas en vez de intentar renombrar datos sensibles.

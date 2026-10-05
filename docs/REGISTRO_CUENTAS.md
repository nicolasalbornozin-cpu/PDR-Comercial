# Primer acceso por RUT

Flujo: **Primera vez → RUT → crear contraseña → confirmar contraseña → acceso activado → iniciar sesión con RUT y contraseña**. La identidad, nombre y rol ya están asociados al RUT habilitado; la persona solo define su contraseña de primer acceso. La app muestra coincidencia de contraseñas y permite mostrar/ocultar cada campo. La contraseña debe tener al menos 8 caracteres, mayúscula, minúscula y número, y no exceder 72 bytes UTF-8. El símbolo es opcional.

## Dotación y permisos

- Solo `commercial_workers` vigentes (`active=true`, `status=active`) con perfil vendedor, coordinador o jefe de ventas pueden registrarse. Nombre y cargo vienen del servidor.
- Administrar → Cuentas permite buscar en dotación y bloquear/habilitar el registro antes de que exista una cuenta. Habilitar no vuelve vigente a una persona desvinculada, de licencia o vacaciones.
- Audiovisual se habilita expresamente por nombre y RUT desde Administrar. Solo accede a Noticias; nunca puede crear administradores ni modificar roles desde el formulario público.
- Cada RUT tiene una sola cuenta. Registrar de nuevo nunca restablece su contraseña ni reactiva una cuenta bloqueada. Recuperación y desactivación se mantienen en Administrar.

## Seguridad y publicación

**El RUT no verifica identidad.** Sin un código o correo de verificación, alguien que conozca un RUT habilitado podría registrar primero esa cuenta. El diseño solicitado requiere aceptar expresamente ese riesgo antes de habilitarlo en producción. Los límites de intentos y el registro único no evitan esa suplantación inicial.

`register-account` es una función de activación inicial, sin operaciones administrativas. Usa la clave de servicio solo en servidor, valida la dotación mediante RPC exclusivamente de `service_role`, reserva cada RUT durante cinco minutos y vuelve a comprobarlo en el trigger de Auth, dentro de su transacción. Si Auth ya contiene la identidad interna pero el perfil autorizado quedó incompleto, recupera esa misma identidad, establece la contraseña y completa el perfil; nunca reclama un usuario que ya tenga perfil. No guarda ni registra contraseñas en tablas propias o logs.

El cliente utiliza una clave `sb_publishable`, no un JWT. Por eso solo esta función nueva tiene `verify_jwt=false`. **No modificar `admin-users`: mantiene verificación JWT, sesión válida y comprobación de administrador.** El registro general `auth.signUp` permanece deshabilitado; el trigger también rechaza creaciones sin metadatos de aplicación emitidos por el servidor.

La migración `roster_self_registration` crea controles administrativos, reservas privadas, límites por IP/RUT y los RPC correspondientes. Las tablas tienen RLS. Las reservas y el lookup de dotación no son accesibles a `anon` ni `authenticated`.

Pruebas:

```sh
node scripts/test-registration.cjs
```

`supabase/tests/roster_registration.sql` debe ejecutarse dentro de una transacción con la migración y **ROLLBACK**, sin dejar fixtures ni cuentas de prueba. No incluye contraseñas. Verifica perfiles, duplicados, bloqueos, expiración, throttling y privilegios privados.

begin;
-- Operational acknowledgement only; institutional privacy policy still pending.
create table private.condition_versions(version text primary key, document text not null, created_at timestamptz not null default clock_timestamp());
create table private.condition_acceptances(
 user_id uuid not null references public.profiles(id) on delete cascade,
 version text not null references private.condition_versions(version),
 accepted_at timestamptz not null default clock_timestamp(),
 purpose text not null default 'usage_acknowledgement',primary key(user_id,version)
);
alter table private.condition_versions enable row level security;
alter table private.condition_acceptances enable row level security;
revoke all on private.condition_versions,private.condition_acceptances from public,anon,authenticated,service_role;
insert into private.condition_versions(version,document) values('2026-10-08-uso-v1',$document$// One versioned text shared by the app and registration endpoint.
export const CONDITIONS_VERSION = '2026-10-08-uso-v1';
export const platformConditions = [
  { title: 'Uso interno y cifras referenciales', text: 'Esta herramienta permite consultar indicadores comerciales y noticias internas. Los valores dependen de las planillas publicadas y su fecha de actualización, pueden variar por emisión, anulaciones, correcciones y cierres. No sustituyen liquidaciones, documentos oficiales ni decisiones de la empresa. No determinan por sí solos premios, remuneraciones o sanciones.' },
  { title: 'Datos utilizados y finalidad', text: 'Para identificar tu cuenta y mostrar tu avance se usan RUT, nombre, rol, equipo, estado de habilitación, fechas laborales y métricas agregadas de ventas, producción, mora, Senior y categorización. Si se carga tu cumpleaños se usa para el saludo. No se deben cargar nombres, RUT, teléfonos, direcciones ni antecedentes de clientes. El estado de acceso no debe incluir diagnósticos ni causas de licencias.' },
  { title: 'Acceso según cargo', text: 'Cada ejecutivo consulta su detalle. Coordinadores y jefaturas acceden a sus equipos y la dirección al canal autorizado. Los rankings muestran nombres y resultados comerciales comparables a usuarios habilitados. Administración gestiona datos y cuentas; Audiovisual edita exclusivamente noticias. No compartas contraseñas ni redistribuyas datos, capturas o fotografías fuera de las personas autorizadas.' },
  { title: 'Noticias y fotografías', text: 'Quien publique debe contar con autorización para las imágenes y textos, respetar derechos de imagen y no incluir clientes ni documentos con datos personales. La aceptación de estas condiciones no autoriza publicar tu fotografía: esa autorización se gestiona por separado. Puedes solicitar revisión o retiro de contenido al administrador.' },
  { title: 'Consultas, correcciones y derechos', text: 'Ante diferencias o dudas solicita revisión al administrador de la plataforma o a tu jefatura por los canales internos que ya conoces. Puedes solicitar información sobre tus datos, corrección y las demás acciones que correspondan conforme a la legislación aplicable. Estas condiciones no limitan tus derechos ni reemplazan los procedimientos oficiales.' },
  { title: 'Servicios y seguridad', text: 'La herramienta utiliza Supabase para autenticación, almacenamiento y base de datos, y Expo para distribuir actualizaciones. Se aplican controles de acceso y medidas de seguridad; ningún sistema garantiza riesgo cero. Comunica inmediatamente cualquier acceso indebido o filtración al administrador. No publiques claves, contraseñas ni archivos completos con datos de clientes.' },
  { title: 'Información legal pendiente de aprobación', text: 'Este aviso y las condiciones de uso son una versión operativa pendiente de revisión y autorización institucional. No se declara una razón social ni un contacto corporativo sin su autorización. Antes de adopción institucional deben identificarse el responsable del tratamiento, su contacto, la base jurídica, los plazos de conservación, encargados y transferencias de datos, y el procedimiento de derechos e incidentes. Aceptar estas condiciones no equivale a esa aprobación, no es una certificación legal y no constituye una autorización ilimitada para tratar datos.' },
] as const;$document$);
create function private.capture_conditions_acknowledgement() returns trigger
language plpgsql security definer set search_path='' as $$
declare v text;
begin
 select raw_app_meta_data->>'conditions_version' into v from auth.users where id=new.id;
 if v is not null then
  if not exists(select 1 from private.condition_versions where version=v) then raise exception 'Unknown conditions version';end if;
  insert into private.condition_acceptances(user_id,version) values(new.id,v);
 end if;
 return new;
end $$;
revoke all on function private.capture_conditions_acknowledgement() from public,anon,authenticated,service_role;
create trigger profiles_capture_conditions after insert on public.profiles for each row execute function private.capture_conditions_acknowledgement();
-- Legacy bypass endpoint is unused. Current scoped individual_sheet_ranking is unchanged.
revoke all on function public.ranking_leaderboard() from public,anon,authenticated;
-- Empty legacy customer-level tables are outside the aggregate-only upload workflow.
revoke all on public.sales,public.delinquency_records from anon,authenticated;
commit;

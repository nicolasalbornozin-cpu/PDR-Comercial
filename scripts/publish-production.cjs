/* global __dirname */
const { execFileSync, spawnSync } = require('node:child_process');
const { existsSync, mkdtempSync, readFileSync } = require('node:fs');
const path = require('node:path');

const project = path.resolve(__dirname, '..');
const env = { ...process.env, CI: '1', EXPO_NO_DOTENV: '1' };
const sharedFlags = ['--environment', 'production', '--non-interactive'];

function git(...args) {
  return execFileSync('git', args, { cwd: project, encoding: 'utf8' }).trim();
}

function eas(args, json = false) {
  const cli = process.env.PDR_EAS_CLI;
  const npm = process.env.npm_execpath;
  if (!cli && !npm) throw Error('Ejecuta npm run update:production.');
  const command = cli ? [cli] : [npm, 'exec', '--yes', '--package=eas-cli@23.2.0', '--', 'eas'];
  const result = spawnSync(process.execPath, [...command, ...args], {
    cwd: project,
    env,
    encoding: 'utf8',
    stdio: json ? ['ignore', 'pipe', 'inherit'] : 'inherit',
  });
  if (result.error) throw result.error;
  if (result.status !== 0) throw Error(`Falló EAS ${args[0]} (${result.signal ?? result.status}).`);
  if (json) return JSON.parse(result.stdout);
}

let deploymentId;
let androidPublished = false;
try {
  if (git('status', '--porcelain')) throw Error('Guarda los cambios en Git antes de publicar.');
  const commit = git('rev-parse', '--short', 'HEAD');
  const versionFile = readFileSync(path.join(project, 'src/components/AppUpdateStatus.tsx'), 'utf8');
  const revision = versionFile.match(/APP_REVISION\s*=\s*['"]([\d.]+)['"]/)?.[1];
  if (!revision) throw Error('No se encontró la revisión de la aplicación.');

  const output = path.basename(mkdtempSync(path.join(project, 'dist-verification-release-')));
  eas(['env:exec', 'production', `node node_modules/expo/bin/cli export --clear --platform web --output-dir ${output}`, '--non-interactive']);
  const adminPage = path.join(project, output, 'admin.html');
  if (!existsSync(adminPage)) throw Error('Falta el panel administrativo en la exportación web.');
  const entry = readFileSync(adminPage, 'utf8').match(/(_expo\/static\/js\/web\/entry-[a-f0-9]+\.js)/)?.[1];
  if (!entry) throw Error('Falta el código de inicio de la aplicación web.');
  const bundle = readFileSync(path.join(project, output, entry), 'utf8');
  if (!bundle.includes(revision) || !bundle.includes('https://spftdioqguuztrrfmqan.supabase.co') ||
    !bundle.includes('sb_publishable_') || /sb_secret_[\w-]+/.test(bundle)) {
    throw Error('Revisa la revisión y las variables públicas de producción antes de publicar.');
  }

  const deployment = eas(['deploy', '--export-dir', output, '--no-source-maps', '--json', ...sharedFlags], true);
  if (!/^[a-z0-9]{6,20}$/.test(deployment.identifier ?? '')) throw Error('Expo no devolvió un ID de despliegue válido.');
  deploymentId = deployment.identifier;
  console.log(`Web preparada en Expo (${deploymentId}).`);

  if (git('rev-parse', '--short', 'HEAD') !== commit || git('status', '--porcelain')) {
    throw Error('El código cambió durante la preparación. Vuelve a ejecutar el comando.');
  }
  eas(['update', '--channel', 'production', '--platform', 'android', '--message', `PDR Comercial ${revision} (${commit})`, ...sharedFlags]);
  androidPublished = true;

  for (const destination of [['--prod'], ['--alias', 'administracion'], ['--alias', 'piloto']]) {
    eas(['deploy:alias', '--id', deploymentId, ...destination, '--non-interactive']);
  }
  console.log(`Revisión ${revision} publicada en Android y en https://pdr-comercial.expo.app.`);
} catch (error) {
  console.error(error.message);
  if (androidPublished) {
    console.error(`Android ya fue publicado. Completa la promoción web del despliegue ${deploymentId} en Expo Hosting.`);
  }
  process.exitCode = 1;
}

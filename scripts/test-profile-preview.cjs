const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');

const element = (type, props) => ({ type, props: props ?? {} });
const roleLabels = {
  seller: 'Ejecutivo', coordinator: 'Coordinador', sales_manager: 'Jefe de Venta',
  commercial_manager: 'Jefe Comercial', sales_director: 'Gerente de Ventas',
  admin: 'Administrador', audiovisual: 'Audiovisual',
};
const fixtures = [
  { id: 'commercial-fixture', name: 'Benjamín Hernández', role: 'commercial_manager', active: true, status: 'active' },
  { id: 'director-fixture', name: 'Gabriel De Luca', role: 'sales_director', active: true, status: 'active' },
];
const code = ts.transpileModule(fs.readFileSync('app/(tabs)/profile.tsx', 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX },
}).outputText;

function harness(role = 'admin', isPreviewing = false) {
  const values = [], effects = [], pendingEffects = [], timers = new Map();
  const searched = [], previews = [], routes = [];
  let cursor = 0, effectCursor = 0, nextTimer = 0;
  const profile = { id: 'viewer', name: 'Viewer', role, rut: '', joinDate: '2026-01-01' };
  const output = {};
  vm.runInNewContext(code, {
    exports: output,
    setTimeout(fn) { const id = ++nextTimer; timers.set(id, fn); return id; },
    clearTimeout(id) { timers.delete(id); },
    require(id) {
      if (id === 'react') return {
        useState(initial) {
          const i = cursor++;
          if (!(i in values)) values[i] = initial;
          return [values[i], value => { values[i] = typeof value === 'function' ? value(values[i]) : value; }];
        },
        useEffect(fn, deps) {
          const i = effectCursor++, previous = effects[i];
          if (!previous || deps.some((value, index) => !Object.is(value, previous.deps[index]))) {
            previous?.cleanup?.();
            effects[i] = { deps };
            pendingEffects.push(() => { effects[i].cleanup = fn(); });
          }
        },
      };
      if (id === 'react/jsx-runtime') return { jsx: element, jsxs: element };
      if (id === 'react-native') return { Pressable: 'Pressable', Text: 'Text', TextInput: 'TextInput', View: 'View', StyleSheet: { create: x => x } };
      if (id === '@expo/vector-icons') return { Ionicons: 'Ionicons' };
      if (id === 'expo-router') return { useRouter: () => ({ replace: route => routes.push(route), push: route => routes.push(route) }) };
      if (id === '@/hooks/useAuth') return { useAuth: () => ({ authenticatedUser: profile, user: profile, isPreviewing, isLoading: false, startPreview: user => previews.push(user), signOut: async () => {} }) };
      if (id === '@/services/individualSheetService') return {
        individualSheetService: { async search(query, selectedRole) { searched.push({ query, role: selectedRole }); return fixtures.filter(worker => worker.role === selectedRole); } },
        workerUser: worker => ({ ...worker, employmentStatus: worker.status }),
      };
      if (id === '@/utils/personName') return { displayPersonName: user => user.name };
      if (id === '@/utils/format') return { formatDate: value => value ?? '' };
      if (id === '@/utils/rut') return { formatRut: value => value };
      if (id === '@/types') return { roleLabels };
      if (id === '@/theme') return { colors: {}, radii: {}, shadows: {}, spacing: {}, typography: {} };
      if (id === '@/data/mockData') return { currentUser: profile };
      if (id.startsWith('@/components/')) return new Proxy({}, { get: (_, key) => key });
      throw new Error(id);
    },
  });
  return {
    searched, previews, routes,
    render() {
      cursor = 0; effectCursor = 0;
      const tree = output.default();
      pendingEffects.splice(0).forEach(fn => fn());
      return tree;
    },
    async flushTimers() {
      const callbacks = [...timers.values()]; timers.clear(); callbacks.forEach(fn => fn());
      await Promise.resolve(); await Promise.resolve(); await Promise.resolve();
    },
  };
}
function walk(node, fn) {
  if (node === null || node === undefined || node === false) return;
  if (Array.isArray(node)) return node.forEach(child => walk(child, fn));
  fn(node);
  if (typeof node === 'object') walk(node.props.children, fn);
}
function text(node) {
  const parts = []; walk(node, item => { if (typeof item === 'string' || typeof item === 'number') parts.push(String(item)); });
  return parts.join('');
}
function find(tree, predicate) {
  const matches = []; walk(tree, node => { if (typeof node === 'object' && predicate(node)) matches.push(node); });
  assert.equal(matches.length, 1); return matches[0];
}

(async () => {
  const screen = harness();
  let tree = screen.render();
  for (const label of ['Ver como vendedor', 'Ver como coordinador', 'Ver como jefe de venta', 'Ver como jefe comercial', 'Ver como gerente de ventas']) {
    find(tree, node => node.type === 'Pressable' && text(node) === label);
  }
  assert.equal(screen.searched.length, 0, 'No full roster search before typing');
  for (const worker of fixtures) {
    const label = worker.role === 'commercial_manager' ? 'Ver como jefe comercial' : 'Ver como gerente de ventas';
    find(tree, node => node.type === 'Pressable' && text(node) === label).props.onPress();
    tree = screen.render();
    assert.equal(text(tree).includes(worker.name), false, 'No automatic full list');
    find(tree, node => node.type === 'TextInput').props.onChangeText(worker.name.slice(0, 1));
    tree = screen.render(); await screen.flushTimers();
    assert.equal(screen.searched.length, screen.previews.length, 'One letter must not trigger a query');
    find(tree, node => node.type === 'TextInput').props.onChangeText(worker.name.split(' ')[0]);
    tree = screen.render(); await screen.flushTimers(); tree = screen.render();
    assert.equal(screen.searched.at(-1).role, worker.role);
    assert.equal(screen.searched.at(-1).query, worker.name.split(' ')[0]);
    find(tree, node => node.type === 'Pressable' && node.props.accessibilityLabel === `Ver la aplicación como ${worker.name}, ${roleLabels[worker.role]}`).props.onPress();
    assert.equal(screen.previews.at(-1).id, worker.id);
    assert.equal(screen.previews.at(-1).role, worker.role);
    assert.equal(screen.previews.at(-1).employmentStatus, 'active');
    assert.equal(screen.routes.at(-1), '/(tabs)/home');
  }
  for (const role of ['seller', 'coordinator', 'sales_manager', 'commercial_manager', 'sales_director', 'audiovisual']) {
    assert.equal(text(harness(role).render()).includes('Vista previa de perfiles'), false, role);
  }
  assert.equal(text(harness('admin', true).render()).includes('Vista previa de perfiles'), false, 'No nested preview');
  console.log('PASS: administrator can search and preview Jefe Comercial and Gerente de Ventas; other profiles and nested previews cannot access the selector.');
})().catch(error => { console.error(error); process.exitCode = 1; });

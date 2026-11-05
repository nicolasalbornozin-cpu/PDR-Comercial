const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');

const element = (type, props) => ({ type, props: props ?? {} });
const code = ts.transpileModule(fs.readFileSync('app/(tabs)/ranking.tsx', 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX },
}).outputText;

function harness(role) {
  const values = [], effects = [], pendingEffects = [], requests = [];
  let cursor = 0, effectCursor = 0;
  const user = { id: 'ranking-viewer', role };
  const output = {};
  vm.runInNewContext(code, {
    exports: output,
    require(id) {
      if (id === 'react') return {
        useState(initial) {
          const i = cursor++;
          if (!(i in values)) values[i] = initial;
          return [values[i], next => { values[i] = typeof next === 'function' ? next(values[i]) : next; }];
        },
        useMemo: fn => fn(),
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
      if (id === 'react-native') return { FlatList: 'FlatList', Pressable: 'Pressable', Text: 'Text', View: 'View', StyleSheet: { create: x => x } };
      if (id === '@expo/vector-icons') return { Ionicons: 'Ionicons' };
      if (id === '@/hooks/useAuth') return { useAuth: () => ({ user, isPreviewing: role === 'admin' }) };
      if (id === '@/hooks/useCommercialRefresh') return { useCommercialRefresh: () => 0 };
      if (id === '@/services/snapshotService') return { snapshotService: {
        async getRanking(account, period, options) {
          requests.push({ userId: account.id, period, ...options });
          return [{ userId: `${period}-${options.rankingMode}`, position: 1, value: 100, emittedValue: 40, notEmittedValue: 60, isCurrentUser: true }];
        },
        async getDashboard() { return { periodLabel: 'Octubre comercial 2026', rankingExecutiveCount: 10 }; },
        async getRankingPeriod(account, period) { return period === 'annual' ? '2026' : 'Octubre comercial 2026'; },
      } };
      if (id === '@/utils/format') return { formatUF: value => String(value) };
      if (id === '@/theme') return { colors: {}, radii: {}, shadows: {}, spacing: {}, typography: {} };
      if (id.startsWith('@/components/')) return new Proxy({}, { get: (_, key) => key });
      throw new Error(id);
    },
  });
  return {
    requests,
    render() {
      cursor = 0; effectCursor = 0;
      const tree = output.default();
      pendingEffects.splice(0).forEach(fn => fn());
      return tree;
    },
    async settle() { await new Promise(resolve => setTimeout(resolve, 0)); return this.render(); },
  };
}
function walk(node, fn) {
  if (node === null || node === undefined || node === false) return;
  if (Array.isArray(node)) return node.forEach(child => walk(child, fn));
  fn(node);
  if (typeof node === 'object') {
    walk(node.props.children, fn);
    walk(node.props.ListHeaderComponent, fn);
  }
}
function text(node) {
  const parts = []; walk(node, item => { if (typeof item === 'string' || typeof item === 'number') parts.push(String(item)); });
  return parts.join('');
}
function all(tree, predicate) {
  const matches = []; walk(tree, node => { if (typeof node === 'object' && predicate(node)) matches.push(node); }); return matches;
}
function one(tree, predicate) { const found = all(tree, predicate); assert.equal(found.length, 1); return found[0]; }
const modeButton = (tree, label) => one(tree, node => node.type === 'Pressable' && text(node) === label);
const periodTabs = tree => one(tree, node => node.type === 'RankingTabs');
const list = tree => one(tree, node => node.type === 'FlatList');

(async () => {
  for (const role of ['seller', 'coordinator', 'sales_manager', 'commercial_manager', 'sales_director', 'admin']) {
    const screen = harness(role);
    let tree = screen.render();
    assert.equal(screen.requests.at(-1).rankingMode, 'executives');
    assert.equal(all(tree, node => node.props.accessibilityRole === 'tablist').length, 0, role + ': annual has no team selector');
    tree = await screen.settle();
    assert.equal(list(tree).props.data[0].userId, 'annual-executives');
    assert.ok(text(tree).includes('Ranking por ejecutivo'));

    periodTabs(tree).props.onChange('monthly'); tree = screen.render();
    modeButton(tree, 'Por ejecutivo'); modeButton(tree, 'Por equipo');
    tree = await screen.settle();
    assert.equal(list(tree).props.data[0].userId, 'monthly-executives');
    modeButton(tree, 'Por equipo').props.onPress(); tree = screen.render();
    assert.equal(screen.requests.at(-1).rankingMode, 'teams');
    tree = await screen.settle();
    assert.equal(list(tree).props.data[0].userId, 'monthly-teams');
    assert.ok(text(tree).includes('Ranking de equipos'));

    periodTabs(tree).props.onChange('annual'); tree = screen.render();
    assert.equal(screen.requests.at(-1).rankingMode, 'executives', role + ': annual forces executive query');
    assert.equal(list(tree).props.data.length, 0, 'Never render stale monthly teams in annual');
    assert.equal(all(tree, node => node.props.accessibilityRole === 'tablist').length, 0);
    assert.equal(text(tree).includes('Los totales de equipos'), false);
    tree = await screen.settle();
    assert.equal(list(tree).props.data[0].userId, 'annual-executives');
    one(tree, node => node.type === 'Pressable' && text(node) === 'Ver emitidas vs. sin emitir').props.onPress(); tree = screen.render();
    assert.equal(list(tree).props.extraData, true, 'Annual emission comparison remains available');

    periodTabs(tree).props.onChange('monthly'); tree = screen.render(); tree = await screen.settle();
    assert.equal(list(tree).props.data[0].userId, 'monthly-teams', 'Monthly team selection is preserved');
    modeButton(tree, 'Por ejecutivo').props.onPress(); tree = screen.render(); tree = await screen.settle();
    assert.equal(list(tree).props.data[0].userId, 'monthly-executives');
    assert.equal(screen.requests.some(request => request.period === 'annual' && request.rankingMode === 'teams'), false);
  }
  console.log('PASS: all six commercial roles show executives only in annual; monthly retains executive/team modes, transitions never fetch/render annual teams, and emission comparison remains available.');
})().catch(error => { console.error(error); process.exitCode = 1; });

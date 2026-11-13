const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const element = (type, props) => ({ type, props: props ?? {} });
const flatten = style => Object.assign({}, ...[style].flat(Infinity).filter(Boolean));
let role = 'admin', preview = false, pilot = false;
let dimensions = { width: 390, height: 844, fontScale: 1 };
let insets = { top: 24, bottom: 34, left: 0, right: 0 };
const colors = { primary: '#0E563A', primaryDark: '#093D2A', gold: '#C6A24C', goldOnDark: '#E0C56F', surface: '#FFFFFF', textMuted: '#5F6D65', border: '#E5E9E5' };
function load(file) {
  const code = ts.transpileModule(fs.readFileSync(file, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX },
  }).outputText;
  const output = {};
  vm.runInNewContext(code, { exports: output, require(id) {
    if (id === 'react/jsx-runtime') return { jsx: element, jsxs: element };
    if (id === 'react-native') return { Text: 'Text', View: 'View', Pressable: 'Pressable', useWindowDimensions: () => dimensions, StyleSheet: { create: x => x } };
    if (id === 'react-native-safe-area-context') return { useSafeAreaInsets: () => insets };
    if (id === '@expo/vector-icons') return { Ionicons: 'Ionicons' };
    if (id === 'expo-router') return { Tabs: { Screen: 'Tabs.Screen' }, useRouter: () => ({ replace() {} }), useSegments: () => ['(tabs)', 'home'] };
    if (id === '@/hooks/useAuth') return { useAuth: () => ({ user: { id: 'qa', name: 'Demo', role }, isPreviewing: preview, stopPreview() {} }) };
    if (id === '@/theme') return { colors, typography: { sans: 'sans-serif' }, spacing: { md: 12, lg: 16, sm: 8 }, radii: {}, shadows: {} };
    if (id === '@/utils/bottomNavigation') return metrics;
    if (id === '@/utils/pilotNavigation') return { get isPilotMode() { return pilot; } };
    if (id === '@/utils/personName') return { displayPersonName: person => person.name };
    if (id === '@/types') return { roleLabels: { seller: 'Ejecutivo' } };
    throw new Error(id);
  } });
  return output;
}
const metrics = load('src/utils/bottomNavigation.ts');
const layout = load('app/(tabs)/_layout.tsx');
const banner = load('src/components/PreviewModeBanner.tsx');

for (const test of [
  { width: 320, bottom: 0, left: 0, right: 0, fontScale: 1 },
  { width: 390, bottom: 34, left: 0, right: 0, fontScale: 1 },
  { width: 844, bottom: 21, left: 44, right: 44, fontScale: 1.5 },
  { width: 1200, bottom: 0, left: 0, right: 0, fontScale: 2.5 },
]) {
  dimensions = { width: test.width, height: 844, fontScale: test.fontScale };
  insets = { top: 0, bottom: test.bottom, left: test.left, right: test.right };
  const geometry = metrics.bottomNavigationMetrics(dimensions.width, insets, dimensions.fontScale);
  for (role of ['admin', 'seller', 'coordinator', 'sales_manager', 'commercial_manager', 'sales_director', 'audiovisual']) {
    const tree = layout.default();
    const options = tree.props.screenOptions, style = flatten(options.tabBarStyle);
    assert.equal(options.tabBarHideOnKeyboard, true);
    assert.equal(options.tabBarLabelPosition, 'below-icon');
    assert.equal(style.backgroundColor, colors.surface);
    assert.equal(style.borderRadius, 30);
    assert.equal(style.position, undefined, 'Navigator reserves layout space; no content overlay');
    assert.ok(style.width <= test.width - test.left - test.right - 24);
    assert.ok(style.width <= 620);
    assert.ok(style.height >= 80);
    assert.ok(style.marginBottom >= insets.bottom && style.marginBottom >= 12);
    const visible = tree.props.children.filter(screen => screen.props.options.href !== null);
    const names = visible.map(screen => screen.props.name).join(',');
    assert.equal(names, role === 'admin' ? 'home,ranking,news,admin,profile' : role === 'audiovisual' ? 'news,profile' : 'home,ranking,news,profile');
    const activeLabel = options.tabBarLabel({ children: 'Inicio', focused: true });
    assert.equal(activeLabel.props.children, 'Inicio');
    assert.equal(activeLabel.props.numberOfLines, 1);
    assert.equal(activeLabel.props.adjustsFontSizeToFit, true);
    assert.equal(flatten(activeLabel.props.style).color, colors.primary);
    assert.equal(options.tabBarLabel({ children: 'Administrar', focused: false }).props.children, test.width < 360 ? 'Admin' : 'Administrar');
    assert.equal(tree.props.children.find(screen => screen.props.name === 'admin').props.options.tabBarAccessibilityLabel, 'Administrar');
    const home = tree.props.children.find(screen => screen.props.name === 'home');
    const activeIcon = home.props.options.tabBarIcon({ focused: true });
    const activeView = activeIcon.type(activeIcon.props);
    assert.equal(flatten(activeView.props.style).backgroundColor, colors.gold);
    assert.equal(activeView.props.importantForAccessibility, 'no-hide-descendants');
    assert.equal(activeView.props.children.props.color, colors.primaryDark);
    const inactiveIcon = home.props.options.tabBarIcon({ focused: false });
    assert.equal(flatten(inactiveIcon.type(inactiveIcon.props).props.style).backgroundColor, undefined);
    preview = true;
    const previewTree = banner.PreviewModeBanner();
    assert.equal(flatten(previewTree.props.style).bottom, geometry.previewOffset);
    assert.ok(flatten(previewTree.props.style).bottom > style.height + style.marginBottom + style.marginTop);
    preview = false;
    assert.equal(banner.PreviewModeBanner(), null);
  }
}
pilot = true;
for (role of ['admin', 'seller', 'coordinator', 'sales_manager', 'commercial_manager', 'sales_director', 'audiovisual']) {
  const tree = layout.default();
  const visible = tree.props.children.filter(screen => screen.props.options.href !== null);
  const locked = visible.filter(screen => screen.props.options.tabBarButton);
  assert.equal(locked.map(screen => screen.props.name).join(','), role === 'admin' ? 'home,admin' : role === 'audiovisual' ? '' : 'home');
  assert.equal(visible.filter(screen => !screen.props.options.tabBarButton).map(screen => screen.props.name).join(','), role === 'audiovisual' ? 'news,profile' : 'ranking,news,profile');
  assert.equal(tree.props.initialRouteName, role === 'audiovisual' ? 'news' : 'ranking');
  for (const screen of locked) {
    assert.equal(screen.props.options.href, undefined);
    const button = screen.props.options.tabBarButton({ onPress() { assert.fail('Locked tab navigated'); } });
    assert.equal(button.props.disabled, true);
    assert.equal(button.props.onPress, undefined);
    const icon = screen.props.options.tabBarIcon();
    assert.equal(icon.props.inactive, 'lock-closed-outline');
  }
}
console.log('PASS: rounded brand navigation, active gold icon, seven-role visibility, keyboard hiding, safe-area/font-scale layouts and non-overlapping administrator preview banner.');
console.log('PASS: pilot opens the allowed first tab and exposes locked tabs without navigation.');

export interface BottomNavigationInsets {
  bottom: number;
  left: number;
  right: number;
}

// The bar stays in the navigator's normal layout: content never scrolls under it.
// Share its geometry with the administrator preview banner so they cannot overlap.
export function bottomNavigationMetrics(width: number, insets: BottomNavigationInsets, fontScale = 1) {
  const height = 80 + Math.ceil(Math.max(0, fontScale - 1) * 14);
  const bottomGap = Math.max(insets.bottom, 12);
  return {
    width: Math.min(620, Math.max(0, width - insets.left - insets.right - 24)),
    height,
    bottomGap,
    topGap: 8,
    previewOffset: height + bottomGap + 16,
  };
}

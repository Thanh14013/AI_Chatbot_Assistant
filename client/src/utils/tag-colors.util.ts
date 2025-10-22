/**
 * Tag Colors Utility
 * Generates consistent colors for tag names using a hash function
 */

// Predefined color palette for tags (vibrant but not too bright)
const TAG_COLORS = [
  "#3B82F6", // Blue
  "#10B981", // Green
  "#F59E0B", // Amber
  "#EF4444", // Red
  "#8B5CF6", // Purple
  "#EC4899", // Pink
  "#14B8A6", // Teal
  "#F97316", // Orange
  "#6366F1", // Indigo
  "#84CC16", // Lime
  "#06B6D4", // Cyan
  "#F43F5E", // Rose
  "#A855F7", // Violet
  "#22C55E", // Emerald
  "#EAB308", // Yellow
  "#64748B", // Slate
];

/**
 * Simple hash function to convert string to number
 * @param str - Input string
 * @returns Hash number
 */
function hashString(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  return Math.abs(hash);
}

/**
 * Get a consistent color for a tag name
 * The same tag name will always return the same color
 *
 * @param tagName - Tag name
 * @returns Hex color string
 */
export function getTagColor(tagName: string): string {
  const hash = hashString(tagName.toLowerCase());
  const index = hash % TAG_COLORS.length;
  return TAG_COLORS[index];
}

/**
 * Get color with opacity for background
 * @param tagName - Tag name
 * @param opacity - Opacity value (0-1)
 * @returns RGBA color string
 */
export function getTagBackgroundColor(
  tagName: string,
  opacity: number = 0.1
): string {
  const hex = getTagColor(tagName);
  // Convert hex to RGB
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${opacity})`;
}

export default {
  getTagColor,
  getTagBackgroundColor,
};

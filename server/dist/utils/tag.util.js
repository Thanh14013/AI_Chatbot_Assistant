/**
 * Tag Utility Functions
 * Provides validation and normalization for conversation tags
 */
// Validation constants
export const MAX_TAGS_PER_CONVERSATION = 4;
export const MAX_TAG_LENGTH = 20;
export const MIN_TAG_LENGTH = 1;
/**
 * Normalize a single tag
 * - Convert to lowercase
 * - Trim whitespace
 * - Replace spaces with hyphens
 * - Remove special characters (keep only alphanumeric and hyphens)
 *
 * @param tag - Raw tag string
 * @returns Normalized tag string
 */
export function normalizeTag(tag) {
    return tag
        .toLowerCase()
        .trim()
        .replace(/\s+/g, "-") // Replace spaces with hyphens
        .replace(/[^a-z0-9-]/g, "") // Remove special characters
        .replace(/-+/g, "-") // Replace multiple hyphens with single hyphen
        .replace(/^-+|-+$/g, ""); // Remove leading/trailing hyphens
}
/**
 * Validate and normalize an array of tags
 *
 * @param tags - Array of tag strings
 * @returns Validation result with normalized tags and errors
 */
export function validateAndNormalizeTags(tags) {
    const errors = [];
    const normalizedTags = [];
    const seenTags = new Set();
    // Check if tags is an array
    if (!Array.isArray(tags)) {
        return {
            isValid: false,
            errors: ["Tags must be an array"],
            normalizedTags: [],
        };
    }
    // Check maximum tags count
    if (tags.length > MAX_TAGS_PER_CONVERSATION) {
        errors.push(`Maximum ${MAX_TAGS_PER_CONVERSATION} tags allowed per conversation`);
    }
    // Process each tag
    for (const tag of tags) {
        // Skip non-string values
        if (typeof tag !== "string") {
            errors.push(`Tag must be a string: ${JSON.stringify(tag)}`);
            continue;
        }
        // Normalize the tag
        const normalized = normalizeTag(tag);
        // Check if tag is empty after normalization
        if (normalized.length === 0) {
            errors.push(`Tag cannot be empty after normalization: "${tag}"`);
            continue;
        }
        // Check minimum length
        if (normalized.length < MIN_TAG_LENGTH) {
            errors.push(`Tag too short (min ${MIN_TAG_LENGTH} character): "${tag}"`);
            continue;
        }
        // Check maximum length
        if (normalized.length > MAX_TAG_LENGTH) {
            errors.push(`Tag too long (max ${MAX_TAG_LENGTH} characters): "${tag}" (normalized: "${normalized}")`);
            continue;
        }
        // Check for duplicates (after normalization)
        if (seenTags.has(normalized)) {
            errors.push(`Duplicate tag: "${normalized}"`);
            continue;
        }
        // Add to normalized tags
        seenTags.add(normalized);
        normalizedTags.push(normalized);
    }
    // Respect max tags limit even if some tags were invalid
    const finalTags = normalizedTags.slice(0, MAX_TAGS_PER_CONVERSATION);
    return {
        isValid: errors.length === 0,
        errors,
        normalizedTags: finalTags,
    };
}
/**
 * Sanitize tags for safe storage
 * - Removes duplicates
 * - Normalizes tags
 * - Ensures max count
 *
 * @param tags - Array of tag strings
 * @returns Sanitized array of tags
 */
export function sanitizeTags(tags) {
    if (!Array.isArray(tags)) {
        return [];
    }
    const normalized = new Set();
    for (const tag of tags) {
        if (typeof tag === "string" && tag.trim()) {
            const normalizedTag = normalizeTag(tag);
            if (normalizedTag.length > 0 && normalizedTag.length <= MAX_TAG_LENGTH) {
                normalized.add(normalizedTag);
            }
        }
    }
    // Return as array, limited to max count
    return Array.from(normalized).slice(0, MAX_TAGS_PER_CONVERSATION);
}
/**
 * Check if tags array is valid (basic check without detailed errors)
 *
 * @param tags - Array of tag strings
 * @returns True if tags are valid, false otherwise
 */
export function areTagsValid(tags) {
    if (!Array.isArray(tags)) {
        return false;
    }
    if (tags.length > MAX_TAGS_PER_CONVERSATION) {
        return false;
    }
    for (const tag of tags) {
        if (typeof tag !== "string") {
            return false;
        }
        const normalized = normalizeTag(tag);
        if (normalized.length < MIN_TAG_LENGTH || normalized.length > MAX_TAG_LENGTH) {
            return false;
        }
    }
    return true;
}
export default {
    normalizeTag,
    validateAndNormalizeTags,
    sanitizeTags,
    areTagsValid,
    MAX_TAGS_PER_CONVERSATION,
    MAX_TAG_LENGTH,
    MIN_TAG_LENGTH,
};

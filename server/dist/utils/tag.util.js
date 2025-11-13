export const MAX_TAGS_PER_CONVERSATION = 4;
export const MAX_TAG_LENGTH = 20;
export const MIN_TAG_LENGTH = 1;
export function normalizeTag(tag) {
    return tag
        .toLowerCase()
        .trim()
        .replace(/\s+/g, "-")
        .replace(/[^a-z0-9-]/g, "")
        .replace(/-+/g, "-")
        .replace(/^-+|-+$/g, "");
}
export function validateAndNormalizeTags(tags) {
    const errors = [];
    const normalizedTags = [];
    const seenTags = new Set();
    if (!Array.isArray(tags)) {
        return {
            isValid: false,
            errors: ["Tags must be an array"],
            normalizedTags: [],
        };
    }
    if (tags.length > MAX_TAGS_PER_CONVERSATION) {
        errors.push(`Maximum ${MAX_TAGS_PER_CONVERSATION} tags allowed per conversation`);
    }
    for (const tag of tags) {
        if (typeof tag !== "string") {
            errors.push(`Tag must be a string: ${JSON.stringify(tag)}`);
            continue;
        }
        const normalized = normalizeTag(tag);
        if (normalized.length === 0) {
            errors.push(`Tag cannot be empty after normalization: "${tag}"`);
            continue;
        }
        if (normalized.length < MIN_TAG_LENGTH) {
            errors.push(`Tag too short (min ${MIN_TAG_LENGTH} character): "${tag}"`);
            continue;
        }
        if (normalized.length > MAX_TAG_LENGTH) {
            errors.push(`Tag too long (max ${MAX_TAG_LENGTH} characters): "${tag}" (normalized: "${normalized}")`);
            continue;
        }
        if (seenTags.has(normalized)) {
            continue;
        }
        seenTags.add(normalized);
        normalizedTags.push(normalized);
    }
    const finalTags = normalizedTags.slice(0, MAX_TAGS_PER_CONVERSATION);
    return {
        isValid: errors.length === 0,
        errors,
        normalizedTags: finalTags,
    };
}
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
    return Array.from(normalized).slice(0, MAX_TAGS_PER_CONVERSATION);
}
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

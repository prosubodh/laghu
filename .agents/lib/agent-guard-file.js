import fs from 'node:fs';
import path from 'node:path';
/**
 * Default maximum lines allowed per file before triggering Refactor-Before-Add enforcement.
 */
export const DEFAULT_MAX_FILE_LINES = 300;
/**
 * Calculates the number of newline-delimited lines in a given text string.
 *
 * @param text - Input string to evaluate.
 * @returns Total count of lines.
 */
export function countLines(text) {
    if (!text)
        return 0;
    return text.split('\n').length;
}
/**
 * Reads an existing file from disk and returns its current line count.
 *
 * @param filePath - Path of the file to inspect.
 * @returns Total number of lines, or 0 if unreadable or non-existent.
 */
export function readExistingLines(filePath) {
    if (!fs.existsSync(filePath))
        return 0;
    try {
        const content = fs.readFileSync(filePath, 'utf-8');
        return countLines(content);
    }
    catch {
        return 0;
    }
}
function calculateProjectedLines(currentLines, input) {
    if (input.incomingContent !== undefined) {
        return countLines(input.incomingContent);
    }
    if (input.replacementContent !== undefined) {
        const addedLines = countLines(input.replacementContent);
        const removedLines = input.targetContent !== undefined ? countLines(input.targetContent) : 1;
        return Math.max(0, currentLines + addedLines - removedLines);
    }
    return currentLines;
}
function evaluateLineThresholds(params) {
    const { filePath, currentLines, projectedLines, maxLines } = params;
    const base = { currentLines, projectedLines, maxLines };
    const relPath = path.basename(filePath);
    if (currentLines > maxLines) {
        if (projectedLines >= currentLines) {
            return {
                ...base,
                blocked: true,
                reason: `Refactor-Before-Add violation: '${relPath}' currently has ${currentLines} lines (limit: ${maxLines}). Adding or maintaining lines in an overflowing file is blocked. Refactor into modular units under green tests first.`
            };
        }
        return { ...base, blocked: false };
    }
    if (projectedLines > maxLines) {
        return {
            ...base,
            blocked: true,
            reason: `File line budget exceeded: '${relPath}' would grow to ${projectedLines} lines (limit: ${maxLines}). Decompose into modular components before appending more code.`
        };
    }
    return { ...base, blocked: false };
}
/**
 * Checks a proposed file write or edit against Refactor-Before-Add rules.
 *
 * @param input - File path and proposed content.
 * @returns Decision result indicating whether the write is blocked.
 */
export function inspectFileWrite(input) {
    const maxLines = input.maxLines ?? DEFAULT_MAX_FILE_LINES;
    const currentLines = readExistingLines(input.filePath);
    const projectedLines = calculateProjectedLines(currentLines, input);
    return evaluateLineThresholds({
        filePath: input.filePath,
        currentLines,
        projectedLines,
        maxLines
    });
}
export default {
    DEFAULT_MAX_FILE_LINES,
    countLines,
    readExistingLines,
    inspectFileWrite
};
//# sourceMappingURL=agent-guard-file.js.map
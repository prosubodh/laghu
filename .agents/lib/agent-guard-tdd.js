import fs from 'node:fs';
import path from 'node:path';
/**
 * Identifies whether a given path is a unit or integration test file.
 *
 * @param filePath - File path to inspect.
 * @returns True if path matches test directory or file extension patterns.
 */
export function isTestFile(filePath) {
    const norm = filePath.replace(/\\/g, '/').toLowerCase();
    if (/(^|\/)(tests?|__tests__)(\/|$)/i.test(norm)) {
        return true;
    }
    return /\.(test|spec)\.[a-z0-9]+$/i.test(norm);
}
/**
 * Identifies whether a given path is a non-code file (markdown, json, yaml, images).
 *
 * @param filePath - File path to inspect.
 * @returns True if file extension indicates non-code asset or configuration.
 */
export function isNonCodeFile(filePath) {
    const ext = path.extname(filePath).toLowerCase();
    const nonCodeExts = new Set(['.md', '.json', '.yml', '.yaml', '.txt', '.toml', '.lock', '.svg', '.png']);
    return nonCodeExts.has(ext);
}
/**
 * Identifies whether a given file path corresponds to production code under src/, lib/, or app/.
 *
 * @param filePath - File path to inspect.
 * @returns True if path is production source code subject to RED-before-GREEN discipline.
 */
export function isProductionFile(filePath) {
    if (isNonCodeFile(filePath))
        return false;
    if (isTestFile(filePath))
        return false;
    const norm = filePath.replace(/\\/g, '/').toLowerCase();
    return norm.includes('src/') || norm.includes('lib/') || norm.includes('app/');
}
/**
 * Loads session TDD tracking state from disk, defaulting to unrecorded state if missing.
 *
 * @param stateFile - Path to the persistent session state JSON file.
 * @returns Parsed SessionTddState object.
 */
export function readTddState(stateFile) {
    if (!fs.existsSync(stateFile)) {
        return { lastFailingTestRecorded: false };
    }
    try {
        const raw = fs.readFileSync(stateFile, 'utf-8');
        return JSON.parse(raw);
    }
    catch {
        return { lastFailingTestRecorded: false };
    }
}
/**
 * Persists session TDD state to disk with fail-safe error handling to avoid disrupting execution.
 *
 * @param stateFile - Path to the persistent session state JSON file.
 * @param state - SessionTddState object to record.
 */
export function writeTddState(stateFile, state) {
    try {
        const dir = path.dirname(stateFile);
        if (!fs.existsSync(dir))
            fs.mkdirSync(dir, { recursive: true });
        fs.writeFileSync(stateFile, JSON.stringify(state, null, 2), 'utf-8');
    }
    catch {
        // Fail-safe write: do not crash agent if state cannot be persisted
    }
}
/**
 * Checks whether an edit to a file is allowed under RED-before-GREEN TDD rules.
 *
 * @param filePath - Path to file being edited.
 * @param state - Current session TDD state.
 * @param enforceTestFirst - Whether test-first enforcement is strictly enabled.
 * @returns Decision result indicating whether edit is blocked.
 */
export function inspectTddRequirement(filePath, state, enforceTestFirst = false) {
    const prod = isProductionFile(filePath);
    if (!enforceTestFirst || !prod) {
        return { blocked: false, isProductionFile: prod };
    }
    if (!state.lastFailingTestRecorded) {
        const baseName = path.basename(filePath);
        return {
            blocked: true,
            isProductionFile: true,
            reason: `Test-First (RED-before-GREEN) requirement: Production file '${baseName}' cannot be edited before a failing test (RED) is recorded. Author a failing unit or acceptance test first, verify failure output, then edit production code.`
        };
    }
    return { blocked: false, isProductionFile: true };
}
export default {
    isTestFile,
    isNonCodeFile,
    isProductionFile,
    readTddState,
    writeTddState,
    inspectTddRequirement
};
//# sourceMappingURL=agent-guard-tdd.js.map
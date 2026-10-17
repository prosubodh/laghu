import path from 'node:path';
import { inspectCommand } from './agent-guard-command.js';
import { inspectFileWrite } from './agent-guard-file.js';
import { inspectTddRequirement, readTddState, writeTddState } from './agent-guard-tdd.js';
function parseEnvelope(raw) {
    try {
        const trimmed = raw.trim();
        if (!trimmed.startsWith('{'))
            return null;
        return JSON.parse(trimmed);
    }
    catch {
        return null;
    }
}
function extractKey(input, keys) {
    for (const k of keys) {
        if (typeof input[k] === 'string')
            return input[k];
    }
    return undefined;
}
function extractFilePath(input) {
    return extractKey(input, ['TargetFile', 'file_path', 'path', 'filePath']);
}
function extractCommand(input) {
    return extractKey(input, ['CommandLine', 'command', 'cmd']);
}
function inspectPreCommand(cmd) {
    const violation = inspectCommand(cmd);
    if (violation.blocked) {
        return { allowed: false, reason: violation.reason, source: 'command' };
    }
    return { allowed: true };
}
function inspectPreFile(filePath, input, options) {
    const incoming = extractKey(input, ['CodeContent', 'content']);
    const replacement = extractKey(input, ['ReplacementContent', 'replacement']);
    const target = extractKey(input, ['TargetContent', 'target']);
    const fileDecision = inspectFileWrite({
        filePath,
        incomingContent: incoming,
        replacementContent: replacement,
        targetContent: target,
        maxLines: options.maxFileLines
    });
    if (fileDecision.blocked) {
        return { allowed: false, reason: fileDecision.reason, source: 'file' };
    }
    const root = options.workspaceRoot ?? process.cwd();
    const statePath = path.join(root, '.agents', '.session-state.json');
    const state = readTddState(statePath);
    const tddDecision = inspectTddRequirement(filePath, state, options.enforceTestFirst);
    if (tddDecision.blocked) {
        return { allowed: false, reason: tddDecision.reason, source: 'tdd' };
    }
    return { allowed: true };
}
/**
 * Inspects a tool-use request before execution (PreToolUse hook).
 *
 * @param rawInput - Raw command string, JSON envelope, or argv slice.
 * @param options - Guard configuration options.
 * @returns Guard decision indicating whether tool execution is permitted.
 */
export function inspectPreTool(rawInput, options = {}) {
    const env = parseEnvelope(rawInput);
    if (env && env.tool_input) {
        const cmd = extractCommand(env.tool_input);
        if (cmd)
            return inspectPreCommand(cmd);
        const targetFile = extractFilePath(env.tool_input);
        if (targetFile)
            return inspectPreFile(targetFile, env.tool_input, options);
    }
    return inspectPreCommand(rawInput);
}
export { inspectCommand, inspectFileWrite, inspectTddRequirement, readTddState, writeTddState };
export default { inspectPreTool, inspectCommand, inspectFileWrite, inspectTddRequirement };
//# sourceMappingURL=agent-guard.js.map
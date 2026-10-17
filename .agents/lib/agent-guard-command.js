/**
 * Command safety guard inspecting shell commands against a destructive denylist.
 */
export const DESTRUCTIVE_RULES = [
    {
        pattern: /\brm\s+(-[a-z-]*[rf][a-z-]*\s+)+(\/|\/\*|~|~\/\*|\$home|\$\{home\}|\.|\.\.|\.\/|[a-z]:\\|[a-z]:\/)/i,
        reason: 'destructive rm targeting root, home, drive, or the current directory'
    },
    {
        pattern: /(^|\s)rm\s+(-[a-z-]*\s+)*(\/|~|[a-z]:\\|[a-z]:\/)($|\s)/i,
        reason: 'destructive rm targeting root or home'
    },
    {
        pattern: /\brm\s+--recursive.*--force\s+(\/|~|\$home|\.)/i,
        reason: 'destructive rm using long-form flags'
    },
    {
        pattern: /\brm\s+.*--no-preserve-root/i,
        reason: 'rm --no-preserve-root is forbidden under agent execution'
    },
    {
        pattern: /\b(wipefs\s+-a|shred\s+-u|find\s+.*-delete)\b/i,
        reason: 'irreversible disk or mass-delete operation'
    },
    {
        pattern: /\bgit\s+push\s+.*(-f|--force|--mirror)\b/i,
        reason: 'force-push or mirror-push can destroy remote history'
    },
    {
        pattern: /\bgit\s+push\b.*--force-with-lease\b/i,
        reason: 'force-push variant detected'
    },
    {
        pattern: /\bgit\s+(reset\s+--hard|clean\s+-[a-z]*[fd])/i,
        reason: 'destructive git worktree operation (reset --hard / clean)'
    },
    {
        pattern: /\bgit\s+checkout\s+--\s+\./i,
        reason: 'git checkout -- . discards all uncommitted work'
    },
    {
        pattern: /\bgit\s+branch\s+-D\b/i,
        reason: 'force branch delete'
    },
    {
        pattern: /\b(drop\s+(database|schema|table)|truncate\s+(table\s+)?[a-z_])/i,
        reason: 'destructive SQL DDL'
    },
    {
        pattern: /\b(delete\s+from|update\s+[a-z_]+\s+set|alter\s+table)\b/i,
        reason: 'destructive SQL DML'
    },
    {
        pattern: /\b(grant\s+all|revoke\s+all)\b/i,
        reason: 'privilege escalation in SQL'
    },
    {
        pattern: /\b(mkfs|dd\s+if=|fdisk|parted\s+\/dev)\b/i,
        reason: 'raw disk operation'
    },
    {
        pattern: /(:[\s]*\([\s]*\)[\s]*\{|:[\s]*\|[\s]*:)/,
        reason: 'fork bomb'
    },
    {
        pattern: /\b(curl|wget)\s+.*\|\s*(sudo\s+)?(ba)?sh\b/i,
        reason: 'piping download directly into shell execution'
    },
    {
        pattern: /\b(base64\s+-d|base64\s+--decode)\s+.*\|/i,
        reason: 'decoding encoded payload into a pipe'
    },
    {
        pattern: /\b(npm|yarn|pnpm)\s+publish\b/i,
        reason: 'package publish must run via release workflow, not ad-hoc tool call'
    }
];
/**
 * Collapses multi-line strings and extra whitespace into a single normalized shell command string.
 *
 * @param raw - Raw command string.
 * @returns Cleaned single-line command string.
 */
export function normalizeCommand(raw) {
    return raw.replace(/[\r\n\t]+/g, ' ').replace(/\s+/g, ' ').trim();
}
/**
 * Checks a command string against the safety denylist.
 *
 * @param command - Raw shell command string.
 * @returns Violation details if blocked, or clean outcome.
 */
export function inspectCommand(command) {
    const normalized = normalizeCommand(command);
    if (!normalized)
        return { blocked: false };
    for (const rule of DESTRUCTIVE_RULES) {
        if (rule.pattern.test(normalized)) {
            return {
                blocked: true,
                reason: rule.reason,
                command: normalized.slice(0, 300)
            };
        }
    }
    return { blocked: false, command: normalized };
}
export default { DESTRUCTIVE_RULES, normalizeCommand, inspectCommand };
//# sourceMappingURL=agent-guard-command.js.map
import fs from 'node:fs';
import path from 'node:path';
/**
 * Canonical architectural boundary rules enforcing Hexagonal / Clean Architecture layer constraints.
 */
export const DEFAULT_BOUNDARY_RULES = [
    {
        fromLayer: 'domain',
        disallowImportsFrom: ['infrastructure', 'infra', 'adapters', 'cli', 'transport', 'controllers']
    },
    {
        fromLayer: 'core',
        disallowImportsFrom: ['infrastructure', 'infra', 'adapters', 'presentation', 'ui']
    }
];
function isSkippedDir(name) {
    return name.startsWith('.') || name === 'node_modules' || name === 'lib';
}
function isEligibleSource(name) {
    const isScript = name.endsWith('.ts') || name.endsWith('.js');
    if (!isScript || name.endsWith('.d.ts'))
        return false;
    return !name.includes('.test.') && !name.includes('.spec.');
}
/**
 * Recursively discovers all eligible source files (.ts and .js) within a directory,
 * ignoring skipped directories (e.g. node_modules, lib) and test files.
 *
 * @param dir - Root directory to search.
 * @returns Sorted array of absolute file paths.
 */
export function findSourceFiles(dir) {
    if (!fs.existsSync(dir))
        return [];
    const results = [];
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
        if (isSkippedDir(entry.name))
            continue;
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) {
            results.push(...findSourceFiles(full));
        }
        else if (isEligibleSource(entry.name)) {
            results.push(path.resolve(full));
        }
    }
    return results.sort();
}
function resolveImportTarget(sourceFile, specifier) {
    const dir = path.dirname(sourceFile);
    const candidate = path.resolve(dir, specifier);
    if (fs.existsSync(candidate))
        return candidate;
    if (specifier.endsWith('.js')) {
        const tsCandidate = path.resolve(dir, specifier.slice(0, -3) + '.ts');
        if (fs.existsSync(tsCandidate))
            return tsCandidate;
    }
    return null;
}
/**
 * Scans a source file and extracts all local relative import and export paths.
 *
 * @param filePath - Absolute or relative path to the source file.
 * @returns Sorted array of resolved local file paths imported or re-exported.
 */
export function extractLocalImports(filePath) {
    if (!fs.existsSync(filePath))
        return [];
    const content = fs.readFileSync(filePath, 'utf-8');
    const imports = [];
    const regex = /(?:import|export)\s+(?:(?:[\s\S]*?from\s+)|)['"](\.[^'"]+)['"]|import\s*\(\s*['"](\.[^'"]+)['"]\s*\)/g;
    for (const match of content.matchAll(regex)) {
        const spec = match[1] ?? match[2];
        if (spec) {
            const resolved = resolveImportTarget(filePath, spec);
            if (resolved && !imports.includes(resolved)) {
                imports.push(resolved);
            }
        }
    }
    return imports.sort();
}
/**
 * Constructs a dependency graph mapping each source file to its imported local files.
 *
 * @param files - Array of source file paths.
 * @returns Map where keys are source file paths and values are arrays of imported local file paths.
 */
export function buildDependencyGraph(files) {
    const graph = new Map();
    for (const file of files) {
        graph.set(file, extractLocalImports(file));
    }
    return graph;
}
/**
 * Analyzes a dependency graph using depth-first search to detect circular import cycles.
 *
 * @param graph - Map of file paths to their imported dependency file paths.
 * @returns Array of cycle paths, where each cycle path is an array of file paths.
 */
export function detectDependencyCycles(graph) {
    const cycles = [];
    const visited = new Set();
    const inStack = new Set();
    const pathStack = [];
    function dfs(node) {
        visited.add(node);
        inStack.add(node);
        pathStack.push(node);
        for (const neighbor of graph.get(node) ?? []) {
            if (!visited.has(neighbor)) {
                dfs(neighbor);
            }
            else if (inStack.has(neighbor)) {
                const startIdx = pathStack.indexOf(neighbor);
                if (startIdx !== -1) {
                    cycles.push([...pathStack.slice(startIdx), neighbor]);
                }
            }
        }
        inStack.delete(node);
        pathStack.pop();
    }
    for (const node of graph.keys()) {
        if (!visited.has(node))
            dfs(node);
    }
    return cycles;
}
function hasLayerSegment(pathStr, segment) {
    return new RegExp(`(^|[/\\\\])${segment}([/\\\\]|$)`, 'i').test(pathStr);
}
/**
 * Evaluates a dependency graph against architectural boundary rules to detect prohibited cross-layer imports.
 *
 * @param graph - Map of file paths to their imported dependency file paths.
 * @param rules - Architectural boundary rules to enforce (defaults to DEFAULT_BOUNDARY_RULES).
 * @returns Array of detected boundary violations.
 */
export function detectBoundaryViolations(graph, rules = DEFAULT_BOUNDARY_RULES) {
    const violations = [];
    for (const [file, imports] of graph.entries()) {
        for (const rule of rules) {
            if (hasLayerSegment(file, rule.fromLayer)) {
                for (const imported of imports) {
                    for (const disallowed of rule.disallowImportsFrom) {
                        if (hasLayerSegment(imported, disallowed)) {
                            violations.push({
                                file,
                                importedFile: imported,
                                fromLayer: rule.fromLayer,
                                toLayer: disallowed
                            });
                        }
                    }
                }
            }
        }
    }
    return violations;
}
/**
 * Inspects a source tree for architectural boundary violations and circular dependency cycles.
 *
 * @param sourceDir - Directory containing source code (e.g. src/).
 * @param rules - Architectural boundary rules.
 * @returns Report summarizing cycle and boundary findings.
 */
export function inspectBoundaries(sourceDir, rules = DEFAULT_BOUNDARY_RULES) {
    const files = findSourceFiles(sourceDir);
    const graph = buildDependencyGraph(files);
    const cycles = detectDependencyCycles(graph);
    const violations = detectBoundaryViolations(graph, rules);
    return {
        moduleCount: files.length,
        cycles,
        violations,
        ok: cycles.length === 0 && violations.length === 0
    };
}
export default {
    DEFAULT_BOUNDARY_RULES,
    findSourceFiles,
    extractLocalImports,
    buildDependencyGraph,
    detectDependencyCycles,
    detectBoundaryViolations,
    inspectBoundaries
};
//# sourceMappingURL=boundaries.js.map
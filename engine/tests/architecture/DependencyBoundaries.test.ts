import { existsSync, readFileSync, readdirSync } from "node:fs";
import { dirname, join, normalize, relative, resolve } from "node:path";

const SOURCE_ROOT = resolve(__dirname, "../../src");

function sourceFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    const path = join(directory, entry.name);
    return entry.isDirectory() ? sourceFiles(path) : entry.name.endsWith(".ts") ? [normalize(path)] : [];
  });
}

function localDependencies(file: string, known: ReadonlySet<string>, runtimeOnly = false): string[] {
  const dependencies = new Set<string>();
  const source = readFileSync(file, "utf8");
  const imports = source.matchAll(/(?:import|export)\s+(type\s+)?(?:[\s\S]*?from\s+)?["']([^"']+)["']/g);
  for (const match of imports) {
    if (runtimeOnly && match[1]) continue;
    const specifier = match[2];
    if (!specifier.startsWith(".")) continue;
    const base = resolve(dirname(file), specifier);
    const resolved = [base + ".ts", join(base, "index.ts")]
      .map(normalize)
      .find(candidate => known.has(candidate) && existsSync(candidate));
    if (resolved) dependencies.add(resolved);
  }
  return [...dependencies];
}

function stronglyConnectedComponents(graph: ReadonlyMap<string, readonly string[]>): string[][] {
  let nextIndex = 0;
  const indices = new Map<string, number>();
  const lowLinks = new Map<string, number>();
  const stack: string[] = [];
  const onStack = new Set<string>();
  const components: string[][] = [];
  const visit = (node: string): void => {
    indices.set(node, nextIndex);
    lowLinks.set(node, nextIndex++);
    stack.push(node);
    onStack.add(node);
    for (const dependency of graph.get(node) ?? []) {
      if (!indices.has(dependency)) {
        visit(dependency);
        lowLinks.set(node, Math.min(lowLinks.get(node)!, lowLinks.get(dependency)!));
      } else if (onStack.has(dependency)) {
        lowLinks.set(node, Math.min(lowLinks.get(node)!, indices.get(dependency)!));
      }
    }
    if (lowLinks.get(node) !== indices.get(node)) return;
    const component: string[] = [];
    let member: string;
    do {
      member = stack.pop()!;
      onStack.delete(member);
      component.push(relative(SOURCE_ROOT, member).replaceAll("\\", "/"));
    } while (member !== node);
    if (component.length > 1) components.push(component.sort());
  };
  for (const node of graph.keys()) if (!indices.has(node)) visit(node);
  return components.sort((left, right) => left.join().localeCompare(right.join()));
}

describe("dependency boundaries (architecture baseline)", () => {
  const files = sourceFiles(SOURCE_ROOT);
  const known = new Set(files);
  const graph = new Map(files.map(file => [file, localDependencies(file, known)]));
  const runtimeGraph = new Map(files.map(file => [file, localDependencies(file, known, true)]));

  it("keeps the runtime import graph acyclic", () => {
    expect(stronglyConnectedComponents(runtimeGraph)).toEqual([]);
  });

  it("does not add lower-layer imports of application modules", () => {
    const violations: string[] = [];
    for (const [file, dependencies] of graph) {
      const from = relative(SOURCE_ROOT, file).replaceAll("\\", "/");
      for (const dependency of dependencies) {
        const to = relative(SOURCE_ROOT, dependency).replaceAll("\\", "/");
        if ((from.startsWith("domain/") && (to.startsWith("core/") || to.startsWith("application/")))
          || (from.startsWith("core/") && to.startsWith("application/"))) {
          violations.push(`${from} -> ${to}`);
        }
      }
    }
    expect(violations.sort()).toEqual([
      "core/movement/MovementSystem.ts -> application/match/action/ActionExecution.ts",
      "core/movement/PlayerMatchState.ts -> application/match/action/ActionExecution.ts",
      "core/movement/PlayerMatchState.ts -> application/match/action/PipelineExecution.ts",
      "core/movement/PlayerMatchState.ts -> application/match/decision/DecisionType.ts",
      "core/movement/PlayerMatchState.ts -> application/match/tactical/intelligence/TacticalIntelligenceTypes.ts",
      "core/movement/PossessionSystem.ts -> application/match/decision/DecisionType.ts",
      "domain/pitch.ts -> core/geometry/Rectangle.ts",
      "domain/shooting.ts -> core/geometry/Vector2.ts",
      "domain/shooting.ts -> core/geometry/Vector3.ts",
    ].sort());
  });
});

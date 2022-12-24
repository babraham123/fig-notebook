import { ScriptResult, UnitTest } from "../shared/types";
import { randomVariableName } from "../shared/utils";

/**
 * Sadly sometimes we mangle the code so much it's difficult to piece it back
 * together for error handling. The job of these "magic comments" is to help
 * highlight parts of the code that are related to the error.
 */
export const MAGIC_LINE_NUMBER_COMMENT = "// __CHECK_FOR_LINE_NUMBER__";
export const MAGIC_RETURN_STATEMENT_COMMENT =
  "// __CHECK_FOR_RETURN_STATEMENT__";

export function findMagicComment(
  codeLines: string[],
  startIdx: number,
  comment = MAGIC_LINE_NUMBER_COMMENT
): number {
  for (let i = startIdx; i < codeLines.length; i++) {
    const line = codeLines[i];
    if (line.indexOf(comment) > -1) {
      return i;
    }
  }
  return -1;
}

export function stripLastSemicolon(code: string): string {
  return code.replace(/;\s*$/, "");
}

/**
 * This is the variable name of the {@link importer} function.
 */
export const MAGIC_SCRIPT_IMPORTER = randomVariableName();

/**
 * These are scoped to the execution environment, and really just call
 * importer(modules, moduleName, wrapInProxy).
 *
 * 'wrapInProxy' will be true for importAll, and false for import.
 *
 * Benefits of this approach:
 * - Codegen doesn't have to worry about this stuff.
 * - We can type-check {@link importer}!
 */
export const MAGIC_SCRIPT_IMPORT = randomVariableName();
export const MAGIC_SCRIPT_IMPORT_ALL = randomVariableName();

/**
 * This is scoped to the execution environment, and is a map of module names to
 * their functions.
 */
export const MAGIC_SCRIPT_MODULES = randomVariableName();

/**
 * These are scoped **per module**, and exportsObj is analogous to
 * `module.exports` in CommonJS.
 *
 * `export` is a function that just does export(name1, value1, name2, value2, ...);
 * if `name_n` is null, it just spreads the value.
 */
export const MAGIC_SCRIPT_EXPORT = randomVariableName();
export const MAGIC_SCRIPT_EXPORTS_OBJ = randomVariableName();

/**
 * This is scoped to the execution environment, and is the function name of the
 * main module.
 */
export const MAGIC_SCRIPT_DEF = randomVariableName();

/**
 * This is the name of the execution environment.
 */
export const MAGIC_SCRIPT_ENV = randomVariableName();

export const MAGIC_IDS = [
  MAGIC_SCRIPT_IMPORT,
  MAGIC_SCRIPT_IMPORT_ALL,
  MAGIC_SCRIPT_EXPORT,
  MAGIC_SCRIPT_EXPORTS_OBJ,
  MAGIC_SCRIPT_MODULES,
  MAGIC_SCRIPT_DEF,
  MAGIC_SCRIPT_IMPORTER,
];

export class RuntimeError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "RuntimeError";
  }
}

/**
 * This lets us access the execution environment from the error handler.
 */
export class WrappedError extends Error {
  funcToString: string;

  constructor(err: Error, func: Function) {
    super(err.message);
    this.name = err.name;
    this.stack = err.stack;
    this.funcToString = func.toString();
  }
}

type Modules = Record<string, () => Promise<unknown>>;

const __importer_cache: WeakMap<
  Modules,
  Record<string, Promise<unknown>>
> = new WeakMap();

function createModuleProxy(moduleName: string, obj: any) {
  // Should be safe to do this since we use Object.freeze below.
  //
  // Make it a Set so we can do fast lookup.
  const keys = new Set<string>(Object.keys(obj));

  return new Proxy(obj, {
    get(target, prop) {
      // This is a really weird case since we return it from a Promise.
      if (prop === "then" && !keys.has(prop)) {
        return;
      }

      if (typeof prop === "symbol" || !keys.has(prop)) {
        // I just stole a similar message from Node.js.
        throw new RuntimeError(
          `The requested module '${moduleName}' does not provide an export named '${String(
            prop
          )}'`
        );
      }
      return target[prop];
    },
  });
}

function importer(
  modules: Modules,
  moduleName: string,
  wrapInProxy: boolean = false
): Promise<unknown> {
  if (!__importer_cache.has(modules)) {
    __importer_cache.set(modules, {});
  }

  const cache = __importer_cache.get(modules)!;
  if (cache[moduleName]) {
    return cache[moduleName];
  }

  const module = modules[moduleName];
  if (!module) {
    throw new RuntimeError(`Module ${moduleName} not found`);
  }

  cache[moduleName] = module();

  if (wrapInProxy) {
    return cache[moduleName].then((obj) => {
      return createModuleProxy(moduleName, obj);
    });
  }

  return cache[moduleName];
}

const MODULE_PREAMBLE = `
const ${MAGIC_SCRIPT_EXPORTS_OBJ} = {};
function ${MAGIC_SCRIPT_EXPORT}(...args) {
  for (let i = 0; i < args.length; i += 2) {
    const key = args[i];
    if (!key) {
      Object.assign(${MAGIC_SCRIPT_EXPORTS_OBJ}, args[i + 1]);
    } else {
      ${MAGIC_SCRIPT_EXPORTS_OBJ}[key] = args[i + 1];
    }
  }
}
`;

/**
 * As implemented in {@link runScript}, module functions are named
 * modules${i}. This helps with error handling.
 */
export function isInModuleScope(name: string): boolean {
  return (
    name.startsWith(MAGIC_SCRIPT_MODULES) &&
    name.length > MAGIC_SCRIPT_MODULES.length
  );
}

export async function runScript(
  bundledModules: Record<string, string>,
  body: string,
  lastStatement: string,
  std: any,
  unitTests?: UnitTest[]
): Promise<ScriptResult> {
  const figma = Object.freeze({
    notebook: Object.freeze(std),
  });

  const modules = Object.entries(bundledModules)
    .map(([name, code], i) => {
      return `[\`${name}\`]: async function ${MAGIC_SCRIPT_MODULES}${i}() {
        ${MODULE_PREAMBLE}
        ${MAGIC_LINE_NUMBER_COMMENT}
        ${code};
        return Object.freeze(${MAGIC_SCRIPT_EXPORTS_OBJ});
      }`;
    })
    .join(",");

  const unitTestVariables = unitTests
    .map((unitTest, index) => {
      const test = unitTest.test.length > 0 ? unitTest.test : "null";
      return `const unitTest${index} = ${test};`;
    })
    .join("\n");

  const validatedUnitTests = unitTests
    .map((unitTest, index) => {
      return `{
      test: "${unitTest.test}",
      passed: unitTest${index}
    }`;
    })
    .join(",");

  const script = `
    async function ${MAGIC_SCRIPT_ENV}() {
      const ${MAGIC_SCRIPT_MODULES} = {};

      function ${MAGIC_SCRIPT_IMPORT}(name) {
        return ${MAGIC_SCRIPT_IMPORTER}(${MAGIC_SCRIPT_MODULES}, name, /* wrapInProxy */ true);
      }

      /**
       * This is very similar to the above one, except it doesn't wrap the object
       * in a proxy. This is to mimick ESM behavior more closely.
       */
      function ${MAGIC_SCRIPT_IMPORT_ALL}(name) {
        return ${MAGIC_SCRIPT_IMPORTER}(${MAGIC_SCRIPT_MODULES}, name);
      }

      Object.assign(${MAGIC_SCRIPT_MODULES}, {${modules}});
      
      async function ${MAGIC_SCRIPT_DEF}() {
          ${MODULE_PREAMBLE}
          ${MAGIC_LINE_NUMBER_COMMENT}
          ${body};
          ${unitTestVariables}
          ${MAGIC_RETURN_STATEMENT_COMMENT}
          return {
            lastStatement: ${stripLastSemicolon(lastStatement)},
            unitTests: [${validatedUnitTests}],
          };
      }

      return await ${MAGIC_SCRIPT_DEF}();
    }

    return ${MAGIC_SCRIPT_ENV}();
`;

  const func = new Function(
    "figma",
    MAGIC_SCRIPT_IMPORTER,
    "__debugGetScript",
    script
  );

  try {
    return await func(figma, importer, script);
  } catch (err) {
    // Rethrow, just wrap the error with relevant information.
    throw new WrappedError(err, func);
  }
}

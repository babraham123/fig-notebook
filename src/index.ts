import * as std from "./iframe/std";
import { format } from "prettier";
// import { loadPyodide } from 'https://pyodide-cdn2.iodide.io/v0.20.0/full/pyodide.mjs';

import { createErrorMessage } from "./iframe/errors";
import { runScript } from "./iframe/runtime";
import { sendMessage, buildMessageHandler, svgToString } from "./iframe/utils";

import { parseAST } from "./iframe/parse_ast";

import { ScriptResult, IFrameMessages } from "./shared/types";
import { bundleBodyAndModules } from "./iframe/bundler";
import { noop } from "./shared/utils";
import { runIntrospection } from "./iframe/introspection/run_introspection";

// Setup for running the script below.
async function sendRunSuccess(result: ScriptResult) {
  const val = result.lastStatement;
  const unitTests = result.unitTests;
  if (val instanceof Element) {
    sendMessage("runsuccess", {
      code: svgToString(val),
      unitTests: unitTests,
      type: "SVG",
    });
  } else if (typeof val === "string") {
    sendMessage("runsuccess", {
      code: val,
      unitTests: unitTests,
      type: "PLAINTEXT",
    });
  } else if (val === undefined) {
    sendMessage("runsuccess", {
      code: "",
      unitTests: unitTests,
      type: "UNDEFINED",
    });
  } else {
    sendMessage("runsuccess", {
      code: JSON.stringify(val, null, 2),
      unitTests: unitTests,
      type: "JSON",
    });
  }
}

async function runHandler({ code, modules, unitTests }: IFrameMessages["run"]) {
  try {
    const { bundledModules, bundledBody, lastStatement } = bundleBodyAndModules(
      code,
      modules
    );

    const result = (await runScript(
      bundledModules,
      bundledBody,
      lastStatement,
      std,
      unitTests
    )) as ScriptResult;

    // If any unit test fails, send a runerror message.
    const unitTestsResult = result.unitTests;
    const failedUnitTests = [];
    unitTestsResult.forEach((unitTest, index) => {
      if (unitTest.test !== "" && unitTest.passed === false) {
        failedUnitTests.push(index + 1);
      }
    });
    const failedUnitTestsStr = failedUnitTests.join(", ");
    if (failedUnitTests.length > 0) {
      const err = {
        name: "Error",
        message: `Test case${
          failedUnitTests.length > 1 ? "s" : ""
        } ${failedUnitTestsStr} failed.`,
      } as Error;
      sendMessage("runerror", {
        errorLike: await createErrorMessage(err, code, modules),
        unitTests: unitTestsResult,
      });
      return;
    }

    sendRunSuccess(result);
  } catch (err) {
    sendMessage("runerror", {
      errorLike: await createErrorMessage(err, code, modules),
      unitTests: unitTests,
    });
  }
}

// TODO: To natively run python, implement a language selector and separate msg types:
// pyrun, pyformat, pyinspect
// Will also need custom bundling to preload cython dependent libraries (numpy, etc) and use
// micropip to install pure python libraries

// async function runPyHandler({ code, modules }: IFrameMessages["run"]) {
//   try {
//     const pyodide = await loadPyodide({ indexURL: 'https://pyodide-cdn2.iodide.io/v0.20.0/full/' });
//     const val = await pyodide.runPythonAsync(code);

//     sendRunSuccess(val);
//   } catch (err) {
//     sendMessage("runerror", await createErrorMessage(err, code, modules));
//   }
// }

async function formatHandler(code: IFrameMessages["format"]) {
  try {
    const ast = parseAST(code);
    const formattedCode = format(code, {
      parser: () => ast,
    });

    // Remove last newline.
    sendMessage("formatsuccess", formattedCode.trim());
  } catch (err) {
    sendMessage("formaterror", await createErrorMessage(err, code));
  }
}

async function introspectionHandler({
  code,
  modules,
}: IFrameMessages["introspection"]) {
  try {
    const { bundledModules, bundledBody, lastStatement, symbols } =
      bundleBodyAndModules(code, modules, true);

    /**
     * This statement turns ['a', 'b'] into { a, b }.
     */
    const fakeLastStatement = "{" + [...symbols].join(", ") + "}";
    const { lastStatement: symbolValueMap } = await runScript(
      bundledModules,
      bundledBody,
      fakeLastStatement,
      std,
      []
    );

    runIntrospection(lastStatement, symbolValueMap);
  } catch (err) {
    sendMessage("runerror", {
      errorLike: await createErrorMessage(err, code, modules),
    });
  }
}

window.onmessage = buildMessageHandler({
  run: import.meta.env.VITE_TARGET === "run" ? runHandler : noop,
  format: import.meta.env.VITE_TARGET === "format" ? formatHandler : noop,
  introspection:
    import.meta.env.VITE_TARGET === "introspection"
      ? introspectionHandler
      : noop,
});

// Send 'ready' message to the plugin.
sendMessage("ready");

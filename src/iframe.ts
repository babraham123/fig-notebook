import md5 from "blueimp-md5";
import { format } from "prettier";
// import { loadPyodide } from 'https://pyodide-cdn2.iodide.io/v0.20.0/full/pyodide.mjs';

import * as std from "./iframe/std";
import { runScript } from "./iframe/runtime";
import { svgToString } from "./iframe/utils";
import { parseAST } from "./iframe/parse_ast";
import { Result, IFrameMessage, CommandType, Obj } from "./shared/types";
import { bundleBodyAndModules } from "./iframe/bundler";
import { noop } from "./shared/utils";
import { runIntrospection } from "./iframe/introspection/run_introspection";

// import.meta.env.VITE_TARGET
const SUPPORTED_MSGS: Record<string, CommandType[]> = {
  editor: ["RUN", "FORMAT", "TEST", "QUERY", "SAVE"],
  run: ["RUN", "TEST"],
};

const HANDLERS: Record<CommandType, (msg: IFrameMessage) => Promise<void>> = {
  STATUS: unsupportedHandler,
  SAVE: saveHandler,
  RUN: runHandler,
  FORMAT: formatHandler,
  TEST: unsupportedHandler,
  QUERY: unsupportedHandler,
};

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

function sendError(err: any, type: CommandType, inputsHash: string, codeHash: string) {
  parent.postMessage({ type, result: {
    output: {
      type: "ERROR",
      data: `${err}` + ("stack" in err && err.stack) ? `\n${err.stack}` : "",
    },
    inputsHash,
    codeHash,
  }}, "*");
}

async function unsupportedHandler(msg: IFrameMessage) {
  console.warn(`In iframe ${import.meta.env.VITE_TARGET} command ${msg.type} is unsupported`);
}

async function runHandler(msg: IFrameMessage) {
  let inputsHash = "";
  for (const input of msg.inputs ?? []) {
    inputsHash += md5(input);
  }
  if (!msg.code) {
    sendError("No code found", "RUN", inputsHash, "");
  }
  const codeHash = md5(`${msg.code.language}:::${msg.code.code}`);

  try {
    let output: Obj | undefined;
    switch (msg.code.language) {
      case "JS":
        output = await runJSHandler(msg);
        break;
      case "PY":
        output = await runPYHandler(msg);
        break;
      default:
        sendError(`Unsupported language: ${msg.code.language}`, "RUN", inputsHash, codeHash);
        return;
    }
    parent.postMessage({ type: "RUN", result: {
      output,
      inputsHash,
      codeHash,
    }}, "*");
  } catch (err: any) {
    sendError(err, "RUN", inputsHash, codeHash);
  }
}

async function runJSHandler(msg: IFrameMessage): Promise<Obj> {
  console.warn("Implement");
}

async function runPYHandler(msg: IFrameMessage): Promise<Obj> {
  console.warn("Implement");
}

async function runHandlerOld(msg: IFrameMessage) {
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

async function formatHandler(msg: IFrameMessage) {
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

// Only handles response
async function saveHandler(msg: IFrameMessage) {
  if (msg.status === "SUCCESS") {
    //
  } else if (msg.status === "FAILURE") {
    //
  } else {
    console.warn(`In command ${msg.type}, status ${msg.status} is unsupported`);
  }
}

window.onmessage = (event: MessageEvent) => {
  if (event.data.type in SUPPORTED_MSGS[import.meta.env.VITE_TARGET]) {
    HANDLERS[event.data.type](event.data);
    return;
  }
  unsupportedHandler(event.data);
};

// Send 'ready' message to the plugin.
parent.postMessage({ type: "STATUS", status: "READY" }, "*");

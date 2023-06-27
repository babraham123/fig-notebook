import md5 from 'blueimp-md5';
// import { loadPyodide } from 'https://pyodide-cdn2.iodide.io/v0.20.0/full/pyodide.mjs';

import * as std from './std';
import { runJSScript, testJSScript, formatJSScript } from './js-runtime';
import { runPYScript, testPYScript, formatPYScript } from './py-runtime';
import { runWasmScript } from './wasm-runtime';
import { PLUGIN_ID, SUPPORTED_MSGS } from '../shared/constants';
import { IFrameMessage, CommandType, Obj } from '../shared/types';
import { print, printErr } from './utils';

// Handlers return the msg that will be sent back to the widget. Type undefined
// will be ignored.
const HANDLERS: Record<CommandType, (msg: IFrameMessage) => Promise<IFrameMessage | undefined>> = {
  INITIATE: ignoreHandler,
  RUN: runHandler,
  FORMAT: formatHandler,
  TEST: testHandler,
  QUERY: unsupportedHandler,
  SAVE: ignoreHandler,
  CLOSE: unsupportedHandler,
};

function newError(err: any, type: CommandType, inputsHash: string, codeHash: string): IFrameMessage {
  return { type, status: 'FAILURE', result: {
    output: {
      type: 'ERROR',
      data: `${err}` + ('stack' in err && err.stack) ? `\n${err.stack}` : '',
    },
    inputsHash,
    codeHash,
  }};
}

async function unsupportedHandler(msg: IFrameMessage): Promise<IFrameMessage | undefined> {
  printErr(`Command ${msg.type} is unsupported`);
  return undefined;
}

async function ignoreHandler(msg: IFrameMessage): Promise<IFrameMessage | undefined> {
  return undefined;
}

async function runHandler(msg: IFrameMessage): Promise<IFrameMessage | undefined> {
  let inputsHash = '';
  for (const input of msg.inputs ?? []) {
    inputsHash += md5(`${input.type}::${input.data}||`);
  }
  if (!msg.code) {
    return newError('No code found', 'RUN', inputsHash, '');
  }
  const codeHash = md5(`${msg.code.language}:::${msg.code.code}`);

  try {
    let output: Obj | undefined;
    switch (msg.code.language) {
      case 'javascript':
        output = await runJSScript(
          msg.code?.code ?? '',
          msg.inputs ?? [],
          std,
        );
        break;
      case 'python':
        output = await runPYScript(
          msg.code?.code ?? '',
          msg.inputs ?? [],
        );
        break;
        case 'wasm':
          output = await runWasmScript(
            msg.code?.code ?? '',
            msg.inputs ?? [],
          );
          break;
      default:
        return newError(`Unsupported language: ${msg.code.language}`, 'RUN', inputsHash, codeHash);
    }
    return { type: 'RUN', status: 'SUCCESS', result: {
      output,
      inputsHash,
      codeHash,
    }};
  } catch (err: any) {
    return newError(err, 'RUN', inputsHash, codeHash);
  }
}

async function testHandler(msg: IFrameMessage): Promise<IFrameMessage | undefined> {
  if (!msg.code?.code) {
    return newError('No code found', 'TEST', '', '');
  }
  if (!msg.code?.testCode) {
    return newError('No test code found', 'TEST', '', '');
  }

  try {
    let output: Obj | undefined;
    switch (msg.code.language) {
      case 'javascript':
        output = await testJSScript(
          msg.code?.code ?? '',
          msg.code?.testCode ?? '',
          std,
        );
        break;
      case 'python':
        output = await testPYScript(
          msg.code?.code ?? '',
          msg.code?.testCode ?? '',
        );
        break;
      case 'wasm':
        printErr('Ignore test cmd: wasm cannot be tested');
        break;
      default:
        return newError(`Unsupported language: ${msg.code.language}`, 'TEST', '', '');
    }
    return { type: 'TEST', status: 'SUCCESS', result: {
      output,
      inputsHash: '',
      codeHash: '',
    }};
  } catch (err: any) {
    return newError(err, 'TEST', '', '');
  }
}

async function formatHandler(msg: IFrameMessage): Promise<IFrameMessage | undefined> {
  if (!msg.code) {
    return newError('No code found', 'FORMAT', '', '');
  }
  try {
    let formattedCode: string | undefined;
    let formattedTestCode: string | undefined;
    switch (msg.code.language) {
      case 'javascript':
        formattedCode = formatJSScript(msg.code?.code ?? '');
        formattedTestCode = formatJSScript(msg.code?.testCode ?? '');
        break;
      case 'python':
        formattedCode = formatPYScript(msg.code?.code ?? '');
        formattedTestCode = formatPYScript(msg.code?.testCode ?? '');
        break;
      case 'wasm':
        printErr('Ignore format cmd: wasm cannot be formatted');
        break;
      default:
        return newError(`Unsupported language: ${msg.code.language}`, 'FORMAT', '', '');
    }
    return { type: 'FORMAT', status: 'SUCCESS', code: {
      language: msg.code.language,
      code: formattedCode,
      testCode: formattedTestCode,
    }};
  } catch (err: any) {
    return newError(err, 'FORMAT', '', '');
  }
}

// Do some processing and then return the result to the React component. Response msg is
// used by the UI code in the editor and ignored in the headless runner.
export async function handleMessage(msg: IFrameMessage): Promise<IFrameMessage | undefined> {
  if (msg.type in SUPPORTED_MSGS[import.meta.env.VITE_TARGET]) {
    if (msg.debug) {
      print(`msg ${msg.type} debug: ${msg.debug}`);
    }
    const resp = await HANDLERS[msg.type](msg);
    if (resp) {
      parent.postMessage(resp, PLUGIN_ID);
    }
    return resp;
  } else {
    await unsupportedHandler(msg);
    return undefined;
  }
}

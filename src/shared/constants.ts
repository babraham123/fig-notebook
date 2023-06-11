// Used by both widget and iframe modules

import { Obj, AppState, Code, Result } from './types'
import manifest from '../../manifest.json';

export const PLUGIN_ID = '*'; // manifest.id;
// TODO: swap for more security

export const EMPTY_OBJ: Obj = {
  type: 'UNDEFINED',
  data: '',
};

export const DEFAULT_APP_STATE: AppState = {
  title: 'Example Script',
  codeWindow: {
    width: 500,
    height: 500,
  },
  previewWindow: {
    width: 1000,
    height: 600,
  },
};

export const DEFAULT_CODE: Code = {
  language: 'javascript',
  code: `// imports

// helper functions

async function run(inputs) {
  // code

  return {
    type: 'TEXT', // 'TEXT' | 'JSON' | 'CSV' | 'SVG' | 'BINARY' | 'ERROR' | 'UNDEFINED'
    data: 'hello, world'
  };
}`,
  testCode: `// imports

// helper functions

async function test() {
  // setup and mocks

  const output = await run(fakeInputs);

  // asserts
}`,
};

export const DEFAULT_RESULT: Result = {
  output: EMPTY_OBJ,
  inputsHash: '',
  codeHash: 'd1daa1a319842d3d053a4f5abb5055d0',
};

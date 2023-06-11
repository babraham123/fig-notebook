import { Obj } from '../shared/types';
import { EMPTY_OBJ } from '../shared/constants';

// Pyodide
// Or https://openerp-web-v7.readthedocs.io/en/stable/

export async function runPYScript(
    code: string,
    inputs: Obj[],
  ): Promise<Obj> {
    console.error('TODO: Implement');
    return EMPTY_OBJ;

  // Will also need custom bundling to preload cython dependent libraries (numpy, etc) and use
  // micropip to install pure python libraries.

  try {
    // const pyodide = await loadPyodide({ indexURL: 'https://pyodide-cdn2.iodide.io/v0.20.0/full/' });
    // return await pyodide.runPythonAsync(code);
  } catch (err) {
    // Rethrow, just wrap the error with relevant information.
    err.message = `Error in python code: ${err.message}`;
    throw err;
  }
}

export async function testPYScript(
  code: string,
  testCode: string,
): Promise<Obj> {
  console.error('TODO: Implement');
  return EMPTY_OBJ;

  // Will also need custom bundling to preload cython dependent libraries (numpy, etc) and use
  // micropip to install pure python libraries.
  const wrappedCode = `
    ${code}
    ${testCode}
    return test();
`;

  try {
    // const pyodide = await loadPyodide({ indexURL: 'https://pyodide-cdn2.iodide.io/v0.20.0/full/' });
    // return await pyodide.runPythonAsync(wrappedCode);
  } catch (err) {
    // Rethrow, just wrap the error with relevant information.
    err.message = `Error in python code: ${err.message}`;
    throw err;
  }
}

export function formatPYScript(code: string): string {
  console.error('TODO: Implement');
  return code;

  // TODO: use https://github.com/psf/black
}

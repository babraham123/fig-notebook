Fig Notebook
===
Javascript code notebooks in Figjam.

I build upon the work done by previous widgets, mainly Michael Bullington's Code Notebooks and Cameron Yick's p5.js Pad.

## Quick start
Open up the widget in a FigJam file, press the `edit` button and try the following sample code:
```
// imports

// helper functions

async function run(inputs) {
  // code

  return {
    type: "TEXT", // "TEXT" | "JSON" | "CSV" | "SVG" | "BINARY" | "ERROR" | "UNDEFINED"
    data: "hello, world"
  };
}
```

Test code:
```
// imports

// helper functions

async function test() {
  // setup and mocks

  const output = await run(fakeInputs);

  // asserts
}
```

## Development
The quickest way to build your widget during development is by running:
```sh
npm run watch
```

This command starts the follow in watch mode:
1. typechecking for src
2. building for src

While this command is running, any changes to `src/code.tsx` will be compiled into the `dist/code.js` file that is referenced by the manifest.json.

### Importing your widget
1. "Import widget from manifest"
2. Build code `npm run build`
3. Choose your manifest.json

### Code organization
| dir / path               | description                          |
| ------------------------ | ------------------------------------ |
| src/iframe               | This is where the iframe code lives  |
| src/iframe/index.html    | Main entry point for the iframe code |
| src/widget/              | This is where the widget code lives  |
| src/widget/main.tsx      | Main entry point for the widget code |
| dist/                    | Built output goes here               |

- The widget code uses esbuild to bundle `main.tsx` into one file.
- The iframe code uses a tool called [vite](https://vitejs.dev/) to bundle everything into a single html file.

### Documentation
https://www.figma.com/widget-docs


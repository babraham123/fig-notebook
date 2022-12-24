Fig Notebook
===
Javascript code notebooks in Figjam.

I build upon the work done by previous widgets, mainly Michael Bullington\'s Code Notebooks and Cameron Yick\'s p5.js Pad.

### Importing your widget
1. "Import widget from manifest"
2. Build code `npm run build`
3. Choose your manifest.json

## Development
The quickest way to build your widget during development is by running:
```sh
npm run dev
```

This command starts the follow in watch mode:
1. typechecking for src
2. building for src

While this command is running, any changes to `src/code.tsx` will be compiled into the `dist/code.js` file that is referenced by the manifest.json.

## Documentation
https://www.figma.com/widget-docs


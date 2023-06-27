import React, {
  useEffect,
  useRef,
  useCallback,
  useState,
  useMemo,
} from "react";
import SplitPane from "react-split-pane";
import Editor, { OnChange, Monaco } from "@monaco-editor/react";
import type { editor } from "monaco-editor";
import copy from "copy-to-clipboard";

import { createBlob, createObjectURL } from "blob-util";
import {
  PLUGIN_ID,
  DEFAULT_APP_STATE,
  DEFAULT_CODE,
  DEFAULT_RESULT,
  EMPTY_OBJ,
} from "../../shared/constants";
import { print } from '../utils';
import {
  AppState,
  Obj,
  IFrameMessage,
  Language,
  Code,
  Result,
} from "../../shared/types";
import { handleMessage } from "../messages";

import "./editor-app.css";

const PREVIEW_HTML = `
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>p5js Sketch Preview</title>
  </head>

  <body id="root">
  </body>
</html>
`;

function openInNewTab(url: string) {
  var win = window.open(url, "_blank");
  win?.focus();
}

interface EditorAppProps {
  appState: AppState;
  code: Code;
  inputs: Obj[];
  result: Result;
  testOutput: Obj;
}

function EditorApp(props: EditorAppProps) {
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const editorRef = useRef<editor.IStandaloneCodeEditor | null>(null);

  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [appState, setAppState] = useState<AppState>(props.appState);
  const [code, setCode] = useState<Code>(props.code);
  // TODO: Use setPreviewSrc to update the preview with new results / errors
  const [previewSrc, setPreviewSrc] = useState(PREVIEW_HTML);

  useEffect(() => {
    setAppState(props.appState);
    setCode(props.code);
  }, [props.appState, props.code]);

  useEffect(() => {
    setHasUnsavedChanges(true);
  }, [appState, code]);

  const handleOnSave = useCallback(() => {
    print("try to save");
    const saveMsg: IFrameMessage = {
      type: "SAVE",
      appState,
      code,
      result: props.result,
    };
    parent.postMessage(saveMsg, PLUGIN_ID);
    setHasUnsavedChanges(false);
  }, [appState, code]);

  const handleOnRun = useCallback(() => {
    print("try to run");
    const runMsg: IFrameMessage = {
      type: "RUN",
      code,
    };
    window.postMessage(runMsg, PLUGIN_ID);
    setHasUnsavedChanges(true); // results will have changed
  }, [appState, code]);

  const handleCodeChange: OnChange = (value: string | undefined) => {
    // setHasUnsavedChanges(true);
    if (value) {
      setCode({
        language: code.language,
        code: value,
        testCode: code.testCode,
      });
    }
  };
  const handleTestCodeChange: OnChange = (value: string | undefined) => {
    // setHasUnsavedChanges(true);
    if (value) {
      setCode({
        language: code.language,
        code: code.code,
        testCode: value,
      });
    }
  };

  // Callback that calls monaco editor ref autoformatter
  // Currently does not work :(
  const handleAutoFormat = useCallback(() => {
    print("try to format");
    if (editorRef.current) {
      editorRef.current.getAction("editor.action.formatDocument").run();
    }
  }, [editorRef]);

  // https://microsoft.github.io/monaco-editor/playground.html#interacting-with-the-editor-adding-an-action-to-an-editor-instance
  const handleMount = useMemo(() => {
    function localMount(editor: editor.IStandaloneCodeEditor, monaco: Monaco) {
      editorRef.current = editor;

      // function executeCode() {
      //   return {
      //     id: "run-code",
      //     label: "Run code",
      //     keybindings: [monaco.KeyMod.CtrlCmd | monaco.KeyCode.Enter],
      //     run(edt: editor.IStandaloneCodeEditor) {
      //       print("Running from editor");
      //       try {
      //         const maybeModel = edt.getModel();
      //         if (maybeModel) {
      //           const value = maybeModel.getValue();
      //           setCode({
      //             language: code.language,
      //             code: value,
      //             testCode: code.testCode,
      //           });
      //           modifyIframeSource(value);
      //         }
      //       } catch (e) {
      //         console.warn("Something went wrong while trying to get code value");
      //         printErr(e);
      //       }
      //     },
      //   };
      // }

      function executeCode() {
        return {
          id: "run-code",
          label: "Run code",
          keybindings: [monaco.KeyMod.CtrlCmd | monaco.KeyCode.Enter],
          run(edt: editor.IStandaloneCodeEditor) {
            handleOnRun();
          },
        };
      }
      editor.addAction(executeCode());
      
      function executeSave() {
        return {
          id: "save-code",
          label: "Save code",
          keybindings: [monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS],
          run(edt: editor.IStandaloneCodeEditor) {
            handleOnSave();
          },
        };
      }
      editor.addAction(executeSave());

      editor.addAction({
        id: "autoformat",
        label: "Autoformat",
        keybindings: [
          monaco.KeyMod.CtrlCmd | monaco.KeyMod.Shift | monaco.KeyCode.KeyF,
        ],
        run(edt: editor.IStandaloneCodeEditor) {
          editor.getAction("editor.action.formatDocument").run();
        },
      });
    }

    return localMount;
  }, []);

  const codePane = (
    <div>
      <div>
        <Editor
          height="90vh"
          defaultLanguage={code.language}
          value={code.code}
          onChange={handleCodeChange}
          onMount={handleMount}
        />
      </div>

      <div style={{ marginLeft: 10, width: "100%", marginTop: 12 }}>
        <button type="button" className="play" onClick={handleOnRun}>
          Play
        </button>
        <button type="button" className="format" onClick={handleAutoFormat}>
          Tidy
        </button>
        <button type="button" className="save" onClick={handleOnSave}>
          {" "}
          {hasUnsavedChanges ? "Save (unsaved changes)" : "Close"}
        </button>

        {/* <div style={{ float: "right", marginRight: 20 }}>
          <Button
            style={{ marginLeft: 8 }}
            onClick={() => {
              setIsControlPanelHidden(!isControlPanelHidden);
            }}
          >
            Settings
          </Button>
          https://www.radix-ui.com/docs/primitives/components/dropdown-menu
          https://codesandbox.io/s/dhe28?file=/src/App.js:15280-15795
        </div> */}
      </div>
    </div>
  );

  // const [inputPaneRef, inputPaneDims] = useDimensions();

  const previewPane = (
    <div style={{ width: "100%" }}>
      <iframe
        src={previewSrc}
        ref={iframeRef}
        // style={props.previewDimensions}
        frameBorder="0"
        // width="100%"
        width={appState.previewWindow.width}
        height={appState.previewWindow.height}
      />
    </div>
  );

  return (
    <div className="App">
      <SplitPane
        split="vertical"
        minSize={250}
        defaultSize={appState.codeWindow.width}
        primary="first"
        // onChange={(size) => setCodeWidth(size)} // TODO: setAppState
      >
        {codePane}
        {previewPane}
      </SplitPane>
    </div>
  );
}

const AppContainer: React.FC<{}> = () => {
  const [appState, setAppState] = useState<AppState>(DEFAULT_APP_STATE);
  const [code, setCode] = useState<Code>(DEFAULT_CODE);
  const [inputs, setInputs] = useState<Obj[]>([]);
  const [result, setResult] = useState<Result>(DEFAULT_RESULT);
  const [testOutput, setTestOutput] = useState<Obj>(EMPTY_OBJ);

  useEffect(() => {
    window.addEventListener(
      "message",
      async (event: MessageEvent<any>) => {
        if (!event?.data?.type) {
          return;
        }
        const msg = event.data as IFrameMessage;
        const resp = await handleMessage(msg);
        
        if (['INITIATE', 'RUN', 'FORMAT'].includes(msg.type)) {
          if (resp.appState || msg.appState) {
            setAppState(resp.appState ?? msg.appState);
          }
          if (resp.code || msg.code) {
            setCode(resp.code ?? msg.code);
          }
          if (msg.inputs) {
            setInputs(msg.inputs);
          }
          if (resp.result || msg.result) {
            setResult(resp.result ?? msg.result);
          }
        } else if (msg.type === 'SAVE') {
          const txt = `Save was a ${msg.status}`;
          // TODO: Create popup
        } else if (msg.type === 'TEST') {
          setTestOutput(resp.result?.output ?? EMPTY_OBJ);
        } else {
          print(`Message type ${msg.type}, status ${msg.status}`);
        }
      },
      false
    );

    window.addEventListener('resize',
      () => {
        const ratio = 0.5; // TODO: Calculate this
        setAppState({
          ...appState,
          codeWindow: {
            width: Math.round(ratio * window.innerWidth),
            height: window.innerHeight,
          },
          previewWindow: {
            width: Math.round((1.0 - ratio) * window.innerWidth),
            height: window.innerHeight,
          },
        });
      }
    );
    // Send 'ready' msg to the plugin.
    parent.postMessage({ type: "INITIATE" }, PLUGIN_ID);
  }, []); // initial render only

  return <EditorApp
    appState={appState}
    code={code}
    inputs={inputs}
    result={result}
    testOutput={testOutput}
  />;
};

export default AppContainer;

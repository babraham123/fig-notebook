import * as FigmaSelector from "./vendor/figma-selector";

import {
  getPrevCodeBlock,
  getPrevFrame,
  insertCodeBlock,
  insertFrame,
  getNamedNodeModules,
  serializeNode,
  NamedCanvasNodeImports,
  buildConnectors,
  parseImportStatementsFromCode,
  hashNodeIdToColorWithOpacity,
} from "./utils";


import { EMPTY_OBJ, DEFAULT_CODE, DEFAULT_RESULT } from "../shared/constants";
import { ObjType, IFrameMessage, Code, Result } from "../shared/types";

type PropertyType = "EDIT" | "RUN" | "STOP";

const { AutoLayout, Input, Text, Rectangle, SVG, Ellipse } = figma.widget;
const { usePropertyMenu, useSyncedState, useWidgetId } = figma.widget;

function Widget() {
  const widgetId = useWidgetId();

  const [code, setCode] = useSyncedState<Code>("code", DEFAULT_CODE);
  const [running, setRunning] = useSyncedState("running", false);
  const [result, setResult] = useSyncedState<Result>("result", DEFAULT_RESULT);
  const [inputNodeIds, setInputNodeIds] = useSyncedState<string[]>("inputNodeIds", []);

  function handleMsg(msg: IFrameMessage, resolveFunc: () => void) {
    if (msg?.status) {
      console.log(`iframe status: ${msg.status}`);
    }
    if (msg?.command) {
      console.error(`Incorrectly sent a command from iframe: ${msg.command}`);
    }
    if (msg?.code) {
      setCode(msg.code);
    }
    if (msg?.inputs) {
      console.error(`Incorrectly sent inputs from iframe: ${msg.inputs[0].type}`);
    }
    if (msg?.result) {
      setResult(msg.result);
      setRunning(false);
      // figma.notify("Notebook error: " + errorLike.message);
      resolveFunc();
    }
    if (msg?.nodeQuery) {
      const {selector, id} = msg.nodeQuery;
      const rootNode = !id ? figma.currentPage : figma.getNodeById(id);
      const nodes = FigmaSelector.parse(selector, rootNode);
      const serializedNodes = nodes.map((node) => serializeNode(node));
      figma.ui.postMessage({
        nodes: serializedNodes,
      });
    }
    if (msg?.nodes) {
      console.error(`Incorrectly sent nodes from iframe: ${msg.nodes.length}`);
    }
    if (msg?.debug) {
      console.log(msg.debug);
    }
  }

  function handlePropertyMenu({ propertyName }: { propertyName: PropertyType }): Promise<void> {
    if (propertyName === "STOP") {
      setRunning(false);
      figma.ui.close();
      figma.closePlugin();
      return;
    }

    return new Promise<void>((resolve) => {
      figma.ui.close();
      figma.ui.onmessage = (msg) => {
        if (msg.status === "READY") {
          // Only send code after we're ready.
          setRunning(true);
          setLastRanBy(figma.currentUser.name);

          // collect inputs

          // Send commands
          if (propertyName === "RUN") {
            figma.ui.postMessage({ command: "RUN", code, inputs });
          }
        }
        // handle responses
        handleMsg(msg, resolve);
      };

      // Display results
      let htmlStr = "";
      let visible = false;
      // size = [undefined, undefined];  // fullscreen?
      if (propertyName === "EDIT") {
        htmlStr = __uiFiles__.edit;
        visible = true;
      } else if (propertyName === "RUN") {
        htmlStr = __uiFiles__.run;
      }

      figma.showUI(htmlStr, {
        visible,
        title: "Program module",
      });
    });
  }

  usePropertyMenu(
    [
      {
        itemType: "action",
        propertyName: !running ? "RUN" : "STOP",
        tooltip: !running ? "Run code" : "Stop execution",
        icon: !running ? icons.play : icons.stop,
      },
      {
        itemType: "action",
        propertyName: "EDIT",
        tooltip: "Edit",
      },
    ],
    handlePropertyMenu
  );

  return (
    <AutoLayout
      direction="vertical"
      cornerRadius={metrics.cornerRadius}
      fill={colors.bg}
      effect={shadows}
      stroke={colors.stroke}
      strokeWidth={1}
    >
      {Boolean(
        lastEditedBy ||
          <Rectangle width={1} height={metrics.padding} />}
      {Boolean(lastRanBy) && (
        <AutoLayout
          padding={metrics.detailPadding}
          fill={colors.bgDetail}
          width={metrics.width}
          verticalAlignItems="center"
          spacing={metrics.padding}
        >
          <Text fill={colors.textDetail}>{`Last ran by ${lastRanBy}`}</Text>
          <Rectangle width="fill-parent" height={1} />
          {running && <Badge style={badges.running}>Running</Badge>}
          {!running && !hasError && (
            <Badge style={badges.successful}>Successful</Badge>
          )}
          {!running && hasError && (
            <Button
              style={toggleError ? buttons.errorOpen : buttons.error}
              onClick={handleToggleError}
            >
              {toggleError ? "Hide error" : "Show error"}
            </Button>
          )}
          <AutoLayout
            fill={colors.bgDetail}
            verticalAlignItems="center"
            spacing={metrics.unitTestSpacing}
          >
            <SVG
              src={icons.add.replace(
                /white/g,
                colors.textDetail
              )}
              onClick={() => {
                addUnitTest()
              }}
              tooltip={"Add test case"}
            />
            <SVG
              src={(!running ? icons.play : icons.stop).replace(
                /white/g,
                colors.textDetail
              )}
              onClick={() =>
                handlePropertyMenu({
                  propertyName: running ? "stopExecution" : "runCode",
                })
              }
              tooltip={!running ? "Run code" : "Stop execution"}
            />
          </AutoLayout>
        </AutoLayout>
      )}
      {hasError && toggleError && (
        <AutoLayout padding={metrics.padding} fill={colors.bgError}>
          <ErrorStack error={lastRanError} />
        </AutoLayout>
      )}
    </AutoLayout>
  );
}

figma.widget.register(Widget);

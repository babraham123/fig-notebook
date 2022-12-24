import * as FigmaSelector from "./vendor/figma-selector";

import { Button } from "./components/Button";
import { ErrorStack } from "./components/ErrorStack";

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


import { ObjType, EMPTY_OBJ, IFrameMessage, Code, Result } from "../shared/types";
import { Badge } from "./components/Badge";
// import { ImportDeclaration } from "meriyah/dist/src/estree";

type PropertyType = "EDIT" | "RUN" | "STOP";

const { AutoLayout, Input, Text, Rectangle, SVG, Ellipse } = figma.widget;
const { usePropertyMenu, useSyncedState, useWidgetId } = figma.widget;

async function addAdjacentCodeNotebook(widgetId: string) {
  const selection = figma.getNodeById(widgetId);
  if (!selection || selection.type !== "WIDGET") {
    return;
  }

  const newX = selection.x + selection.width + metrics.resultSpacing;
  const newY = selection.y;

  const position: [number, number] = [newX, newY];
  let adjacentPosition: [number, number] = position;

  const prevCodeBlock = getPrevCodeBlock(widgetId, position);
  if (prevCodeBlock) {
    adjacentPosition = [
      prevCodeBlock.x + prevCodeBlock.width + metrics.resultSpacing,
      prevCodeBlock.y,
    ];
  } else {
    const prevFrame = getPrevFrame(widgetId, position);
    if (prevFrame) {
      adjacentPosition = [
        prevFrame.x + prevFrame.width + metrics.resultSpacing,
        prevFrame.y,
      ];
    }
  }

  const node = selection.cloneWidget({
    code: "",
    running: false,
    lastRanBy: "",
    toggleNaming: false,
    naming: "",
    usedModules: Object.create(null),
    usedByModules: Object.create(null),
  });

  node.relativeTransform = [
    [1, 0, adjacentPosition[0]],
    [0, 1, adjacentPosition[1]],
  ];

  figma.currentPage.appendChild(node);
  figma.viewport.scrollAndZoomIntoView([node]);
  figma.currentPage.selection = [node];
}

function GetInputs(widgetId: string): Obj[] {
  const selection = figma.getNodeById(widgetId);
  if (!selection || selection.type !== "WIDGET") {
    return [];
  }

  // Search ConnectorNodes
}

async function setResult(widgetId: string, code: string, type: CodeTypes) {
  const selection = figma.getNodeById(widgetId);
  if (!selection || selection.type !== "WIDGET") {
    return;
  }

  const newX = selection.x + selection.width + metrics.resultSpacing;
  const newY = selection.y;
  const position: [number, number] = [newX, newY];

  const prevCodeBlock = getPrevCodeBlock(widgetId, position);
  const prevFrame = getPrevFrame(widgetId, position);

  if (type !== "PLAINTEXT" && type !== "JSON") {
    prevCodeBlock?.remove();
  }

  // It's simpler just to remove the previous SVG frame and replace it with a new one.
  prevFrame?.remove();

  // Mark new node to add plugin data to.
  let newNode: SceneNode | null = null;

  switch (type) {
    case "PLAINTEXT":
    case "JSON":
      // Load font for codeblocks. (it'll yell otherwise)
      await figma.loadFontAsync({ family: "Source Code Pro", style: "Medium" });

      if (prevCodeBlock) {
        prevCodeBlock.code = code;
        // TODO: Once a plaintext syntax coloring is added, add it here.
        prevCodeBlock.codeLanguage = type === "JSON" ? "JSON" : "TYPESCRIPT";
      } else {
        newNode = insertCodeBlock(widgetId, position, code);
      }
      break;
    case "SVG":
      newNode = insertFrame(widgetId, position, figma.createNodeFromSvg(code));
      break;
  }

  // If the newNode isn't null, set plugin data to it for 'findWidgetsOfTypeWithWidgetId'.
  newNode?.setPluginData("widgetId", widgetId);
}

function Widget() {
  const widgetId = useWidgetId();

  const [code, setCode] = useSyncedState<Code>("code", {code: "", testCode: ""});
  const [running, setRunning] = useSyncedState("running", false);
  const [lastRanBy, setLastRanBy] = useSyncedState("lastRanBy", "");
  const [lastEditedBy, setLastEditedBy] = useSyncedState("lastEditedBy", "");
  const [result, setResult] = useSyncedState<Result>(
    "result",
    { output: EMPTY_OBJ, inputsHash: "" }
  );
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
      setLastEditedBy(figma.currentUser.name);
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

type UnitTestProps = {
  unitTest: UnitTest
  index: number
}

function UnitTest({ unitTest, index }: UnitTestProps) {
  const { setUnitTest, removeUnitTest } = useUnitTests()

  function handleRemoveUnitTest() {
    removeUnitTest(index)
  }

  return (
    <AutoLayout
      direction="vertical"
      fill={colors.bgDetail}
      width={metrics.width}
      spacing={metrics.padding}
    >
      <AutoLayout
        verticalAlignItems="center"
        spacing={metrics.unitTestSpacing}
      >
        <Text>Test case {index + 1}</Text>
        {unitTest.passed !== null && <SVG src={(unitTest.passed ? icons.checkmark : icons.x )} />}
        <AutoLayout
          horizontalAlignItems="end"
          spacing={metrics.unitTestSpacing}
          padding={unitTest.passed !== null ? metrics.unitTestWithPassedPadding : metrics.unitTestWithoutPassedPadding}
        >
          <Button
            style={buttons.errorOpen}
            onClick={handleRemoveUnitTest}
          >
            Remove
          </Button>
        </AutoLayout>
      </AutoLayout>
      <AutoLayout
        fill={colors.bg}
        effect={[shadows[shadows.length - 1]]}
        padding={metrics.buttonPadding}
        stroke={colors.stroke}
        strokeWidth={1}
        cornerRadius={metrics.cornerRadius}
      >
        <Input
          value={unitTest.test}
          onTextEditEnd={(e) => {
            setUnitTest(index, { test: e.characters, passed: unitTest.passed })
          }}
          width={metrics.unitTestWidth}
          inputBehavior="wrap"
          fill={colors.text}
          fontFamily={fontFamily}
          placeholder="func(inputs) === expected"
          placeholderProps={{
            fill: colors.placeholder,
            fontFamily,
          }}
        />
      </AutoLayout>
      <Rectangle width="fill-parent" height={1} />
    </AutoLayout>
  )
}

figma.widget.register(Widget);

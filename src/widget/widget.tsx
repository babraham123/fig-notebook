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
  print,
  printErr,
} from "./utils";
import { metrics, colors } from "./tokens";
import { Badge } from "./components/Badge";
import { Button } from "./components/Button";
import { icons } from "../shared/icons";
import {
  EMPTY_OBJ,
  DEFAULT_CODE,
  DEFAULT_RESULT,
  SUPPORTED_MSGS,
} from "../shared/constants";
import { ObjType, IFrameMessage, Code, Result, CommandType } from "../shared/types";

type IFrameStatus = "UNINITIALIZED" | "IDLE" | "RUNNING" | "EDITING";
type ResultStatus = "EMPTY" | "SUCCESS" | "ERROR";

const { AutoLayout, Text, Rectangle, useSyncedState, useWidgetId, useEffect } = figma.widget;

async function unsupportedHandler(msg: IFrameMessage): Promise<IFrameMessage | undefined> {
  printErr(`In widget, command ${msg.type} is unsupported`);
  return undefined;
}

async function ignoreHandler(msg: IFrameMessage): Promise<IFrameMessage | undefined> {
  return undefined;
}

function Widget() {
  const widgetId = useWidgetId();

  const [title, setTitle] = useSyncedState<string>("title", "untitled");
  // const [inputNodeIds, setInputNodeIds] = useSyncedState<string[]>("inputNodeIds", []);
  const [iframeStatus, setIFrameStatus] = useSyncedState("iframeStatus", "UNINITIALIZED"); // How to prevent editing on close?
  const [resultStatus, setResultStatus] = useSyncedState("resultStatus", "EMPTY");

  const HANDLERS: Record<CommandType, (msg: IFrameMessage) => Promise<IFrameMessage | undefined>> = {
    INITIATE: isReadyHandler,
    RUN: saveHandler,
    FORMAT: unsupportedHandler,
    TEST: unsupportedHandler,
    QUERY: queryHandler,
    SAVE: saveHandler,
    CLOSE: closeHandler,
  };

  // Modifies the React component. Response msg is sent to both the headless runner and
  // the editor, if present.
  async function handleMessage(msg: IFrameMessage): Promise<void> {
    if (msg.type in SUPPORTED_MSGS['widget']) {
      if (msg.debug) {
        print(`msg ${msg.type} debug: ${msg.debug}`);
      }
      const resp = await HANDLERS[msg.type](msg);
      if (resp) {
        figma.ui.postMessage(resp);
      }
    } else {
      await unsupportedHandler(msg);
    }
  }

  function addMsgListener() {
    window.addEventListener(
      "message",
      async (event: MessageEvent<any>) => {
        if (!event?.data?.type) {
          return;
        }
        const msg = event.data as IFrameMessage;
        await handleMessage(msg);
      },
      false
    );
  }

  function isReadyHandler(msg: IFrameMessage): Promise<IFrameMessage | undefined> {
    setIFrameStatus("IDLE");
    return undefined;
  }

  function saveHandler(msg: IFrameMessage): Promise<IFrameMessage | undefined> {
    if (msg?.code) {
      // TODO: save
    }
    if (msg?.appState) {
      // TODO: save
      setTitle(msg.appState.title);
    }
    if (msg?.result) {
      // TODO: save
      if (msg.result.output.type === "ERROR") {
        setResultStatus("ERROR");
        // figma.notify("Notebook error: " + errorLike.message);
      } else {
        setResultStatus("SUCCESS");
      }
    }
    return undefined;
  }

  function queryHandler(msg: IFrameMessage): Promise<IFrameMessage | undefined> {
    if (msg?.nodes) {
      printErr(`Incorrectly sent nodes from iframe: ${msg.nodes.length}`);
    }
    let serializedNodes: any[] = [];
    if (msg?.nodeQuery) {
      const {selector, id} = msg.nodeQuery;
      const rootNode = !id ? figma.currentPage : figma.getNodeById(id);
      const nodes = FigmaSelector.parse(selector, rootNode);
      serializedNodes = nodes.map((node) => serializeNode(node));
    }
    return Promise.resolve({
      type: "QUERY",
      nodeQuery: msg.nodeQuery,
      nodes: serializedNodes,
    });
  }

  function closeHandler(msg: IFrameMessage): Promise<IFrameMessage | undefined> {
    closeIFrame();
    return undefined;
  }

  function closeIFrame(): void {
    figma.ui.close();
    figma.closePlugin();
    setIFrameStatus("UNINITIALIZED");
  }

  function handleEditBtn(): void {
    setIFrameStatus("EDITING");
    addMsgListener();
    figma.showUI(__uiFiles__.edit, {
      visible: true,
      title: "Code editor",
    });
  }

  function handlePlayBtn(): void {
    setIFrameStatus("RUNNING");
    addMsgListener();
    figma.showUI(__uiFiles__.run, {
      visible: false,
      title: "Code runner",
    });
  }

  return (
    <AutoLayout
      direction="vertical"
      cornerRadius={metrics.cornerRadius}
      fill={colors.bg}
      stroke={colors.stroke}
      strokeWidth={1}
    >
      <AutoLayout
        padding={metrics.detailPadding}
        fill={colors.bgDetail}
        width={metrics.width}
        verticalAlignItems="center"
        spacing={metrics.padding}
      >
        <Text fontSize={32} horizontalAlignText="center">{title}</Text>
        <Rectangle width="fill-parent" height={1} />
        <Button
          name="edit"
          onClick={handleEditBtn}
          enabled={["UNINITIALIZED", "IDLE"].includes(iframeStatus)}
        ></Button>
        <Button
          name="play"
          onClick={handlePlayBtn}
          enabled={["UNINITIALIZED", "IDLE", "EDITING"].includes(iframeStatus)}
        ></Button>
        <Button
          name="pause"
          onClick={closeIFrame}
          enabled={iframeStatus === "RUNNING"}
        ></Button>
        {
          ["RUNNING", "EDITING"].includes(iframeStatus) &&
          <Badge name={iframeStatus.toLowerCase()}></Badge>
        }
        {
          ["SUCCESS", "ERROR"].includes(resultStatus) &&
          <Badge name={resultStatus.toLowerCase()}></Badge>
        }
      </AutoLayout>
    </AutoLayout>
  );
}

figma.widget.register(Widget);

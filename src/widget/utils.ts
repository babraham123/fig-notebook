import md5 from "blueimp-md5";
import { ErrorLike } from "../shared/types";

const NON_ERROR: ErrorLike = {
  name: "",
  stack: "",
  message: "",
};

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

export function findWidgetsOfTypeWithWidgetId<T extends NodeType>(
  type: T,
  widgetId: string
): ({ type: T } & SceneNode)[] {
  return figma.currentPage
    .findAllWithCriteria({ types: [type] })
    .filter((node) => {
      if (node.getPluginData("widgetId") !== widgetId) {
        return false;
      }
      return true;
    });
}

export function getPrevCodeBlock(
  widgetId: string,
  position: [number, number]
): CodeBlockNode | null {
  // Try to find our code block first by the plugin data widgetId, then by the
  // relative position.
  const prevCodeBlocks = findWidgetsOfTypeWithWidgetId(
    "CODE_BLOCK",
    widgetId
  ).filter((node) => node.x === position[0] && node.y === position[1]);

  if (prevCodeBlocks.length > 0) {
    return prevCodeBlocks[0];
  }

  return null;
}

export function insertCodeBlock(
  widgetId: string,
  position: [number, number],
  code: string
) {
  const codeBlock = figma.createCodeBlock();
  codeBlock.code = code;
  codeBlock.codeLanguage = "JSON";

  codeBlock.x = position[0];
  codeBlock.y = position[1];
  figma.currentPage.appendChild(codeBlock);

  return codeBlock;
}

export function getPrevFrame(
  widgetId: string,
  position: [number, number]
): FrameNode | null {
  // Try to find our code block first by the plugin data widgetId, then by the
  // relative position.
  const prevFrames = findWidgetsOfTypeWithWidgetId("FRAME", widgetId).filter(
    (node) => node.x === position[0] && node.y === position[1]
  );

  if (prevFrames.length > 0) {
    return prevFrames[0];
  }

  return null;
}

export function insertFrame(
  widgetId: string,
  position: [number, number],
  node: SceneNode
) {
  const frame = figma.createFrame();

  frame.cornerRadius = metrics.cornerRadius;
  frame.x = position[0];
  frame.y = position[1];

  frame.resize(
    node.width + 2 * metrics.framePadding,
    node.height + 2 * metrics.framePadding
  );

  node.relativeTransform = [
    [1, 0, metrics.framePadding],
    [0, 1, metrics.framePadding],
  ];

  frame.appendChild(node);
  figma.currentPage.appendChild(frame);

  return frame;
}

export type NamedCanvasNodeImports = Record<
  string,
  { code: string; node: SceneNode }
>;

export function getNamedNodeModules(): NamedCanvasNodeImports {
  const modules: NamedCanvasNodeImports = {};
  const nodes = figma.currentPage.findAllWithCriteria({ types: ["WIDGET"] });

  for (const node of nodes) {
    // We can't read the synced state if it's not ours!
    const { code, naming, toggleNaming } = node.widgetSyncedState;
    if (!toggleNaming || !naming) {
      continue;
    }

    modules[naming] = { code, node };
  }

  return modules;
}

export function serializeNode(
  node: BaseNode,
  recursive: boolean = false,
  parent: boolean = false
): any {
  const data: any = {
    id: node.id,
    type: node.type,
  };

  if (!recursive) {
    data.parent = serializeNode(node.parent, true, true);
  }

  if (!parent) {
    if ("children" in node) {
      data.children = [];
      for (const child of node.children) {
        data.children.push(serializeNode(child, true));
      }
    }

    if ("stuckNodes" in node) {
      data.stuckNodes = [];
      for (const stuckNode of node.stuckNodes) {
        data.stuckNodes.push(serializeNode(stuckNode, true));
      }
    }
  }

  if ("name" in node) {
    data.name = node.name;
  }

  return data;
}

export const hashNodeIdToColor = (nodeId: string) => {
  // Just md5 the node ID and use the last digit. Idk.
  const hash = md5(nodeId);
  const num = parseInt(hash[hash.length - 1], 16);
  const index = num % Object.values(connectorColors).length;

  return Object.values(connectorColors)[index];
};

export const hashNodeIdToColorWithOpacity = (nodeId: string) => ({
  ...hashNodeIdToColor(nodeId),
  a: 1,
});

const yPositionForNumLines = (node: SceneNode, lineNumber: number): number => {
  return (
    metrics.headerPadding.top +
    // Height of the name bar
    (node.type === "WIDGET" && !!node.widgetSyncedState["toggleNaming"]
      ? 35 + metrics.headerPadding.top
      : 0) +
    // Shift by number of lines
    (lineNumber - 1) * metrics.codeLineHeight +
    // Add half a code line height to center
    metrics.codeLineHeight / 2
  );
};

const createConnectorBetweenWidgetNodes = (
  startNode: SceneNode,
  startNodeLineNumber: number,
  endNode: SceneNode,
  endNodeLineNumber: number
) => {
  const connector = figma.createConnector();
  connector.connectorStart = {
    endpointNodeId: startNode.id,
    position: {
      x: metrics.padding + metrics.importDotsWidth / 2,
      y: yPositionForNumLines(startNode, startNodeLineNumber),
    },
  };

  connector.connectorEnd = {
    endpointNodeId: endNode.id,
    position: {
      x: metrics.width - metrics.padding / 2,
      y: yPositionForNumLines(endNode, endNodeLineNumber),
    },
  };
  connector.connectorStartStrokeCap = "NONE";
  connector.connectorEndStrokeCap = "NONE";
  connector.strokes = [{ type: "SOLID", color: hashNodeIdToColor(endNode.id) }];
};

export function buildConnectors(allModules: NamedCanvasNodeImports) {
  // Set of nodes we've already visited, to prevent infinite loops.`
  const visitedNodes: Set<string> = new Set();

  const widgetNodes = figma.currentPage
    .findAllWithCriteria({
      types: ["WIDGET"],
    })
    .filter((w) => !!w.widgetSyncedState.code);

  widgetNodes.forEach((widgetNode) => {
    // Clean up all old connectors
    figma.currentPage
      .findAll((node) => {
        return (
          node.type === "CONNECTOR" &&
          "endpointNodeId" in node.connectorStart &&
          node.connectorStart.endpointNodeId === widgetNode.id
        );
      })
      .forEach((c) => c.remove());

    // Clear usedByModules
    widgetNode.setWidgetSyncedState({
      ...widgetNode.widgetSyncedState,
      lastRanError: widgetNode.widgetSyncedState["lastRanError"] || NON_ERROR,
      usedByModules: {},
    });
  });

  const exportStatementsForNodeCache: Record<
    string,
    ReturnType<typeof parseExportStatementsFromCode>
  > = Object.create(null);

  const createConnectorsOnWidget = () => {
    const widgetNode = widgetNodes.pop();

    // For each node, set up its usedModules and usedByModules.
    if (visitedNodes.has(widgetNode.id)) return;
    visitedNodes.add(widgetNode.id);

    const currentWidgetCode = widgetNode.widgetSyncedState["code"];

    const importStatements = parseImportStatementsFromCode(currentWidgetCode);

    // For each used module, draw a connector to that module.
    for (const importStatement of importStatements) {
      const moduleName = importStatement.source.value as string;
      const module = allModules[moduleName];

      if (!module) continue;

      const exportStatements = (() => {
        if (module.node.id in exportStatementsForNodeCache) {
          return exportStatementsForNodeCache[module.node.id];
        }

        const statements =
          module.node.type === "WIDGET"
            ? parseExportStatementsFromCode(
                module.node.widgetSyncedState["code"]
              )
            : [];

        exportStatementsForNodeCache[module.node.id] = statements;

        return statements;
      })();

      for (const specifier of importStatement.specifiers) {
        const exportStatement =
          (() => {
            if (specifier.type === "ImportSpecifier") {
              return exportStatements.find((statement) => {
                if (statement.type !== "ExportNamedDeclaration") return false;

                switch (statement.declaration.type) {
                  case "VariableDeclaration":
                    return statement.declaration.declarations.some(
                      (declaration) =>
                        declaration.id.type === "Identifier" &&
                        declaration.id.name === specifier.local.name
                    );
                  case "FunctionDeclaration":
                    return (
                      statement.declaration.id.name === specifier.local.name
                    );
                  case "ClassDeclaration":
                    return (
                      statement.declaration.id.name === specifier.local.name
                    );
                  default:
                    return false;
                }
              });
            } else if (specifier.type === "ImportDefaultSpecifier") {
              return exportStatements.find(
                (statement) => statement.type === "ExportDefaultDeclaration"
              );
            } else if (specifier.type === "ImportNamespaceSpecifier") {
              // Don't handle this
            }
          })() || null;

        if (exportStatement) {
          createConnectorBetweenWidgetNodes(
            widgetNode,
            specifier.loc.start.line,
            module.node,
            exportStatement.loc.start.line
          );
        }
      }

      if (module.node.type === "WIDGET") {
        // Tell the used module that we're using it.
        module.node.setWidgetSyncedState({
          ...module.node.widgetSyncedState,
          lastRanError:
            module.node.widgetSyncedState["lastRanError"] || NON_ERROR,
          usedByModules: {
            ...module.node.widgetSyncedState["usedByModules"],
            [widgetNode.widgetSyncedState["naming"] || "Unnamed notebook"]: {
              code: widgetNode.widgetSyncedState["code"],
              node: widgetNode,
            },
          },
        });
      }
    }

    // Update our used modules state.
    widgetNode.setWidgetSyncedState({
      ...widgetNode.widgetSyncedState,
      lastRanError: widgetNode.widgetSyncedState["lastRanError"] || NON_ERROR,
      usedModules: importStatements.reduce((acc, curr) => {
        const moduleName = curr.source.value as string;
        acc[moduleName] = allModules[moduleName];
        return acc;
      }, Object.create(null) as NamedCanvasNodeImports),
    });

    if (widgetNodes.length > 0) {
      setTimeout(createConnectorsOnWidget, 0);
    }
  };

  setTimeout(createConnectorsOnWidget, 0);
}

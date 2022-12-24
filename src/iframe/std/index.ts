/**
 * Everything in this file is accessible in scripts under the namespace
 * 'figma.notebook'.
 */

import { sendMessage } from "../utils";

function queryNodes(node: { id: string }, selector: string): Promise<any[]>;
function queryNodes(selector: string): Promise<any[]>;
function queryNodes(
  rootNode: { id: string } | string,
  selector?: string
): Promise<any[]> {
  if (!selector) {
    selector = rootNode as string;
    rootNode = undefined;
  }

  const id = (rootNode as { id: string } | null)?.id;

  return new Promise((resolve) => {
    function callback(event: MessageEvent) {
      const { pluginMessage } = event.data;

      if (pluginMessage && pluginMessage.type === "querynodessuccess") {
        resolve(pluginMessage.data);
      }

      window.removeEventListener("message", callback);
    }

    window.addEventListener("message", callback);
    sendMessage("querynodes", {
      selector,
      id,
    });
  });
}

export { queryNodes };

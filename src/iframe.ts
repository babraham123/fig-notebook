import { handleMessage } from './iframe/messages';
import { EMPTY_OBJ, PLUGIN_ID } from './shared/constants';
import { setupEditor } from './iframe/editor/main';
import { printErr } from './widget/utils';

function setupHeadlessRunner() {
  window.onmessage = (event: MessageEvent) => {
    if (!event.data?.type) {
      return;
    }
    handleMessage(event.data);
  };
  // Send 'ready' msg to the plugin.
  parent.postMessage({ type: 'INITIATE' }, PLUGIN_ID);
}

switch (import.meta.env.VITE_TARGET) {
  case 'editor':
    setupEditor();
    break;
  case 'run':
    setupHeadlessRunner();
    break;
  default:
    printErr(`Unknown build target '${import.meta.env.VITE_TARGET}'`);
}

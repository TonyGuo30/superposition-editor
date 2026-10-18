import { simulateScene, type EditorDocument, type Simulation } from './engine';
const scope = self as unknown as {
  onmessage: (event: MessageEvent<{ key: string; doc: EditorDocument }>) => void;
  postMessage: (value: { key: string; simulations?: Simulation[]; error?: string }) => void;
};
scope.onmessage = ({ data }) => {
  try {
    scope.postMessage({ key: data.key, simulations: simulateScene(data.doc) });
  } catch (error) {
    scope.postMessage({
      key: data.key,
      error: error instanceof Error ? error.message : 'Simulation failed.',
    });
  }
};

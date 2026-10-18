import { useEffect, useState } from 'react';
import { simulationKey, type EditorDocument, type Simulation } from './engine';
/** Cancel superseded work; a large choice space must never block direct manipulation. */
export function useSimulation(doc: EditorDocument) {
  const key = simulationKey(doc);
  const [result, setResult] = useState<{ key: string; simulations: Simulation[]; error?: string }>({
    key: '',
    simulations: [],
  });
  useEffect(() => {
    let worker: Worker | undefined;
    const timer = setTimeout(() => {
      worker = new Worker(new URL('./simulation.worker.ts', import.meta.url), { type: 'module' });
      worker.onmessage = ({
        data,
      }: MessageEvent<{ key: string; simulations?: Simulation[]; error?: string }>) => {
        setResult({ key: data.key, simulations: data.simulations || [], error: data.error });
      };
      worker.onerror = () =>
        setResult({
          key,
          simulations: [],
          error: 'The simulation worker could not start. Reload the editor to retry.',
        });
      worker.postMessage({ key, doc });
    }, 70);
    return () => {
      clearTimeout(timer);
      worker?.terminate();
    };
    // Names, colors and title are visual edits and do not invalidate this effect.
  }, [key]);
  return {
    simulations: result.key === key ? result.simulations : [],
    pending: result.key !== key,
    error: result.key === key ? result.error : undefined,
  };
}

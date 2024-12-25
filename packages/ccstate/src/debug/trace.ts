import type { PropagationEdge } from '../../types/debug/debug-store';
import type { CommandTrace } from '../../types/debug/trace';
import type { Command } from '../core';

export function trace<T, Args extends unknown[]>(command: Command<T, Args>): CommandTrace<T, Args> {
  const calls: { propagationGraph: PropagationEdge[][] }[] = [];

  const write = command.write;
  return {
    ...command,
    write: (target, ...args) => {
      calls.push({ propagationGraph: [] });
      const ret = write(target, ...args);
      return ret;
    },
    calls,
  };
}

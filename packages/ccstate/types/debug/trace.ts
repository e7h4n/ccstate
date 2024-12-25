import type { Command } from '../core/atom';
import type { PropagationEdge } from './debug-store';

export interface CommandTrace<T, Args extends unknown[]> extends Command<T, Args> {
  calls: {
    propagationGraph: PropagationEdge[][];
  }[];
}

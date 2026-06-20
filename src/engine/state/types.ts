// ===== 游戏状态核心类型 =====
import type { Character } from '../character/types';
import type { ChatMessage } from '../llm/types';
import type { WorldState } from '../world';

export interface GameState {
  character: Character;
  worldState: WorldState;
}

export interface StateChange {
  character?: Character;
  worldState?: WorldState;
  messages: ChatMessage[];
}

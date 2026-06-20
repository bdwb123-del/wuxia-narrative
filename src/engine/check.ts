// ===== 检定引擎 =====

export type DiceType = 'd4' | 'd6' | 'd8' | 'd10' | 'd20' | 'd100';

export interface CheckResult {
  /** 掷骰结果 */
  diceResults: number[];
  /** 骰子类型 */
  diceType: DiceType;
  /** 总点数 */
  total: number;
  /** 调整值 */
  modifier: number;
  /** 难度等级 */
  difficulty: number;
  /** 是否成功 */
  success: boolean;
  /** 大成功（暴击） */
  criticalSuccess: boolean;
  /** 大失败 */
  criticalFailure: boolean;
  /** 成功度（超过难度的点数） */
  marginOfSuccess: number;
}

/** 掷一个骰子 */
export function rollDice(type: DiceType): number {
  const max = parseInt(type.substring(1), 10);
  return Math.floor(Math.random() * max) + 1;
}

/** 掷多个骰子 */
export function rollDicePool(type: DiceType, count: number): number[] {
  return Array.from({ length: count }, () => rollDice(type));
}

/** 执行一次技能检定 */
export function performCheck(
  skillLevel: number,
  attributeValue: number,
  difficulty: number,
  diceType: DiceType = 'd20',
): CheckResult {
  const diceResults = rollDicePool(diceType, 1);
  const modifier = Math.floor(skillLevel / 2) + Math.floor(attributeValue / 3);
  const total = diceResults[0] + modifier;

  const criticalSuccess = diceResults[0] === parseInt(diceType.substring(1), 10);
  const criticalFailure = diceResults[0] === 1;
  const success = criticalSuccess
    ? true
    : criticalFailure
      ? false
      : total >= difficulty;

  return {
    diceResults,
    diceType,
    total,
    modifier,
    difficulty,
    success,
    criticalSuccess,
    criticalFailure,
    marginOfSuccess: total - difficulty,
  };
}

/** 执行一次对抗检定 */
export function performOpposedCheck(
  skillLevel: number,
  attributeValue: number,
  opponentSkillLevel: number,
  opponentAttributeValue: number,
  diceType: DiceType = 'd20',
): { player: CheckResult; opponent: CheckResult; winner: 'player' | 'opponent' | 'draw' } {
  const player = performCheck(skillLevel, attributeValue, 0, diceType);
  const opponent = performCheck(opponentSkillLevel, opponentAttributeValue, 0, diceType);

  let winner: 'player' | 'opponent' | 'draw';
  if (player.criticalSuccess && !opponent.criticalSuccess) {
    winner = 'player';
  } else if (!player.criticalSuccess && opponent.criticalSuccess) {
    winner = 'opponent';
  } else if (player.total > opponent.total) {
    winner = 'player';
  } else if (player.total < opponent.total) {
    winner = 'opponent';
  } else {
    winner = 'draw';
  }

  return { player, opponent, winner };
}

/** 将检定结果格式化为 AI 可读文本 */
export function checkResultToText(
  check: CheckResult,
  skillName: string,
  context: string,
): string {
  const crit = check.criticalSuccess
    ? ' 【大成功！】'
    : check.criticalFailure
      ? ' 【大失败...】'
      : '';
  const result = check.success ? '成功' : '失败';

  return `[检定] ${context}：${skillName}\n` +
    `掷骰 d${check.diceType}: ${check.diceResults[0]} + ${check.modifier} = ${check.total} (难度 ${check.difficulty})\n` +
    `结果：${result} (超出 ${check.marginOfSuccess})${crit}`;
}

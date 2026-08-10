const SLOT_COUNT = 3;

export const SANDBOX_DEV_SHORTCUTS = Object.freeze({
  toggle: 'Ctrl+Alt+D',
  maxWeapons: 'Alt+1',
  maxPassives: 'Alt+2',
  maxResonance: 'Alt+3',
  clear: 'Alt+0',
});

const commandAliases = Object.freeze({
  weapon: 'weapon',
  weapons: 'maxWeapons',
  passive: 'passive',
  passives: 'maxPassives',
  resonance: 'resonance',
  clear: 'clear',
  reset: 'clear',
  max: 'max',
  help: 'help',
});

const invalid = (message) => ({ ok: false, actions: [], error: message });

function parseSlot(value) {
  const slot = Number(value);
  return Number.isInteger(slot) && slot >= 1 && slot <= SLOT_COUNT ? slot - 1 : null;
}

function parseStackValue(value) {
  if (value === undefined || value === 'max') return 'max';
  const stacks = Number(value);
  return Number.isInteger(stacks) && stacks >= 0 ? stacks : null;
}

export function parseSandboxDevCommand(input, {
  weaponIds = [],
  passiveIds = [],
  resonanceIds = [],
} = {}) {
  const source = String(input ?? '').trim();
  if (!source) return invalid('請輸入開發者命令。');
  const knownWeapons = new Set(weaponIds);
  const knownPassives = new Set(passiveIds);
  const knownResonance = new Set(resonanceIds);
  const actions = [];

  for (const rawCommand of source.split(/[;\n]+/)) {
    const tokens = rawCommand.trim().split(/\s+/).filter(Boolean);
    if (!tokens.length) continue;
    const command = commandAliases[tokens[0].toLowerCase()];
    if (!command) return invalid(`不認識的命令：${tokens[0]}`);

    if (command === 'help') {
      actions.push({ type: 'help' });
      continue;
    }
    if (command === 'clear') {
      if (tokens[1] && tokens[1].toLowerCase() === 'resonance') actions.push({ type: 'clearResonance' });
      else actions.push({ type: 'clear' });
      continue;
    }
    if (command === 'max') {
      const target = tokens[1]?.toLowerCase();
      if (target === 'weapon' || target === 'weapons' || target === 'slot' || target === 'slots') actions.push({ type: 'maxWeapons' });
      else if (target === 'passive' || target === 'passives' || target === 'ability' || target === 'abilities') actions.push({ type: 'maxPassives' });
      else if (target === 'resonance') actions.push({ type: 'resonance', id: 'all', stacks: 'max' });
      else return invalid(`max 不認識的目標：${tokens[1] ?? ''}`);
      continue;
    }
    if (command === 'maxWeapons' || command === 'maxPassives') {
      if (tokens.length > 2) return invalid(`命令格式錯誤：${rawCommand.trim()}`);
      actions.push({ type: command });
      continue;
    }
    if (command === 'weapon' || command === 'passive') {
      const slot = parseSlot(tokens[1]);
      if (slot === null) return invalid(`${command} 槽位必須是 1、2 或 3。`);
      const id = tokens[2];
      const known = command === 'weapon' ? knownWeapons : knownPassives;
      if (!id) return invalid(`${command} 缺少能力 ID。`);
      if (id !== 'none' && !known.has(id)) return invalid(`找不到 ${command}：${id}`);
      const level = id === 'none' ? 0 : Number(tokens[3] ?? 1);
      if (id !== 'none' && (!Number.isInteger(level) || level < 1)) return invalid(`${command} 等級必須是正整數。`);
      actions.push({ type: command, slot, id: id === 'none' ? null : id, level });
      continue;
    }
    if (command === 'resonance') {
      const id = tokens[1];
      if (!id) return invalid('resonance 缺少敵人 ID 或 all。');
      if (id !== 'all' && id !== 'none' && !knownResonance.has(id)) return invalid(`找不到 resonance Buff：${id}`);
      const stacks = parseStackValue(tokens[2]);
      if (stacks === null) return invalid('resonance 層數必須是 max 或非負整數。');
      if (id === 'none') actions.push({ type: 'clearResonance' });
      else actions.push({ type: 'resonance', id, stacks });
    }
  }
  return actions.length ? { ok: true, actions } : invalid('沒有可套用的開發者命令。');
}

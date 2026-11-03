// Ponte com o aplicativo de desktop (Tauri). No navegador tudo isto vira no-op e o jogo usa só o localStorage.
import { invoke } from '@tauri-apps/api/core';
import { serialize, type GameState } from '../engine';

export const isDesktop = typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;

export interface SaveFileInfo { name: string; modified: number; size: number }

export async function savesFolder(): Promise<string | null> {
  if (!isDesktop) return null;
  try { return await invoke<string>('saves_folder'); } catch { return null; }
}

export async function writeSaveFile(name: string, text: string): Promise<string | null> {
  if (!isDesktop) return null;
  try { return await invoke<string>('write_save', { name, text }); } catch { return null; }
}

export async function readSaveFile(name: string): Promise<string | null> {
  if (!isDesktop) return null;
  try { return (await invoke<string | null>('read_save', { name })) ?? null; } catch { return null; }
}

export async function listSaveFiles(): Promise<SaveFileInfo[]> {
  if (!isDesktop) return [];
  try { return await invoke<SaveFileInfo[]>('list_saves'); } catch { return []; }
}

const slug = (t: string) => t.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-zA-Z0-9]+/g, '-').replace(/^-|-$/g, '').toLowerCase().slice(0, 30) || 'partida';

export function exportName(s: GameState) {
  return `pbs-${slug(s.character.name)}-${s.month.year}-${String(s.month.month).padStart(2, '0')}`;
}

/**
 * Espelho automático em arquivo (desktop): "autosave" sempre, e uma cópia por ano de jogo
 * (pbs-<nome>-ano-AAAA), para poder voltar no tempo se algo der errado.
 */
let lastMirror = '';
export async function mirrorToFile(s: GameState) {
  if (!isDesktop) return;
  const key = `${s.createdAt}|${s.month.year}|${s.month.month}`;
  if (key === lastMirror) return; // uma gravação em arquivo por mês de jogo basta
  lastMirror = key;
  const text = serialize(s);
  await writeSaveFile('autosave', text);
  await writeSaveFile(`pbs-${slug(s.character.name)}-ano-${s.month.year}`, text);
}

/** Exporta a partida: no desktop grava em Documentos; no navegador baixa um arquivo .json. */
export async function exportSave(s: GameState): Promise<string> {
  const name = exportName(s);
  const text = serialize(s);
  if (isDesktop) {
    const path = await writeSaveFile(name, text);
    return path ? `Partida salva em ${path}` : 'Não foi possível gravar o arquivo.';
  }
  const blob = new Blob([text], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `${name}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  return `Arquivo ${name}.json baixado.`;
}

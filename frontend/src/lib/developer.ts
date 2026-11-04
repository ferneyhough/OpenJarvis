import { isTauri } from './api';

export async function openVSCode(
  executablePath: string,
  workspacePath: string,
): Promise<void> {
  if (!isTauri()) {
    throw new Error('Opening VS Code is available in OpenJarvis Desktop.');
  }
  const { invoke } = await import('@tauri-apps/api/core');
  await invoke('open_vscode', { executablePath, workspacePath });
}

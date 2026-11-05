import { describe, expect, it } from 'vitest';
import {
  isReturnToJarvisVoiceCommand,
  parseGameLauncherVoiceCommand,
} from './game-launchers';
import { interpretHandsFreeTranscript } from '../hooks/useHandsFree';
import { parseHubAppVoiceCommand } from './hub-voice';

describe('game launcher voice commands', () => {
  it('matches launcher names and aliases after open, launch, or start', () => {
    const wake = interpretHandsFreeTranscript('Jarvis, open steam', false);
    expect(wake.command).toBe('open steam');
    expect(parseGameLauncherVoiceCommand(wake.command ?? '')).toBe('steam');
    expect(parseGameLauncherVoiceCommand('open steam')).toBe('steam');
    expect(parseGameLauncherVoiceCommand('Please launch GOG Galaxy')).toBe('gog');
    expect(parseGameLauncherVoiceCommand('start game pass')).toBe('xbox');
    expect(parseGameLauncherVoiceCommand('open battle.net')).toBe('battle-net');
    expect(parseGameLauncherVoiceCommand('open GeForce NOW')).toBe('geforce-now');
    expect(parseGameLauncherVoiceCommand('open Amazon Luna')).toBe('amazon-luna');
  });

  it('recognizes return-to-Jarvis phrases without matching unrelated requests', () => {
    expect(isReturnToJarvisVoiceCommand('Return to Jarvis')).toBe(true);
    expect(isReturnToJarvisVoiceCommand('go back to Jarvis!')).toBe(true);
    expect(isReturnToJarvisVoiceCommand('return to my chat')).toBe(false);
  });

  it('resolves enabled hub app names across hub sections', () => {
    expect(parseHubAppVoiceCommand('open WhatsApp')?.settingsId).toBe('whatsapp');
    expect(parseHubAppVoiceCommand('launch Prime Video')?.settingsId).toBe('prime-video');
    expect(parseHubAppVoiceCommand('start Epic Games Store')?.settingsId).toBe('epic-store');
    expect(parseHubAppVoiceCommand('open OpenAI')?.apiKey).toBe('OPENAI_API_KEY');
    expect(parseHubAppVoiceCommand('open TikTok')?.settingsId).toBe('tiktok');
    expect(parseHubAppVoiceCommand('open Crunchyroll')?.settingsId).toBe('crunchyroll');
    expect(parseHubAppVoiceCommand('open Crave')?.settingsId).toBe('crave');
    expect(parseHubAppVoiceCommand('open Twitch')?.settingsId).toBe('twitch');
    expect(parseHubAppVoiceCommand('open Plex')?.settingsId).toBe('plex');
    expect(parseHubAppVoiceCommand('open Base 44')?.settingsId).toBe('base44');
    expect(parseHubAppVoiceCommand('open Emergent')).toBeNull();
    expect(parseHubAppVoiceCommand('open Copilot')?.settingsId).toBe('microsoft-copilot');
    expect(parseHubAppVoiceCommand('open Twitch dashboard')?.settingsId).toBe('live-twitch');
    expect(parseHubAppVoiceCommand('open OBS Studio')?.settingsId).toBe('obs-studio');
    expect(parseHubAppVoiceCommand('open Prism Launcher')?.settingsId).toBe('prism-launcher');
    expect(parseHubAppVoiceCommand('open Prism Live Studio')?.settingsId).toBe('prism-live-studio');
    expect(parseHubAppVoiceCommand('open Rumble Studio')?.settingsId).toBe('live-rumble');
    expect(parseHubAppVoiceCommand('open StreamYard')?.settingsId).toBe('streamyard');
    expect(parseHubAppVoiceCommand('open Steam Link')?.settingsId).toBe('steam-link');
    expect(parseHubAppVoiceCommand('open Google Remote Desktop')?.settingsId).toBe('chrome-remote-desktop');
    expect(parseHubAppVoiceCommand('open AnyDesk')?.settingsId).toBe('anydesk');
    expect(parseHubAppVoiceCommand('open TeamViewer')?.settingsId).toBe('teamviewer');
    expect(parseHubAppVoiceCommand('open RustDesk')?.settingsId).toBe('rustdesk');
    expect(parseHubAppVoiceCommand('open Parsec')?.settingsId).toBe('parsec');
    expect(parseHubAppVoiceCommand('open something else')).toBeNull();
  });
});

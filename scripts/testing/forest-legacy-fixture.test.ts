import { it, expect } from 'vitest';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { PrologueForestOpeningSession } from '../../src/game/prologue-forest-opening';
import { createBrowserForestOpeningSave, readBrowserForestOpeningSave } from '../../src/persistence/browser-forest-opening-persistence';

it('exports and validates a v0.1 saved world for browser compatibility tests',()=>{
  const save=createBrowserForestOpeningSave(PrologueForestOpeningSession.fresh({
    sessionId:'e2e.legacy',seed:'e2e.legacy',physics:'shared',currentMp:12,maxMp:24,
  }));
  expect(()=>readBrowserForestOpeningSave(save)).not.toThrow();
  const directory=resolve(import.meta.dirname,'../../.codex-tmp');
  mkdirSync(directory,{recursive:true});
  writeFileSync(resolve(directory,'forest-legacy-fixture.json'),JSON.stringify(save));
});

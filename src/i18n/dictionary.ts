import { buildDictionary } from './translate';
import clips from './en/clips';
import core from './en/core';
import editor from './en/editor';
import editorial from './en/editorial';
import errors from './en/errors';
import home from './en/home';
import settings from './en/settings';
import setup from './en/setup';
import transcription from './en/transcription';
import extra from './en/extra';

/**
 * Dicionário inglês do app inteiro, um arquivo por área (ADR-0041). Cada frente mexe só no arquivo da
 * própria área, então conflitos de merge ficam pequenos e fáceis de resolver.
 */
export const EN = buildDictionary([extra, errors, home, editor, setup, clips, settings, transcription, editorial, core]);

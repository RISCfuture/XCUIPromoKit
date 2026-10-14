#!/usr/bin/env node
// Runs the TypeScript CLI as it is, so an install from git has nothing to build.
import { register } from 'tsx/esm/api';

register();
await import('../src/cli/main.ts');

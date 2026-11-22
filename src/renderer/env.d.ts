/// <reference types="vite/client" />
import type { MultiApi } from '../shared/types';

declare global {
  interface Window {
    multi: MultiApi;
  }
}

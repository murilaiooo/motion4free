declare const __APP_VERSION__: string;
declare const __APP_COMMIT__: string;
declare const __APP_BUILT_AT__: string;

/** Versão exibida no app e copiada nos relatórios de erro. Ver docs/CHANGELOG.md. */
export const APP_VERSION = __APP_VERSION__;
export const APP_COMMIT = __APP_COMMIT__;
export const APP_BUILT_AT = __APP_BUILT_AT__;
export const VERSION_LABEL = `v${APP_VERSION} · ${APP_COMMIT}`;

export const $ = id => document.getElementById(id);
export async function readJson(file) { if (!file || file.size > 8 * 1024 * 1024) throw new Error('arquivo'); return JSON.parse(await file.text()); }
export function download(name, value) { const url = URL.createObjectURL(new Blob([JSON.stringify(value, null, 2)], {type:'application/json'})); const link = document.createElement('a'); link.href = url; link.download = name; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000); }
export function element(tag, text = '') { const el = document.createElement(tag); el.textContent = text; return el; }

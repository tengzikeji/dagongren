import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const root = path.dirname(fileURLToPath(import.meta.url));
const output = path.resolve(root, './preview/dagongren-preview.html');
const [shell, css, payroll, dataTools, syncTools, nativeTools, app, icon] = await Promise.all(['index.html','style.css','payroll.js','data-tools.js','sync-tools.js','native-sync.js','app.js','icon.svg'].map(file=>fs.readFile(path.join(root,'dist',file),'utf8')));
const logic = payroll.replaceAll('export function ', 'function ') + '\n' + dataTools.replaceAll('export function ', 'function ') + '\n' + syncTools.replaceAll('export function ', 'function ') + '\n' + nativeTools.replaceAll('export function ', 'function ').replace(/^import[^\n]+\n/gm, '') + '\n' + app.replace(/^import[^\n]+\n/gm, '');
const embedded = shell
  .replace('<link rel="icon" href="./icon.svg" type="image/svg+xml">', '<link rel="icon" type="image/svg+xml" href="data:image/svg+xml,'+encodeURIComponent(icon)+'">')
  .replace('<link rel="stylesheet" href="./style.css">', '<style>'+css+'</style>')
  .replace('<script type="module" src="./app.js"></script>', '<script>\n(()=>{\n'+logic.replace(/<\/script/gi,'<\\/script')+'\n})();\n</script>');
const attribute = embedded.replaceAll('&','&amp;').replaceAll('"','&quot;').replaceAll('<','&lt;').replaceAll('>','&gt;');
const document = `<!doctype html>
<html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover"><meta name="theme-color" content="#3276f5"><title>打工人 · 安卓版交互预览</title>
<style>*{box-sizing:border-box}html,body{margin:0;width:100%;min-height:100%;font-family:'Microsoft YaHei',sans-serif;background:#e8edf5;color:#3d4546}body{display:flex;flex-direction:column;align-items:center;justify-content:center;min-height:100dvh;padding:22px 16px;gap:14px}.preview-heading{font-size:12px;color:#7b8585;display:flex;align-items:center;gap:10px;letter-spacing:1px}.preview-heading span{background:#dfe9ff;border-radius:5px;padding:4px 7px;font-size:10px;color:#3867b5;letter-spacing:0}.phone{position:relative;display:block;width:min(430px,100%);height:min(890px,calc(100dvh - 108px));min-height:550px;overflow:hidden;border:5px solid #122342;border-radius:32px;background:#f3f6fb;box-shadow:0 25px 60px #2033321a,0 1px 0 #ffffff60 inset}iframe{width:100%;height:100%;display:block;border:0;background:#f3f6fb}.preview-foot{font-size:11px;color:#8f9797;text-align:center;line-height:1.7;max-width:430px}@media(max-width:600px){body{padding:0;gap:0;display:block;background:#f3f6fb}.preview-heading,.preview-foot{display:none}.phone{width:100%;height:100dvh;min-height:0;border:0;border-radius:0;box-shadow:none}}@media(max-height:700px) and (min-width:601px){.phone{min-height:500px;height:calc(100dvh - 95px)}body{padding:12px}}
</style></head><body><div class="preview-heading">打工人<span>安卓版 · 科技感交互预览</span></div><div class="phone"><iframe title="打工人工资账本，可交互预览" srcdoc="${attribute}"></iframe></div><p class="preview-foot">底部依次为：首页、日历、明细、我的。<br>示例账本 · 本机保存 · 坚果云同步为演示</p></body></html>`;
await fs.mkdir(path.dirname(output), {recursive:true});
await fs.writeFile(output,document,'utf8');
console.log(JSON.stringify({file:output,bytes:Buffer.byteLength(document),selfContained:true}));

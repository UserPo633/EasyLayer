import { build } from 'esbuild';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
const result = await build({entryPoints:['src/app.js'],bundle:true,write:false,format:'iife',target:'es2020',minify:true,legalComments:'linked',outfile:'dist/app.js'});
const js = result.outputFiles.find(f=>f.path.endsWith('/app.js')).text;
const html = (await readFile('src/booking.html','utf8')).replace('<!-- BUNDLED_APP -->','<script>'+js.replaceAll('</script','<\\/script')+'</script>');
await mkdir('dist',{recursive:true});
await writeFile('dist/booking.html',html);
for (const file of result.outputFiles.filter(f=>f.path.endsWith('.LEGAL.txt'))) await writeFile('dist/THIRD_PARTY_LICENSES.txt',file.text);
console.log('Built MCP Apps resource: dist/booking.html');

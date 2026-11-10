import {writeFile,rename,mkdir,rm} from 'node:fs/promises';
import {randomUUID} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import {ROOT,loadInputs,renderHTML,validateData} from './lib.mjs';

export async function buildHTML({coursePath=path.join(ROOT,'data/course.json'),scaffoldPath=path.join(ROOT,'data/scaffolds.json'),outputPath=path.join(ROOT,'index.html')}={}){
  const inputs=await loadInputs(coursePath,scaffoldPath);
  const summary=validateData(inputs.course,inputs.scaffolds);
  const html=renderHTML(inputs.course,inputs.scaffolds,inputs.assets);
  const output=path.resolve(outputPath);
  const protectedSources=[coursePath,scaffoldPath,...['template.html','styles.css','local-auth.js','app.js'].map(name=>path.join(ROOT,'assets',name))].map(name=>path.resolve(name));
  if(path.extname(output).toLowerCase()!=='.html')throw new Error('输出文件必须使用 .html 后缀。');
  if(protectedSources.includes(output))throw new Error('输出路径不能覆盖题库、支架或模板源文件。');
  await mkdir(path.dirname(output),{recursive:true});
  const temporary=output+'.'+randomUUID()+'.tmp';
  try{await writeFile(temporary,html,'utf8');await rename(temporary,output);}finally{await rm(temporary,{force:true});}
  return {output,bytes:Buffer.byteLength(html),...summary};
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  try{
    const result=await buildHTML({
      coursePath:process.argv[2]?path.resolve(process.argv[2]):path.join(ROOT,'data/course.json'),
      outputPath:process.argv[3]?path.resolve(process.argv[3]):path.join(ROOT,'index.html'),
      scaffoldPath:process.argv[4]?path.resolve(process.argv[4]):path.join(ROOT,'data/scaffolds.json')
    });
    console.log(`已生成 ${result.output}（${result.bytes} 字节，${result.taskCount} 题）。`);
  }catch(error){console.error('构建失败，原文件未覆盖：'+error.message);process.exitCode=1;}
}

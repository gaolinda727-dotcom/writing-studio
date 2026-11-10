import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import path from 'node:path';
import vm from 'node:vm';
import {webcrypto} from 'node:crypto';
import {TextEncoder,TextDecoder} from 'node:util';
import {Blob} from 'node:buffer';
import {ROOT,loadInputs,validateData,renderHTML,extractInlineScripts} from './lib.mjs';

const coursePath=process.argv[2]?path.resolve(process.cwd(),process.argv[2]):path.join(ROOT,'data/course.json');
const htmlPath=process.argv[3]?path.resolve(process.cwd(),process.argv[3]):path.join(ROOT,'index.html');
const {course,scaffolds,assets}=await loadInputs(coursePath);
const report=validateData(course,scaffolds);
const html=await readFile(htmlPath,'utf8');
assert.equal(html,renderHTML(course,scaffolds,assets),'index.html 与当前数据和模板不一致；请先运行 npm run build。');
const scripts=extractInlineScripts(html);
assert.equal(scripts.length,1,'成品应只有一个内嵌脚本。');
new vm.Script(scripts[0],{filename:'index.html:inline-script'});
assert.ok(!/<script\b[^>]*\bsrc\s*=/i.test(html),'不应依赖外部脚本。');
assert.ok(!/<link\b[^>]*\brel\s*=\s*["']stylesheet/i.test(html),'样式必须内嵌。');
assert.ok(!/@import\s/i.test(html),'不应引入外部样式。');
assert.ok(!/<(?:img|audio|video|source|iframe)\b[^>]*\b(?:src|poster)\s*=\s*["'](?!data:|#)/i.test(html),'媒体不能依赖外部文件。');
assert.ok(!/\b(?:fetch|XMLHttpRequest|WebSocket)\s*\(/.test(scripts[0]),'本机版不应发出网络请求。');

function readEmbeddedJSON(source,name){
  const match=new RegExp('const\\s+'+name+'\\s*=\\s*').exec(source);
  assert.ok(match,'未找到内嵌数据 '+name);
  const start=match.index+match[0].length;
  let depth=0,quoted=false,escaped=false,end=-1;
  for(let i=start;i<source.length;i++){
    const ch=source[i];
    if(quoted){if(escaped)escaped=false;else if(ch==='\\')escaped=true;else if(ch==='"')quoted=false;continue;}
    if(ch==='"'){quoted=true;continue;}
    if(ch==='{'||ch==='[')depth++;
    if(ch==='}'||ch===']'){depth--;if(depth===0){end=i+1;break;}}
  }
  assert.ok(end>start,'内嵌 JSON 不完整：'+name);
  return JSON.parse(source.slice(start,end));
}
assert.deepEqual(readEmbeddedJSON(scripts[0],'writingCatalog'),course,'内嵌题库应与 course.json 完全一致。');
assert.deepEqual(readEmbeddedJSON(scripts[0],'writingScaffolds'),scaffolds,'内嵌支架应与 scaffolds.json 完全一致。');

const copy=value=>JSON.parse(JSON.stringify(value));
const invalidChecks=[
  ['重复题目 ID',(c)=>{c.application.push(copy(c.application[0]));}],
  ['缺少写前支架',(_c,s)=>{delete s[course.application[0].id];}],
  ['分析答案超出选项',(_c,s)=>{s[course.application[0].id].analysis.answer=3;}],
  ['评分维度分值不符',(c)=>{c.application[0].dimensions[0][1]++;}]
];
for(const [label,mutate] of invalidChecks){const c=copy(course),s=copy(scaffolds);mutate(c,s);assert.throws(()=>validateData(c,s),label+'应被拒绝。');}
const hostile=copy(course);
hostile.application[0].summary='</script><script>globalThis.injected=true</script><style>body{display:none}</style>';
const safeHTML=renderHTML(hostile,scaffolds,assets),safeScripts=extractInlineScripts(safeHTML);
assert.equal(safeScripts.length,1,'题目文本不能关闭原脚本并新增脚本。');
assert.deepEqual(readEmbeddedJSON(safeScripts[0],'writingCatalog'),hostile,'安全内嵌不应改变原始题目文本。');
assert.ok(!safeScripts[0].includes('</script><script>globalThis.injected=true'),'危险 HTML 结束标签必须转义。');
new vm.Script(safeScripts[0]);

// A small DOM fixture exercises JavaScript state and rendering. It does not
// emulate browser layout, native form validation, focus, or accessibility APIs.
function fixture(){
  const nodes=new Map();
  const make=(id='',tag='div')=>{
    const events=new Map(),attributes=new Map(),classes=new Set();
    const node={id,tagName:tag.toUpperCase(),value:'',textContent:'',innerHTML:'',hidden:false,disabled:false,checked:false,isConnected:true,
      classList:{add(...names){names.forEach(n=>classes.add(n));},remove(...names){names.forEach(n=>classes.delete(n));},toggle(name,force){const on=force===undefined?!classes.has(name):force;on?classes.add(name):classes.delete(name);return on;},contains(name){return classes.has(name);}},
      setAttribute(name,value){attributes.set(name,String(value));},getAttribute(name){return attributes.has(name)?attributes.get(name):null;},hasAttribute(name){return attributes.has(name);},
      addEventListener(type,callback){if(!events.has(type))events.set(type,[]);events.get(type).push(callback);},
      async fire(type,event={}){for(const callback of events.get(type)||[])await callback({target:node,preventDefault(){},...event});},
      focus(){},appendChild(child){return child;},remove(){},showModal(){node.open=true;},close(){node.open=false;void node.fire('close');},click(){return node.fire('click');},
      querySelector(selector){return document.querySelector(selector);},querySelectorAll(){return[];}
    };
    return node;
  };
  for(const match of assets.template.matchAll(/<([A-Za-z][\w:-]*)\b([^>]*)>/g)){
    const id=/\bid=["']([^"']+)["']/.exec(match[2]);if(id&&!nodes.has(id[1]))nodes.set(id[1],make(id[1],match[1]));
  }
  const close=make('fixture-close','button'),body=make('fixture-body','body');
  const document={body,activeElement:close,getElementById:id=>nodes.get(id)||null,
    querySelector(selector){if(selector.startsWith('#'))return nodes.get(selector.slice(1))||null;if(selector==='.close-button')return close;return null;},
    querySelectorAll(){return[];},addEventListener(){},createElement:tag=>make('',tag)};
  return {nodes,document};
}

async function checkRendering(){
  const dom=fixture(),records=new Map();
  const session={ready:Promise.resolve(),get:(key,fallback='')=>records.has(key)?records.get(key):fallback,set:(key,value)=>{records.set(key,value);return true;},flush:async()=>true};
  const context=vm.createContext({window:{StudentSession:session},document:dom.document,setTimeout:()=>0,clearTimeout(){}});
  vm.runInContext('const writingCatalog = '+JSON.stringify(course)+';const writingScaffolds = '+JSON.stringify(scaffolds)+';',context);
  const insertion=assets.app.lastIndexOf('renderLibrary();');
  assert.ok(insertion>=0,'应用启动点缺失，无法运行 VM 状态检查。');
  const bridge=`globalThis.__studioCheck={render(id,stage){selectedTask=id;return stageContent(taskData[id],stage)},record(id,suffix,value){return store.set(taskKey(suffix,id),value)}};\n`;
  await vm.runInContext(assets.app.slice(0,insertion)+bridge+assets.app.slice(insertion),context,{timeout:3000});
  assert.ok(context.__studioCheck,'应用初始化失败：'+(dom.nodes.get('auth-error')?.textContent||''));
  const escape=value=>String(value).replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
  const tasks=[...course.application,...course.continuationGroups.flatMap(group=>group.items)];
  for(const task of tasks){
    const plan='PLAN_ONLY_'+task.id;
    context.__studioCheck.record(task.id,'scaffold-plan',plan);
    const before=context.__studioCheck.render(task.id,1);
    assert.ok(before.includes('scaffold-stage')&&before.includes(escape(scaffolds[task.id].patterns[0].phrase)),task.id+' 写前支架缺失。');
    let independent=context.__studioCheck.render(task.id,2);
    assert.ok(!independent.includes('scaffold-stage')&&!independent.includes('pattern-list')&&!independent.includes(plan),task.id+' 独立写作混入支架。');
    assert.match(independent,/<textarea\b[^>]*spellcheck="false"/);
    assert.ok(!/<textarea\b[^>]*placeholder=/.test(independent),'独立写作正文不应包含占位提示。');
    const draft='DRAFT_'+task.id+' </textarea><b>own work</b>';
    context.__studioCheck.record(task.id,'draft',draft);
    independent=context.__studioCheck.render(task.id,2);
    assert.ok(independent.includes(escape(draft))&&!independent.includes('<b>own work</b>'),'草稿内容必须安全转义。');
    const other=tasks.find(item=>item.id!==task.id);
    assert.ok(!context.__studioCheck.render(other.id,2).includes('DRAFT_'+task.id+' '),'草稿不能混入其他题目。');
    const score=String(Math.min(2,task.dimensions[0][1]));
    context.__studioCheck.record(task.id,'self-score-0',score);
    assert.equal(/id="self-score-0"[^>]*value="([^"]+)"/.exec(context.__studioCheck.render(task.id,4))?.[1],score);
    context.__studioCheck.record(task.id,'growth-reflection','REFLECTION_'+task.id);
    assert.ok(context.__studioCheck.render(task.id,6).includes('REFLECTION_'+task.id));
  }
  return tasks.length;
}

function authRuntime(storage,{denyWrites=false,pure=false}={}){
  const dom=fixture(),downloads=[];let reloaded=false,writable=!denyWrites;
  const localStorage={getItem:key=>storage.has(key)?storage.get(key):null,setItem(key,value){if(!writable)throw new Error('Storage denied');storage.set(key,String(value));},removeItem(key){if(!writable)throw new Error('Storage denied');storage.delete(key);}};
  const window={document:dom.document,crypto:pure?{getRandomValues:array=>webcrypto.getRandomValues(array)}:webcrypto,localStorage,location:{reload(){reloaded=true;}}};
  const timeout=(callback,ms=0)=>ms>=30000?0:setTimeout(callback,ms);
  const context=vm.createContext({window,document:dom.document,crypto:webcrypto,TextEncoder,TextDecoder,Uint8Array,ArrayBuffer,Blob,URL:{createObjectURL(blob){downloads.push(blob);return'blob:fixture';},revokeObjectURL(){}},setTimeout:timeout,clearTimeout});
  vm.runInContext(assets.auth,context,{timeout:3000});
  return {window,nodes:dom.nodes,downloads,reloaded:()=>reloaded,denyWrites(){writable=false;}};
}
async function signIn(runtime,name,password,register=false){
  const get=id=>runtime.nodes.get(id);
  get('auth-name').value=name;await get('auth-form').fire('submit');
  assert.equal(get('auth-confirm-wrap').hidden,!register,'姓名查询没有进入正确登录模式。');
  get('auth-password').value=password;if(register)get('auth-confirm').value=password;
  await get('auth-form').fire('submit');
  assert.ok(runtime.window.StudentSession.student,'登录失败：'+get('auth-error').textContent);
}
async function checkAccounts(){
  const storage=new Map(),password='fixture-password-alpha-9341';
  let runtime=authRuntime(storage,{pure:true});
  assert.equal(runtime.nodes.get('studio-app').hidden,true);
  await signIn(runtime,'检查同学甲',password,true);
  runtime.window.StudentSession.set('task-email-draft','Account A draft');
  assert.equal(await runtime.window.StudentSession.flush(),true);
  const serialized=storage.get('writing-studio-singlefile-v1');
  assert.ok(serialized&&!serialized.includes(password),'本机数据库不能保存明文密码。');
  const saved=JSON.parse(serialized);assert.equal(saved.accounts[0].password.algorithm,'PBKDF2-SHA256');assert.equal(saved.accounts[0].password.iterations,100000);
  await runtime.nodes.get('local-export').fire('click');
  assert.equal(runtime.downloads.length,1);const backup=JSON.parse(await runtime.downloads[0].text());
  assert.equal(backup.records['task-email-draft'],'Account A draft');assert.ok(!Object.hasOwn(backup,'password'));assert.ok(!Object.hasOwn(backup,'accounts'));
  await runtime.nodes.get('student-logout').fire('click');assert.equal(runtime.window.StudentSession.student,null);assert.equal(runtime.reloaded(),true);
  runtime=authRuntime(storage);
  runtime.nodes.get('auth-name').value='检查同学甲';await runtime.nodes.get('auth-form').fire('submit');runtime.nodes.get('auth-password').value='fixture-wrong-password';await runtime.nodes.get('auth-form').fire('submit');
  assert.equal(runtime.window.StudentSession.student,null);assert.ok(runtime.nodes.get('auth-error').textContent.includes('不正确'));
  runtime.nodes.get('auth-password').value=password;await runtime.nodes.get('auth-form').fire('submit');
  assert.equal(runtime.window.StudentSession.get('task-email-draft'),'Account A draft','原密码再次登录必须恢复记录。');
  runtime=authRuntime(storage);await signIn(runtime,'检查同学乙','fixture-password-beta-5938',true);
  assert.equal(runtime.window.StudentSession.get('task-email-draft'),'','不同账号不能读取彼此记录。');
  runtime.denyWrites();assert.equal(runtime.window.StudentSession.set('task-email-draft','Unsaved draft'),false);assert.equal(runtime.window.StudentSession.get('task-email-draft'),'Unsaved draft');
  await runtime.nodes.get('student-logout').fire('click');assert.equal(runtime.reloaded(),false,'存储失败时不能丢弃尚未保存的内容。');
  const damaged=new Map([['writing-studio-singlefile-v1','{broken']]);const broken=authRuntime(damaged);
  assert.equal(broken.nodes.get('auth-submit').disabled,true);assert.equal(damaged.get('writing-studio-singlefile-v1'),'{broken','损坏记录不能被悄悄覆盖。');
}

const renderCount=await checkRendering();
await checkAccounts();
console.log(`检查通过：${report.taskCount} 道题的数据、生成一致性、脚本语法、安全内嵌与非法数据拒绝。`);
console.log(`VM 检查通过：${renderCount} 道题的写前支架／独立写作分离、草稿隔离、本机注册与再次登录、备份不含密码、存储异常保护。`);
console.log('上述为 Node 静态与最小 DOM 状态检查，不包含真实浏览器交互、布局或屏幕阅读器测试。');

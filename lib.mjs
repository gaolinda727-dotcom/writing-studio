import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import path from 'node:path';

export const ROOT = fileURLToPath(new URL('../', import.meta.url));
export const APPLICATION_GENRES = ['邮件','邀请信','建议信','感谢信','道歉信','求助信','推荐信','申请信','告知信','通知','演讲稿','倡议书','日记','海报'];
export const CONTINUATION_GROUPS = [
  {id:'self',title:'人与自我',topics:['个人成长','突破胆怯','战胜挫折','自我接纳']},
  {id:'society',title:'人与社会',topics:['亲情友情和解','师生温暖','陌生人善意相助','诚信感恩','文化体验']},
  {id:'nature',title:'人与自然',topics:['野外遇险脱困','救助动物','守护自然','敬畏生命']}
];
const own = (value,key) => Object.prototype.hasOwnProperty.call(value,key);
const record = value => value!==null && typeof value==='object' && !Array.isArray(value);
const text = value => typeof value==='string' && value.trim().length>0;
function ensure(condition,message){if(!condition)throw new Error(message);}
function dataOnly(value,label,depth=0){
  ensure(depth<40,`${label}：数据嵌套过深。`);
  if(value===null||typeof value==='string'||typeof value==='boolean')return;
  if(typeof value==='number'){ensure(Number.isFinite(value),`${label}：数字必须有限。`);return;}
  ensure(typeof value==='object',`${label}：只允许 JSON 数据。`);
  for(const [key,item] of Object.entries(value)){
    ensure(!['__proto__','constructor','prototype'].includes(key),`${label}：不支持字段 ${key}。`);
    dataOnly(item,label,depth+1);
  }
}
function strings(value,length,label){
  ensure(Array.isArray(value)&&value.length===length&&value.every(text),`${label}：需要 ${length} 个非空文本项目。`);
}
function sameSet(actual,expected,label){
  const set=new Set(actual);
  ensure(set.size===expected.length&&expected.every(item=>set.has(item)),`${label}：应覆盖 ${expected.join('、')}，且不能使用其他分类。`);
}

export function allTasks(course){return [...course.application,...course.continuationGroups.flatMap(group=>group.items)];}

export function validateData(course,scaffolds){
  dataOnly(course,'题库');dataOnly(scaffolds,'支架');
  ensure(record(course),'题库必须是对象。');
  ensure(Number.isInteger(course.version)&&course.version>0,'题库 version 必须为正整数。');
  ensure(text(course.title),'题库缺少 title。');
  ensure(Array.isArray(course.application)&&course.application.length>=APPLICATION_GENRES.length,'application 至少需要覆盖 14 种应用文。');
  ensure(Array.isArray(course.continuationGroups)&&course.continuationGroups.length===3,'continuationGroups 必须包含三大主题。');
  ensure(record(scaffolds),'支架必须是按题目 ID 索引的对象。');
  const ids=new Set();
  const task=(item,type,group='')=>{
    ensure(record(item),'每道题必须是对象。');
    ensure(typeof item.id==='string'&&/^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/.test(item.id)&&item.id.length<=80,`题目 ID 无效：${String(item.id)}。`);
    ensure(!ids.has(item.id),`题目 ID 重复：${item.id}。`);ids.add(item.id);
    const label=`题目 ${item.id}`;
    ensure(item.type===type,`${label}：type 与所属分类不符。`);
    ensure(item.group===group,`${label}：group 应为 ${JSON.stringify(group)}。`);
    ensure(item.short===(type==='application'?'应用文':'读后续写'),`${label}：short 与题型不符。`);
    for(const key of ['genre','name','title','summary','prompt','sample'])ensure(text(item[key]),`${label}：缺少非空字段 ${key}。`);
    for(const key of ['max','target','time'])ensure(typeof item[key]==='number'&&Number.isFinite(item[key])&&item[key]>0,`${label}：${key} 必须为正数。`);
    strings(item.checklist,3,`${label} checklist`);
    ensure(Array.isArray(item.dimensions)&&item.dimensions.length===3,`${label}：需要三个评分维度。`);
    for(const dimension of item.dimensions)ensure(Array.isArray(dimension)&&dimension.length===2&&text(dimension[0])&&typeof dimension[1]==='number'&&Number.isFinite(dimension[1])&&dimension[1]>0,`${label}：评分维度应为 [名称, 正分值]。`);
    ensure(new Set(item.dimensions.map(d=>d[0])).size===3,`${label}：评分维度名称不可重复。`);
    ensure(Math.abs(item.dimensions.reduce((sum,d)=>sum+d[1],0)-item.max)<1e-8,`${label}：评分维度之和不等于 max。`);
    ensure(record(item.feedback),`${label}：缺少反馈演示。`);
    for(const key of ['snippet','heading','explanation','before','after'])ensure(text(item.feedback[key]),`${label}：feedback.${key} 不能为空。`);
    ensure(item.sample.includes(item.feedback.before),`${label}：反馈原句 before 必须出现在示例作文 sample 中。`);
    if(type==='continuation')ensure(/Paragraph\s*1\s*[:：]/i.test(item.prompt)&&/Paragraph\s*2\s*[:：]/i.test(item.prompt),`${label}：续写必须给出两段首句。`);
    ensure(own(scaffolds,item.id)&&record(scaffolds[item.id]),`${label}：缺少对应写前支架。`);
    const scaffold=scaffolds[item.id];
    ensure(text(scaffold.focus)&&text(scaffold.transferPrompt),`${label}：支架缺少学习目标或构思练习。`);
    ensure(Array.isArray(scaffold.framework)&&[3,4].includes(scaffold.framework.length),`${label}：framework 需要三或四项。`);
    for(const part of scaffold.framework)ensure(record(part)&&text(part.label)&&text(part.guidance),`${label}：框架项目缺少 label/guidance。`);
    ensure(Array.isArray(scaffold.patterns)&&scaffold.patterns.length===3,`${label}：patterns 需要三个句型。`);
    for(const pattern of scaffold.patterns)ensure(record(pattern)&&text(pattern.phrase)&&text(pattern.usage),`${label}：句型缺少 phrase/usage。`);
    const analysis=scaffold.analysis;
    ensure(record(analysis)&&text(analysis.question)&&text(analysis.explanation),`${label}：分析题缺少问题或解释。`);
    strings(analysis.options,3,`${label} 分析选项`);
    ensure(Number.isInteger(analysis.answer)&&analysis.answer>=0&&analysis.answer<3,`${label}：analysis.answer 必须是 0、1 或 2。`);
  };
  for(const item of course.application)task(item,'application','');
  sameSet(course.application.map(item=>item.genre),APPLICATION_GENRES,'应用文文体');
  const groups=new Set();
  for(const group of course.continuationGroups){
    ensure(record(group),'续写主题必须是对象。');
    const expected=CONTINUATION_GROUPS.find(item=>item.id===group.id);
    ensure(expected&&!groups.has(group.id),`续写主题 ID 无效或重复：${String(group.id)}。`);groups.add(group.id);
    ensure(group.title===expected.title&&text(group.description),`续写主题 ${group.id} 的名称或说明不完整。`);
    ensure(Array.isArray(group.items)&&group.items.length>=expected.topics.length,`续写主题 ${group.title} 缺少题目。`);
    for(const item of group.items)task(item,'continuation',group.title);
    sameSet(group.items.map(item=>item.genre),expected.topics,group.title);
  }
  for(const id of Object.keys(scaffolds))ensure(ids.has(id),`支架 ${id} 没有对应题目，请移除或补充题目。`);
  return {taskCount:ids.size,applicationCount:course.application.length,continuationCount:course.continuationGroups.reduce((sum,g)=>sum+g.items.length,0)};
}

async function jsonFile(filename){
  const source=await readFile(filename,'utf8');
  ensure(Buffer.byteLength(source)<=10*1024*1024,`${filename} 超过 10 MB。`);
  try{return JSON.parse(source.replace(/^\uFEFF/,''));}catch(error){throw new Error(`${filename} 不是有效 JSON：${error.message}`);}
}
export async function loadInputs(coursePath=path.join(ROOT,'data/course.json'),scaffoldPath=path.join(ROOT,'data/scaffolds.json')){
  const [course,scaffolds,template,styles,auth,app]=await Promise.all([
    jsonFile(path.resolve(coursePath)),jsonFile(path.resolve(scaffoldPath)),
    ...['template.html','styles.css','local-auth.js','app.js'].map(name=>readFile(path.join(ROOT,'assets',name),'utf8'))
  ]);
  return {course,scaffolds,assets:{template,styles,auth,app}};
}
export const inlineJSON=value=>JSON.stringify(value).replace(/</g,'\\u003c').replace(/\u2028/g,'\\u2028').replace(/\u2029/g,'\\u2029');
const scriptSafe=source=>source.replace(/<\/script/gi,'<\\/script');
const styleSafe=source=>source.replace(/<\/style/gi,'<\\/style');
export function renderHTML(course,scaffolds,assets){
  validateData(course,scaffolds);
  const values={
    STUDIO_CSS:styleSafe(assets.styles),
    STUDIO_DATA:'const writingCatalog = '+inlineJSON(course)+';',
    STUDIO_SCAFFOLDS:'const writingScaffolds = '+inlineJSON(scaffolds)+';',
    STUDIO_AUTH:scriptSafe(assets.auth),STUDIO_APP:scriptSafe(assets.app)
  };
  ensure(typeof assets.template==='string','缺少 HTML 模板。');
  let result=assets.template;
  for(const [key,value]of Object.entries(values)){
    const token='{{'+key+'}}';
    ensure(result.split(token).length===2,`模板占位符 ${token} 必须出现一次。`);
    result=result.replace(token,()=>value);
  }
  return result;
}
export function extractInlineScripts(html){
  const result=[];
  for(const match of html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script\s*>/gi)){
    ensure(!/\bsrc\s*=/i.test(match[1]),'分享版不允许外部脚本。');result.push(match[2]);
  }
  return result;
}

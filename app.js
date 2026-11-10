'use strict';
(async()=>{
await window.StudentSession.ready;
const $ = (selector, root=document) => root.querySelector(selector);
const $$ = (selector, root=document) => [...root.querySelectorAll(selector)];
const icon = id => `<svg aria-hidden="true"><use href="#i-${id}"/></svg>`;
const escapeHTML = value => String(value).replace(/[&<>"']/g, char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const session = window.StudentSession;
const store = {get:(key,fallback='')=>session.get(key,fallback),set:(key,value)=>session.set(key,value)};
const dialog = $('#preview-dialog');
const continuationTasks = writingCatalog.continuationGroups.flatMap(group=>group.items);
const allTasks = [...writingCatalog.application,...continuationTasks];
const taskData = Object.fromEntries(allTasks.map(task=>[task.id,task]));
const taskKey = (suffix,id=selectedTask) => `task-${id}-${suffix}`;
const selections = {
  application: store.get('selection-application','invitation'),
  continuation: store.get('selection-continuation','kindness')
};
for(const type of ['application','continuation']){
  if(!taskData[selections[type]] || taskData[selections[type]].type!==type){
    selections[type]=type==='application'?writingCatalog.application[0].id:continuationTasks[0].id;
  }
}
let activeMode = store.get('active-mode','application');
if(!['application','continuation'].includes(activeMode))activeMode='application';
let selectedTask=selections[activeMode], currentStage=0, activeTrigger, toastTimer;
const steps = [
  ['审题练习','读懂任务，再动笔。','应用文先确认写作对象、交际目的、要点与语气；续写先理清人物、冲突、情节线索和两段首句。'],
  ['写前支架','先学习方法，再尝试套用。','分析文体框架或续写情节，练习句型并写下自己的提纲。写前支架只在这一环节出现。'],
  ['独立写作','收起支架，自己完成。','仅依据题目要求自主写作。此环节不显示框架、句型、范文或语言提示。'],
  ['诊断与修改','让反馈变成具体行动。','计划按内容、语言和篇章组织提供反馈。选择最需要解决的问题修改，并保留初稿与修改稿。'],
  ['修改后自评','用证据评价自己的进步。','对修改后的作文按量表打分，再写下“我改了什么、为什么这样改”，把修改变成有意识的学习。'],
  ['匿名互评','从另一位读者的视角看作文。','依据同一量表打分，指出一个有证据的优点、提出一条具体建议。作者阅读后决定如何再改。'],
  ['成长反思','把这一次的收获带到下一篇。','回顾初稿与终稿，记录本次收获和下一次的目标。两类写作分别积累成长记录。']
];
function groupFor(task){return writingCatalog.continuationGroups.find(group=>group.items.some(item=>item.id===task.id))}
function setWritingMode(type){
  activeMode=type;store.set('active-mode',type);
  $$('[data-mode]').forEach(button=>{const on=button.dataset.mode===type;button.setAttribute('aria-selected',String(on));button.tabIndex=on?0:-1});
  for(const mode of ['application','continuation'])$('#panel-'+mode).hidden=mode!==type;
}
function previewHTML(task){
  const category=task.type==='application'?`应用文 / ${task.genre}`:`${task.group} / ${task.genre}`;
  const saved=store.get(taskKey('draft',task.id)).trim();
  return `<div class="preview-topline"><span class="exercise-category">${escapeHTML(category)}</span><span class="original-label">原创示例题</span></div>
    <h3>${escapeHTML(task.title)}</h3><p class="exercise-summary">${escapeHTML(task.summary)}</p>
    <div class="exercise-meta"><span>${icon('pen')}约 ${task.target} 词</span><span>${icon('clock')}建议 ${task.time} 分钟</span><span>${task.max} 分制 · 教学参考</span></div>
    <div class="exercise-actions"><span class="task-local-status">${saved?'已有账号草稿 · 可继续编辑':'从审题开始，完成七步学习闭环'}</span><button class="btn ${task.type==='application'?'primary':'secondary'}" data-task="${task.id}">${saved?'继续我的草稿':'开始这篇练习'} ${icon('arrow')}</button></div>`;
}
function renderLibrary(){
  const application=taskData[selections.application],continuation=taskData[selections.continuation];
  $('#genre-options').innerHTML=writingCatalog.application.map(task=>`<button class="filter-option" aria-pressed="${task.id===application.id}" data-exercise="${task.id}">${escapeHTML(task.genre+(writingCatalog.application.some(other=>other.id!==task.id&&other.genre===task.genre)?' · '+task.title:''))}</button>`).join('');
  const selectedGroup=groupFor(continuation);
  $('#theme-groups').innerHTML=writingCatalog.continuationGroups.map(group=>`<button class="theme-group" aria-pressed="${group.id===selectedGroup.id}" data-group="${group.id}"><strong>${escapeHTML(group.title)}</strong><small>${escapeHTML(group.description)}</small><span class="group-count">${group.items.length}</span></button>`).join('');
  $('#topic-options').innerHTML=selectedGroup.items.map(task=>`<button class="filter-option" aria-pressed="${task.id===continuation.id}" data-exercise="${task.id}">${escapeHTML(task.genre+(selectedGroup.items.some(other=>other.id!==task.id&&other.genre===task.genre)?' · '+task.title:''))}</button>`).join('');
  $('#application-preview').innerHTML=previewHTML(application);
  $('#continuation-preview').innerHTML=previewHTML(continuation);
  setWritingMode(activeMode);
}
function selectExercise(id,announce=true){
  const task=taskData[id];if(!task)return;
  selections[task.type]=id;activeMode=task.type;store.set('selection-'+task.type,id);
  if(task.type==='continuation')store.set('group-selection-'+groupFor(task).id,id);
  renderLibrary();
  if(announce)$('#selection-status').textContent=`已切换至${task.genre}：${task.title}。`;
}
function toast(message){
  const node=$('#toast');(dialog.open?dialog:document.body).appendChild(node);node.textContent=message;node.classList.add('visible');clearTimeout(toastTimer);toastTimer=setTimeout(()=>node.classList.remove('visible'),3200);
}
function openDialog(title,eyebrow,body,trigger){
  dialog.classList.remove('independent-stage');
  if(!dialog.open)activeTrigger=trigger||document.activeElement;
  $('#dialog-title').textContent=title;$('#dialog-eyebrow').textContent=eyebrow;$('#dialog-body').innerHTML=body;
  if(!dialog.open)dialog.showModal();dialog.scrollTop=0;$('.close-button').focus();
}
function notice(text){return `<div class="notice">${icon('info')}<span>${text}</span></div>`}
function openGuide(trigger){
  openDialog('Write. Reflect. Improve.','WRITING STUDIO · THE LEARNING LOOP',`<p class="modal-intro">每一次写作，每一次反思，都让表达更进一步。</p><div class="guide-grid">${steps.map((step,i)=>`<div class="guide-step"><span>0${i+1}</span><h3>${step[0]} · ${step[1]}</h3><p>${step[2]}</p></div>`).join('')}</div>${notice('设计预览已提供 14 种应用文文体和 13 个续写子主题，每类各 1 道原创示例题。写前支架提供结构分析与句型练习；独立写作不显示提示。学习记录仅按本机账号与题目分别保存，不与线上账号同步；AI 反馈和匿名互评仍为预设演示。')}<div class="dialog-bottom"><button class="btn primary" data-begin="application">从应用文开始 ${icon('arrow')}</button></div>`,trigger);
}
function taskTabs(){return `<div class="task-tabs" role="tablist" aria-label="学习阶段">${steps.map((step,i)=>`<button class="task-tab ${i===currentStage?'selected':''}" role="tab" aria-selected="${i===currentStage}" aria-controls="stage-panel" id="stage-tab-${i}" tabindex="${i===currentStage?'0':'-1'}" data-stage="${i}">${i+1}. ${step[0]}</button>`).join('')}</div>`}
function workspaceSelector(task){
  const options=(items,current)=>items.map(item=>`<option value="${item.id}"${item.id===current?' selected':''}>${escapeHTML((item.genre||item.title)+(items.some(other=>other.id!==item.id&&other.genre===item.genre)?' · '+item.title:''))}</option>`).join('');
  const fields=task.type==='application'
    ?`<label>应用文文本类型<select data-workspace-exercise aria-label="切换应用文文体">${options(writingCatalog.application,task.id)}</select></label>`
    :`<label>主题语境<select data-workspace-group aria-label="切换续写主题语境">${writingCatalog.continuationGroups.map(group=>`<option value="${group.id}"${group.id===groupFor(task).id?' selected':''}>${escapeHTML(group.title)}</option>`).join('')}</select></label><label>具体方向<select data-workspace-exercise aria-label="切换续写具体主题">${options(groupFor(task).items,task.id)}</select></label>`;
  return `<div class="workspace-selection">${fields}<small>可随时切换；切换后返回审题，每篇草稿、自评与反思分别保存到你的本机学习账号。</small></div>`;
}
function openTask(idOrType,stage=0,trigger){
  const id=taskData[idOrType]?idOrType:selections[idOrType],task=taskData[id];if(!task)return;
  selectExercise(id,false);selectedTask=id;currentStage=stage;
  openDialog(task.name,'WRITING STUDIO · 写作学习空间',`${workspaceSelector(task)}${taskTabs()}<div id="stage-panel" class="stage-section" role="tabpanel" aria-labelledby="stage-tab-${stage}">${stageContent(task,stage)}</div>`,trigger);dialog.classList.toggle('independent-stage',stage===2);bindStage();
}
function stageContent(task,stage){
  const next=(label='下一步')=>`<div class="dialog-bottom"><small>流程预览 · AI 与同伴反馈为演示</small><button class="btn primary" data-next>${label} ${icon('arrow')}</button></div>`;
  const context=`<div class="workspace-context">当前练习：<b>${escapeHTML(task.genre)} · ${escapeHTML(task.title)}</b></div>`;
  if(stage===0)return `<div class="stage-label">原创示例题 · 约 ${task.target} 词 · 建议 ${task.time} 分钟</div><div class="prompt-card"><h3>先读一读写作任务</h3><p class="${task.type==='continuation'?'english':''}">${escapeHTML(task.prompt)}</p></div><div class="checklist">${task.checklist.map((text,i)=>`<label><input type="checkbox" data-check="${i}" ${store.get(taskKey('check-'+i))==='1'?'checked':''}>${escapeHTML(text)}</label>`).join('')}</div>${next('进入写前支架')}`;
  if(stage===1)return scaffoldContent(task);
  if(stage===2)return `<div class="independent-layout"><section class="independent-task" aria-labelledby="writing-task-title"><h3 id="writing-task-title">题目要求</h3><p>${escapeHTML(task.prompt)}</p></section><section class="independent-draft"><label class="editor-label" for="draft"><span>独立写作</span><span id="word-count">0 词</span></label><textarea class="editor" id="draft" spellcheck="false" autocomplete="off" autocorrect="off" autocapitalize="off" data-gramm="false" data-gramm_editor="false" data-enable-grammarly="false" lang="en" aria-label="独立写作正文">${escapeHTML(store.get(taskKey('draft')))}</textarea><div class="independent-save-row"><span id="save-status" role="status">${escapeHTML($('#account-sync-status').textContent||'已保存在当前浏览器')}</span><button class="btn primary" data-next>完成独立写作 ${icon('arrow')}</button></div></section></div>`;
  if(stage===3){const feedback=task.feedback;return `${context}${notice('以下为针对当前预设示例作文的反馈演示，不会分析你输入的草稿；真实 AI 诊断尚未接入。')}<div class="prompt-card"><h3>预设示例片段 · ${escapeHTML(task.genre)}</h3><p class="english">${escapeHTML(feedback.snippet)}</p></div><div class="sample-item"><h4>01 · ${escapeHTML(feedback.heading)}</h4><p>${escapeHTML(feedback.explanation)}</p></div><div class="sample-item"><h4>02 · 对照修改思路</h4><p class="english"><mark>${escapeHTML(feedback.before)}</mark><br>↓<br><ins>${escapeHTML(feedback.after)}</ins></p></div><p class="rubric-note">先理解修改的理由，再用自己的语言重写。后续版本将保留初稿与修改稿，逐项记录修改。</p>${next('体验修改后自评')}`}
  if(stage===4)return `${context}${notice('自评表单演示：在真实练习中，应先完成修改，再对修改稿打分。以下输入会自动保存到当前浏览器的本机账号。')}<h3>依据量表，给修改稿打分</h3>${ratingForm(task,'self')}<label class="field-label" for="self-reflection">我改了什么？为什么这样改？</label><textarea id="self-reflection" class="reflection" placeholder="指出一处具体的修改，并说明它如何改善内容、语言或篇章。">${escapeHTML(store.get(taskKey('self-reflection')))}</textarea><p class="rubric-note">平台教学参考量表，可由教师调整；并非官方评分标准。</p><div class="dialog-bottom"><button class="btn muted-btn" data-save-self>保存自评</button><button class="btn primary" data-next>查看互评示例 ${icon('arrow')}</button></div>`;
  if(stage===5)return `${context}${peerContent(task,true)}`;
  return `${context}${notice('成长反思页预览：目前尚未生成真实能力分数或完成记录。反思与目标会按题自动保存到当前浏览器的本机账号。')}<h3>留下这一次的收获</h3><label class="field-label" for="growth-reflection">这次练习，我学会了什么？</label><textarea id="growth-reflection" class="reflection" placeholder="写下一条可以用到下一篇作文中的经验。">${escapeHTML(store.get(taskKey('growth-reflection')))}</textarea><label class="field-label" for="next-goal">下一次，我想重点练习什么？</label><textarea id="next-goal" class="reflection" placeholder="目标越具体，下一次越容易行动。">${escapeHTML(store.get(taskKey('next-goal')))}</textarea><div class="dialog-bottom"><button class="btn muted-btn" data-save-reflection>保存反思</button><button class="btn primary" data-report>查看示例成长报告 ${icon('arrow')}</button></div>`;
}
function scaffoldContent(task){
  const scaffold=writingScaffolds[task.id];
  const choice=store.get(taskKey('scaffold-answer'));
  return `<div class="scaffold-stage"><div class="scaffold-intro"><span class="section-eyebrow">BEFORE YOU WRITE</span><h3>先练方法，再独立表达</h3><p>${escapeHTML(scaffold.focus)}</p></div><div class="scaffold-section"><h4>01 / ${task.type==='application'?'看懂文体框架':'梳理续写思路'}</h4><div class="framework-grid">${scaffold.framework.map((part,i)=>`<article><span>0${i+1}</span><h5>${escapeHTML(part.label)}</h5><p>${escapeHTML(part.guidance)}</p></article>`).join('')}</div></div><div class="scaffold-section"><h4>02 / 分析并尝试套用句型</h4><div class="pattern-list">${scaffold.patterns.map(pattern=>`<div><p lang="en">${escapeHTML(pattern.phrase)}</p><span>${escapeHTML(pattern.usage)}</span></div>`).join('')}</div></div><div class="scaffold-section"><h4>03 / 做一道分析练习</h4><fieldset class="scaffold-question"><legend>${escapeHTML(scaffold.analysis.question)}</legend>${scaffold.analysis.options.map((option,i)=>`<label><input type="radio" name="scaffold-answer" data-scaffold-answer value="${i}"${choice===String(i)?' checked':''}><span>${escapeHTML(option)}</span></label>`).join('')}</fieldset><button class="btn muted-btn" data-check-scaffold>查看分析</button><div id="scaffold-analysis-feedback" class="scaffold-feedback" role="status" hidden></div></div><div class="scaffold-section"><h4>04 / 写下自己的写前构思</h4><label class="field-label" for="scaffold-plan">${escapeHTML(scaffold.transferPrompt)}</label><textarea id="scaffold-plan" class="reflection scaffold-plan" placeholder="在这里练习自己的构思或句型套用。">${escapeHTML(store.get(taskKey('scaffold-plan')))}</textarea></div><div class="scaffold-exit-note">进入独立写作后，这里的框架、句型与分析都会收起，写前构思也不会带入正文。</div><div class="dialog-bottom"><button class="btn primary" data-next>收起支架，开始独立写作 ${icon('arrow')}</button></div></div>`;
}
function checkScaffoldAnalysis(){
  const selected=$('[data-scaffold-answer]:checked',dialog);
  const feedback=$('#scaffold-analysis-feedback');feedback.hidden=false;
  if(!selected){feedback.textContent='请先选择一个答案，再查看分析。';return}
  const analysis=writingScaffolds[selectedTask].analysis;
  feedback.textContent=(Number(selected.value)===analysis.answer?'分析正确。':'再想一想。')+analysis.explanation;
}
function ratingForm(task,prefix){
  return `<div class="rating-form" data-prefix="${prefix}">${task.dimensions.map(([name,max],i)=>{const value=Math.max(0,Math.min(max,Number(store.get(taskKey(prefix+'-score-'+i),'0'))||0));return `<label class="rating-row" for="${prefix}-score-${i}"><span>${escapeHTML(name)} / ${max}</span><input id="${prefix}-score-${i}" data-rating type="range" min="0" max="${max}" step="1" value="${value}"><output for="${prefix}-score-${i}">${value}</output></label>`}).join('')}<div class="score-total">${prefix==='self'?'我的自评':'演示评分'}：<strong data-total>0</strong> / ${task.max}</div></div>`;
}
function peerContent(task,inTask=false){return `${notice('匿名互评演示：下方为当前题目的预设示例作品，不来自真实学生；演示评价不会发送给其他人。')}<div class="prompt-card"><h3>示例作品 · ${escapeHTML(task.genre)} · 匿名作者 A</h3><p class="peer-text">${escapeHTML(task.sample)}</p></div>${ratingForm(task,'peer')}<label class="field-label" for="peer-strength">一个优点，请结合原文说明</label><textarea class="reflection" id="peer-strength" placeholder="引用一处表达或情节，说明它为什么有效。">${escapeHTML(store.get(taskKey('peer-strength')))}</textarea><label class="field-label" for="peer-advice">一条具体、可操作的修改建议</label><textarea class="reflection" id="peer-advice" placeholder="指出可以修改的一处，并说明理由。">${escapeHTML(store.get(taskKey('peer-advice')))}</textarea><p class="rubric-note">评分采用平台教学参考量表，并非官方评分标准。互评时尊重作者，评价作品。</p><div class="dialog-bottom"><button class="btn muted-btn" data-peer-submit>完成演示评价</button>${inTask?`<button class="btn primary" data-next>进入成长反思 ${icon('arrow')}</button>`:''}</div>`}
function bindRatings(){
  $$('[data-rating]',dialog).forEach(input=>{
    const update=()=>{input.nextElementSibling.value=input.value;const form=input.closest('.rating-form');$('[data-total]',form).textContent=$$('[data-rating]',form).reduce((sum,range)=>sum+Number(range.value),0)};
    input.addEventListener('input',()=>{update();store.set(taskKey(input.closest('.rating-form').dataset.prefix+'-score-'+input.id.split('-').pop()),input.value)});update();
  });
}
function bindStage(){
  bindRatings();
  ['scaffold-plan','self-reflection','growth-reflection','next-goal','peer-strength','peer-advice'].forEach(id=>{const input=$('#'+id);if(input)input.addEventListener('input',()=>store.set(taskKey(id),input.value))});
  const draft=$('#draft');
  if(draft){
    const update=()=>{const words=draft.value.match(/[A-Za-z]+(?:['’\-][A-Za-z]+)*/g)||[];$('#word-count').textContent=`${words.length} 词`};update();
    draft.addEventListener('input',()=>{update();store.set(taskKey('draft'),draft.value)});
  }
  $$('[data-check]',dialog).forEach(input=>input.addEventListener('change',()=>store.set(taskKey('check-'+input.dataset.check),input.checked?'1':'0')));
}
function changeStage(stage){
  currentStage=stage;dialog.classList.toggle('independent-stage',stage===2);$('#dialog-body').innerHTML=`${workspaceSelector(taskData[selectedTask])}${taskTabs()}<div id="stage-panel" class="stage-section" role="tabpanel" aria-labelledby="stage-tab-${stage}">${stageContent(taskData[selectedTask],stage)}</div>`;bindStage();dialog.scrollTop=0;$(`[data-stage="${stage}"]`,dialog).focus();
}
function openPeer(trigger){selectedTask=selections[activeMode];openDialog('换个视角，读一篇作文','WRITING STUDIO · 匿名互评演示',peerContent(taskData[selectedTask]),trigger);bindStage()}

function openReport(trigger){openDialog('每一点进步，都有迹可循','WRITING STUDIO · 示例成长报告',`${notice('以下为虚构的报告样式，所有分数与练习次数均为演示数据，不代表你的真实水平。真实报告将在完整学习记录接入后生成。')}<div class="sample-report"><div class="report-title"><h3>应用文 · 四次练习的变化</h3><span class="sample-pill">示例数据</span></div><svg class="report-chart" viewBox="0 0 620 225" role="img" aria-label="虚构示例：四次应用文练习得分依次为 8、9、9、11 分，满分 15 分"><g stroke="#e4eadd" stroke-width="1" fill="none"><path d="M45 20H590M45 80H590M45 140H590M45 200H590"/></g><text x="12" y="24">15</text><text x="12" y="84">10</text><text x="18" y="144">5</text><text x="18" y="204">0</text><path d="M70 104 235 92 400 92 565 68 565 200 70 200Z" fill="#edf4e7" stroke="none"/><path d="m70 104 165-12h165l165-24" stroke="#759668" stroke-width="2.5"/><g fill="#fff" stroke="#759668" stroke-width="2"><circle cx="70" cy="104" r="5"/><circle cx="235" cy="92" r="5"/><circle cx="400" cy="92" r="5"/><circle cx="565" cy="68" r="5"/></g><text x="64" y="89">8</text><text x="229" y="77">9</text><text x="394" y="77">9</text><text x="557" y="53">11</text><text x="48" y="222">练习 1</text><text x="213" y="222">练习 2</text><text x="378" y="222">练习 3</text><text x="543" y="222">练习 4</text></svg><div class="report-summary"><div><strong>4 次</strong>完整练习 · 示例</div><div><strong>+3 分</strong>应用文变化 · 示例</div><div><strong>语气得体</strong>本阶段亮点 · 示例</div></div></div><div class="sample-item"><h4>从分数走向具体能力</h4><p>计划分别展示应用文（15 分制）和读后续写（25 分制）的内容、语言与篇章变化；初稿和修改稿分开记录，AI、自评、互评分来源呈现。</p></div><div class="sample-item"><h4>下一次练习建议 · 示例</h4><p>邀请目的已经比较清楚。下一篇尝试补充更具体的活动细节，并检查请求语气是否得体。</p></div><p class="rubric-note">教学参考量表，不作为官方考试评分依据。成长曲线可能有起伏，持续修改比每次涨分更重要。</p>`,trigger)}


document.addEventListener('click',async event=>{
  const button=event.target.closest('button');if(!button)return;
  if(button.matches('.close-button'))dialog.close();
  if(button.dataset.open==='guide')openGuide(button);
  if(button.dataset.open==='peer')openPeer(button);
  if(button.dataset.open==='report'||button.hasAttribute('data-report'))openReport(button);
  if(button.dataset.mode)setWritingMode(button.dataset.mode);
  if(button.dataset.exercise){selectExercise(button.dataset.exercise);$(`[data-exercise="${button.dataset.exercise}"]`)?.focus({preventScroll:true})}
  if(button.dataset.group){const group=writingCatalog.continuationGroups.find(item=>item.id===button.dataset.group);const remembered=store.get('group-selection-'+group.id);const id=group.items.some(item=>item.id===remembered)?remembered:group.items[0].id;selectExercise(id);$(`[data-group="${group.id}"]`)?.focus({preventScroll:true})}
  if(button.dataset.task){const id=button.dataset.task;openTask(id,store.get(taskKey('draft',id)).trim()?2:0,button)}
  if(button.dataset.begin)openTask(selections[button.dataset.begin]||button.dataset.begin,0,button);
  if(button.hasAttribute('data-stage'))changeStage(Number(button.dataset.stage));
  if(button.hasAttribute('data-check-scaffold'))checkScaffoldAnalysis();
  if(button.hasAttribute('data-next'))changeStage(Math.min(6,currentStage+1));
  if(button.hasAttribute('data-save-self')){let ok=true;$$('[data-rating]',dialog).forEach((input,i)=>{ok=store.set(taskKey('self-score-'+i),input.value)&&ok});ok=store.set(taskKey('self-reflection'),$('#self-reflection').value)&&ok;const synced=ok&&await session.flush();toast(synced?'自评已保存到你的本机学习账号':'本机保存未成功，请保持页面打开并导出备份')}
  if(button.hasAttribute('data-save-reflection')){const ok=store.set(taskKey('growth-reflection'),$('#growth-reflection').value)&&store.set(taskKey('next-goal'),$('#next-goal').value);const synced=ok&&await session.flush();toast(synced?'反思与目标已保存到你的本机学习账号':'本机保存未成功，请保持页面打开并导出备份')}
  if(button.hasAttribute('data-peer-submit')){const strength=$('#peer-strength'),advice=$('#peer-advice');if(!strength.value.trim()||!advice.value.trim()){toast('请填写一个具体优点和一条修改建议');(!strength.value.trim()?strength:advice).focus()}else toast('已完成评价演示 · 未发送给真实同伴')}
});
document.addEventListener('change',event=>{
  const input=event.target;
  if(input.matches('[data-scaffold-answer]'))store.set(taskKey('scaffold-answer'),input.value);
  if(input.matches('[data-workspace-exercise]')){openTask(input.value,0);$('[data-workspace-exercise]',dialog).focus()}
  if(input.matches('[data-workspace-group]')){const group=writingCatalog.continuationGroups.find(item=>item.id===input.value);const remembered=store.get('group-selection-'+group.id);openTask(group.items.some(item=>item.id===remembered)?remembered:group.items[0].id,0);$('[data-workspace-group]',dialog).focus()}
});
document.addEventListener('keydown',event=>{
  if(!event.target.matches('[data-mode]')||!['ArrowRight','ArrowLeft','Home','End'].includes(event.key))return;
  event.preventDefault();const mode=event.key==='Home'?'application':event.key==='End'?'continuation':activeMode==='application'?'continuation':'application';setWritingMode(mode);$('[data-mode="'+mode+'"]').focus();
});
dialog.addEventListener('keydown',event=>{
  if(!event.target.matches('[data-stage]'))return;let stage=currentStage;
  if(event.key==='ArrowRight')stage=(stage+1)%7;else if(event.key==='ArrowLeft')stage=(stage+6)%7;else if(event.key==='Home')stage=0;else if(event.key==='End')stage=6;else return;
  event.preventDefault();changeStage(stage);
});
dialog.addEventListener('close',()=>{renderLibrary();if(activeTrigger?.isConnected)activeTrigger.focus();else $('[data-mode="'+activeMode+'"]').focus()});
dialog.addEventListener('click',event=>{if(event.target===dialog){const rect=dialog.getBoundingClientRect();if(event.clientX<rect.left||event.clientX>rect.right||event.clientY<rect.top||event.clientY>rect.bottom)dialog.close()}});
const goal=$('#daily-goal');goal.checked=store.get('goal')==='1';
function updateGoal(){$('#goal-note').textContent=goal.checked?'为认真完成小目标的自己，点个赞。':'小目标，也值得认真完成。'}
updateGoal();goal.addEventListener('change',()=>{store.set('goal',goal.checked?'1':'0');updateGoal()});
$$('.nav-item[href]').forEach(link=>link.addEventListener('click',()=>{$$('.nav-item').forEach(item=>item.classList.remove('active'));link.classList.add('active')}));
renderLibrary();

})().catch(()=>{const node=document.querySelector('#auth-error');if(node)node.textContent='学习空间暂时未能加载，请刷新后重试。'});

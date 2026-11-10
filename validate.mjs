import path from 'node:path';
import {ROOT,loadInputs,validateData} from './lib.mjs';

try{
  const coursePath=process.argv[2]?path.resolve(process.argv[2]):path.join(ROOT,'data/course.json');
  const scaffoldPath=process.argv[3]?path.resolve(process.argv[3]):path.join(ROOT,'data/scaffolds.json');
  const {course,scaffolds}=await loadInputs(coursePath,scaffoldPath);
  const result=validateData(course,scaffolds);
  console.log(`数据验证通过：${result.taskCount} 题，应用文 ${result.applicationCount} 题，读后续写 ${result.continuationCount} 题；所有支架完整。`);
}catch(error){console.error('验证失败：'+error.message);process.exitCode=1;}

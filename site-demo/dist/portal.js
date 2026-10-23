import {requireDemoAccess} from './demo-access.js';
await requireDemoAccess();
const learning=document.querySelector('#overview-panel');
const overtime=document.querySelector('#overtime-panel');
const pending=document.querySelector('#overtime-button');
const help=document.querySelector('#help-dialog');
function showLearning(){learning.hidden=false;overtime.hidden=true;pending.classList.remove('selected');pending.setAttribute('aria-expanded','false');}
pending.addEventListener('click',()=>{learning.hidden=true;overtime.hidden=false;pending.classList.add('selected');document.querySelector('#learning-card').classList.remove('selected');pending.setAttribute('aria-expanded','true');document.querySelector('#workspace-title').focus();});
document.querySelector('#back-to-overview').addEventListener('click',showLearning);
document.querySelector('#help-button').addEventListener('click',()=>help.showModal());
document.querySelector('#close-help').addEventListener('click',()=>help.close());
if(['127.0.0.1','localhost'].includes(location.hostname))document.querySelector('#environment').textContent='로컬 테스트 · 교육·실습용';

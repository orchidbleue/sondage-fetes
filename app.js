(() => {
  'use strict';

  // Les semaines affichées sont volontairement fixes : fêtes 2026–2027.
  const DAYS = [
    { id:'2026-12-21', name:'Lun.', number:21, month:'DÉC.', full:'Lundi 21 décembre', short:'21 déc.', week:1 },
    { id:'2026-12-22', name:'Mar.', number:22, month:'DÉC.', full:'Mardi 22 décembre', short:'22 déc.', week:1 },
    { id:'2026-12-23', name:'Mer.', number:23, month:'DÉC.', full:'Mercredi 23 décembre', short:'23 déc.', week:1 },
    { id:'2026-12-24', name:'Jeu.', number:24, month:'DÉC.', full:'Jeudi 24 décembre', short:'24 déc.', week:1, blocked:true },
    { id:'2026-12-25', name:'Ven.', number:25, month:'DÉC.', full:'Vendredi 25 décembre', short:'25 déc.', week:1, blocked:true },
    { id:'2026-12-26', name:'Sam.', number:26, month:'DÉC.', full:'Samedi 26 décembre', short:'26 déc.', week:1 },
    { id:'2026-12-28', name:'Lun.', number:28, month:'DÉC.', full:'Lundi 28 décembre', short:'28 déc.', week:2 },
    { id:'2026-12-29', name:'Mar.', number:29, month:'DÉC.', full:'Mardi 29 décembre', short:'29 déc.', week:2 },
    { id:'2026-12-30', name:'Mer.', number:30, month:'DÉC.', full:'Mercredi 30 décembre', short:'30 déc.', week:2 },
    { id:'2026-12-31', name:'Jeu.', number:31, month:'DÉC.', full:'Jeudi 31 décembre', short:'31 déc.', week:2, blocked:true },
    { id:'2027-01-01', name:'Ven.', number:1, month:'JANV.', full:'Vendredi 1er janvier', short:'1er janv.', week:2, blocked:true },
    { id:'2027-01-02', name:'Sam.', number:2, month:'JANV.', full:'Samedi 2 janvier', short:'2 janv.', week:2 }
  ];
  const STORAGE_KEY = 'orchidbleue-sondage-fetes-2026-v1';
  const allowedDays = new Set(DAYS.filter(d => !d.blocked).map(d => d.id));
  const $ = id => document.getElementById(id);
  const stageNames = ['intro','calendar','success'];
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const gsap = window.gsap;
  const configURL = String(window.ORCHID_CONFIG?.SCRIPT_URL || '').trim();
  const configured = /^https:\/\/script\.google\.com\/macros\/s\/[\w-]+\/exec\/?(?:\?.*)?$/i.test(configURL);
  const saved = readPreviousResponse();
  let submissionId = saved?.id || newId();
  let selected = new Set(saved?.dates || []);
  let noneNeeded = Boolean(saved?.aucunBesoin);
  let currentStage = 'intro';
  let navigating = false;
  let pendingNonce = null;
  let submitTimer = null;

  function newId(){
    if (window.crypto?.randomUUID) return crypto.randomUUID();
    if (window.crypto?.getRandomValues) {
      const numbers = crypto.getRandomValues(new Uint8Array(16));
      return Array.from(numbers, n => n.toString(16).padStart(2,'0')).join('');
    }
    return `local-${Date.now()}-${Math.random().toString(36).slice(2,12)}`;
  }
  function readPreviousResponse(){
    try {
      const response = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null');
      if (!response || !/^[A-Za-z0-9_-]{16,80}$/.test(response.id) || !Array.isArray(response.dates)) return null;
      if (!response.dates.every(id => allowedDays.has(id)) || new Set(response.dates).size !== response.dates.length) return null;
      if (typeof response.aucunBesoin !== 'boolean') return null;
      if (response.aucunBesoin && response.dates.length) return null;
      return response;
    } catch { return null; }
  }
  function makeDayButton(day){
    const button = document.createElement('button');
    button.type='button';
    button.className='date-tile';
    button.dataset.date=day.id;
    const isSelected = selected.has(day.id);
    if (day.blocked) {
      button.disabled=true;
      button.setAttribute('aria-label',`${day.full}, journée non offerte`);
    } else {
      button.setAttribute('aria-pressed',String(isSelected));
      button.setAttribute('aria-label',day.full);
      button.addEventListener('click',() => toggleDate(day.id));
    }
    button.innerHTML = `<span class="day-name">${day.name}</span><span class="day-number">${day.number}</span>${day.blocked ? '<span class="closed-text">Non offert</span>' : `<span class="day-month">${day.month}</span><span class="selected-check" aria-hidden="true">✓</span>`}`;
    if (isSelected) button.classList.add('is-selected');
    return button;
  }
  function createCalendar(){
    const first=$('week-one');
    const second=$('week-two');
    DAYS.forEach(day => (day.week === 1 ? first : second).append(makeDayButton(day)));
  }
  function toggleDate(id){
    if (pendingNonce) return;
    if (noneNeeded) {
      noneNeeded=false;
      $('no-need').checked=false;
    }
    if (selected.has(id)) selected.delete(id); else selected.add(id);
    updateCalendar();
    if (gsap && !reducedMotion) {
      const tile = document.querySelector(`.date-tile[data-date="${id}"]`);
      gsap.fromTo(tile,{scale:.96},{scale:1,duration:.27,ease:'back.out(2)'});
    }
  }
  function orderedDays(){ return DAYS.filter(day => selected.has(day.id)); }
  function updateCalendar(){
    document.querySelectorAll('.date-tile:not(:disabled)').forEach(tile => {
      const isSelected = selected.has(tile.dataset.date);
      tile.classList.toggle('is-selected',isSelected);
      tile.setAttribute('aria-pressed',String(isSelected));
    });
    $('selection-count').textContent=selected.size;
    $('selection-count-label').textContent=selected.size > 1 ? 'journées sélectionnées' : 'journée sélectionnée';
    const chips=$('selection-chips');
    chips.replaceChildren();
    if (noneNeeded) {
      const p=document.createElement('p'); p.className='empty-selection';p.textContent='Aucun service nécessaire pendant ces dates.';chips.append(p);
    } else if (selected.size === 0) {
      const p=document.createElement('p');p.className='empty-selection';p.textContent='Vos journées choisies apparaîtront ici. ✦';chips.append(p);
    } else {
      orderedDays().forEach(day => {const chip=document.createElement('span');chip.className='date-chip';chip.textContent=day.short;chips.append(chip);});
    }
    $('no-need').checked=noneNeeded;
    $('submit-button').disabled=(selected.size===0 && !noneNeeded) || Boolean(pendingNonce);
    $('submit-error').hidden=true;
  }
  function setProgress(stage){
    const position=stageNames.indexOf(stage);
    document.querySelectorAll('[data-progress]').forEach(dot => {
      const index=stageNames.indexOf(dot.dataset.progress);
      dot.classList.toggle('is-active',index===position);
      dot.classList.toggle('is-complete',index<position);
    });
  }
  function changeStage(next){
    if (currentStage===next || navigating) return;
    navigating=true;
    const previous=$(`${currentStage}-stage`);
    const incoming=$(`${next}-stage`);
    function show(){
      previous.hidden=true;
      previous.style.removeProperty('opacity');
      previous.style.removeProperty('transform');
      incoming.hidden=false;
      currentStage=next;
      setProgress(next);
      window.scrollTo({top:0,behavior:'instant'});
      if (gsap && !reducedMotion) {
        gsap.fromTo(incoming,{opacity:0,y:21},{opacity:1,y:0,duration:.52,ease:'power2.out',clearProps:'all',onComplete:()=>{navigating=false;}});
        if (next==='calendar') gsap.fromTo('.week-card',{opacity:0,y:22},{opacity:1,y:0,duration:.48,stagger:.10,delay:.09,ease:'power2.out',clearProps:'all'});
        if (next==='success') gsap.fromTo('.success-emblem',{scale:.45,rotation:-35,opacity:0},{scale:1,rotation:0,opacity:1,duration:.9,ease:'elastic.out(1,.5)',clearProps:'all'});
      } else { navigating=false; }
      if (next==='calendar') $('calendar-title').focus?.({preventScroll:true});
    }
    if (gsap && !reducedMotion) gsap.to(previous,{opacity:0,y:-9,duration:.18,ease:'power1.in',onComplete:show});
    else show();
  }
  function setError(message){
    const error=$('submit-error');error.textContent=message;error.hidden=false;
  }
  function setSubmitting(busy){
    const button=$('submit-button');
    button.classList.toggle('is-loading',busy);
    button.innerHTML=busy ? 'Enregistrement en cours… <span aria-hidden="true">◌</span>' : `${configured ? 'Envoyer ma réponse' : 'Tester la confirmation'} <span aria-hidden="true">↗</span>`;
    button.disabled=busy || (!selected.size && !noneNeeded);
  }
  function renderSuccess(isDemo){
    $('success-eyebrow').textContent=isDemo ? 'MODE APERÇU · AUCUN ENVOI' : 'MERCI POUR VOTRE PARTICIPATION';
    $('success-title').innerHTML=isDemo ? 'Un aperçu <span class="serif-script">de votre confirmation.</span>' : 'C’est noté, <span class="serif-script">merci beaucoup&nbsp;!</span>';
    $('success-description').textContent=isDemo
      ? 'Ceci est uniquement une démonstration. Votre réponse n’a pas été enregistrée. Activez la connexion Google Sheets avant de transmettre le sondage aux familles.'
      : 'Votre réponse a bien été enregistrée. Vos choix nous aideront à mieux planifier nos services pendant le temps des Fêtes.';
    const container=$('success-summary-days');container.replaceChildren();
    if (noneNeeded){const item=document.createElement('span');item.className='none';item.textContent='Aucun service nécessaire pendant cette période';container.append(item);}
    else {orderedDays().forEach(day => {const chip=document.createElement('span');chip.className='date-chip';chip.textContent=day.full;container.append(chip);});}
  }
  function serverOriginAllowed(origin){
    try {
      const parsed=new URL(origin);
      return parsed.protocol==='https:' && (parsed.hostname==='script.google.com' || parsed.hostname==='script.googleusercontent.com' || parsed.hostname.endsWith('.googleusercontent.com'));
    } catch {return false;}
  }
  function handleServerMessage(event){
    if (!pendingNonce || !serverOriginAllowed(event.origin)) return;
    const data=event.data;
    if (!data || data.type!=='orchidbleue-survey-result' || data.nonce!==pendingNonce) return;
    clearTimeout(submitTimer);
    pendingNonce=null;
    setSubmitting(false);
    if (data.ok !== true){setError('Votre réponse n’a pas pu être confirmée. Veuillez réessayer dans un instant.');return;}
    try {localStorage.setItem(STORAGE_KEY,JSON.stringify({id:submissionId,dates:orderedDays().map(day=>day.id),aucunBesoin:noneNeeded}));}catch{}
    renderSuccess(false);
    $('start-button').innerHTML='Modifier ma réponse <span class="button-arrow" aria-hidden="true">↗</span>';
    changeStage('success');
  }
  function submit(){
    if (pendingNonce || (!selected.size && !noneNeeded)) return;
    if (!configured){renderSuccess(true);changeStage('success');return;}
    const nonce=newId().replace(/-/g,'');
    pendingNonce=nonce;
    setSubmitting(true);
    $('submit-error').hidden=true;
    const payload={id:submissionId,nonce,dates:orderedDays().map(day=>day.id),aucunBesoin:noneNeeded};
    $('response-payload').value=JSON.stringify(payload);
    const form=$('response-form');
    form.action=configURL;
    try {form.submit();}
    catch {pendingNonce=null;setSubmitting(false);setError('Impossible d’envoyer le formulaire. Vérifiez votre connexion et réessayez.');return;}
    submitTimer=window.setTimeout(() => {
      if (pendingNonce!==nonce) return;
      pendingNonce=null;
      setSubmitting(false);
      setError('Aucune confirmation reçue. Vérifiez votre connexion ou contactez l’organisme avant de réessayer.');
    },22000);
  }
  function init(){
    createCalendar();
    if (saved) $('start-button').innerHTML='Modifier ma réponse <span class="button-arrow" aria-hidden="true">↗</span>';
    if (!configured){$('preview-banner').hidden=false;}
    updateCalendar();
    setSubmitting(false);
    $('start-button').addEventListener('click',()=>changeStage('calendar'));
    $('back-intro').addEventListener('click',()=>changeStage('intro'));
    $('edit-button').addEventListener('click',()=>changeStage('calendar'));
    $('submit-button').addEventListener('click',submit);
    $('no-need').addEventListener('change',event => {
      if (pendingNonce) return;
      noneNeeded=event.target.checked;
      if (noneNeeded) selected.clear();
      updateCalendar();
    });
    window.addEventListener('message',handleServerMessage);
    if (gsap && !reducedMotion){
      gsap.fromTo('.intro-content > *',{opacity:0,y:16},{opacity:1,y:0,duration:.72,stagger:.07,ease:'power2.out',clearProps:'all'});
      gsap.fromTo('.intro-art',{opacity:0,scale:.95},{opacity:1,scale:1,duration:1.1,delay:.2,ease:'power2.out',clearProps:'opacity,scale'});
      gsap.to('.art-flower--main',{y:-13,rotation:'-=4',duration:4,ease:'sine.inOut',repeat:-1,yoyo:true});
      gsap.to('.floating-calendar',{y:-8,rotation:-6,duration:3.5,ease:'sine.inOut',repeat:-1,yoyo:true});
      gsap.to('.art-flower--small',{y:9,rotation:'+=9',duration:4.2,ease:'sine.inOut',repeat:-1,yoyo:true});
    }
  }
  init();
})();

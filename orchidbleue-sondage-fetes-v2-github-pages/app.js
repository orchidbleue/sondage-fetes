(() => {
  'use strict';

  // Calendrier fixe : 21–26 décembre 2026 et 28 décembre 2026–2 janvier 2027.
  // Samedis et jours fériés visés désactivés.
  const DAYS = [
    {id:'2026-12-21',name:'Lun.',number:21,month:'DÉC.',full:'Lundi 21 décembre',short:'21 déc.',week:1},
    {id:'2026-12-22',name:'Mar.',number:22,month:'DÉC.',full:'Mardi 22 décembre',short:'22 déc.',week:1},
    {id:'2026-12-23',name:'Mer.',number:23,month:'DÉC.',full:'Mercredi 23 décembre',short:'23 déc.',week:1},
    {id:'2026-12-24',name:'Jeu.',number:24,month:'DÉC.',full:'Jeudi 24 décembre',short:'24 déc.',week:1,blocked:true},
    {id:'2026-12-25',name:'Ven.',number:25,month:'DÉC.',full:'Vendredi 25 décembre',short:'25 déc.',week:1,blocked:true},
    {id:'2026-12-26',name:'Sam.',number:26,month:'DÉC.',full:'Samedi 26 décembre',short:'26 déc.',week:1,blocked:true},
    {id:'2026-12-28',name:'Lun.',number:28,month:'DÉC.',full:'Lundi 28 décembre',short:'28 déc.',week:2},
    {id:'2026-12-29',name:'Mar.',number:29,month:'DÉC.',full:'Mardi 29 décembre',short:'29 déc.',week:2},
    {id:'2026-12-30',name:'Mer.',number:30,month:'DÉC.',full:'Mercredi 30 décembre',short:'30 déc.',week:2},
    {id:'2026-12-31',name:'Jeu.',number:31,month:'DÉC.',full:'Jeudi 31 décembre',short:'31 déc.',week:2,blocked:true},
    {id:'2027-01-01',name:'Ven.',number:1,month:'JANV.',full:'Vendredi 1er janvier',short:'1er janv.',week:2,blocked:true},
    {id:'2027-01-02',name:'Sam.',number:2,month:'JANV.',full:'Samedi 2 janvier',short:'2 janv.',week:2,blocked:true}
  ];
  const ALLOWED = new Set(DAYS.filter(d => !d.blocked).map(d => d.id));
  // Cette liste locale conserve uniquement une empreinte cryptographique des noms et l'ID,
  // jamais les noms eux-mêmes. Elle aide à modifier une réponse depuis le même navigateur.
  const STORAGE_KEY = 'orchidbleue-fetes-2026-nominatif-v2';
  const $ = id => document.getElementById(id);
  const stageNames = ['intro','calendar','success'];
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const animation = window.gsap;
  const configURL = String(window.ORCHID_CONFIG?.SCRIPT_URL || '').trim();
  const configured = /^https:\/\/script\.google\.com\/macros\/s\/[\w-]+\/exec\/?(?:\?.*)?$/i.test(configURL);
  let selected = new Set();
  let noneNeeded = false;
  let currentStage = 'intro';
  let navigating = false;
  let pendingNonce = null;
  let pendingData = null;
  let lastSubmission = null;
  let submitTimer = null;

  function newId() {
    if (window.crypto?.randomUUID) return window.crypto.randomUUID();
    if (window.crypto?.getRandomValues) return Array.from(crypto.getRandomValues(new Uint8Array(20)), n=>n.toString(16).padStart(2,'0')).join('');
    return 'local-'+Date.now()+'-'+Math.random().toString(36).slice(2,14);
  }
  function getNames() {
    return {
      responsable:$('responsible-name').value.trim().replace(/\s+/g,' '),
      participant:$('participant-name').value.trim().replace(/\s+/g,' ')
    };
  }
  function normalizeName(n) { return n.normalize('NFC').toLocaleLowerCase('fr-CA').replace(/\s+/g,' ').trim(); }
  async function identityHash(names) {
    // GitHub Pages et localhost exposent crypto.subtle via HTTPS/contexte sécurisé.
    if (!window.crypto?.subtle || !window.TextEncoder) return null;
    const message=JSON.stringify([normalizeName(names.responsable),normalizeName(names.participant)]);
    const hash=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(message));
    return Array.from(new Uint8Array(hash),x=>x.toString(16).padStart(2,'0')).join('');
  }
  function storedResponses() {
    try {
      const value=JSON.parse(localStorage.getItem(STORAGE_KEY)||'{}');
      return value && typeof value==='object' && !Array.isArray(value) ? value : {};
    } catch { return {}; }
  }
  function rememberSuccess(data) {
    if (!data.identityHash) return;
    try {
      const entries=storedResponses();
      entries[data.identityHash]={id:data.id,dates:data.dates,aucunBesoin:data.aucunBesoin};
      // Conserve un maximum de 30 identifiants par navigateur, sans les noms.
      const keys=Object.keys(entries);
      keys.slice(0,Math.max(0,keys.length-30)).forEach(k=>delete entries[k]);
      localStorage.setItem(STORAGE_KEY,JSON.stringify(entries));
    } catch { /* Navigation privée ou stockage indisponible. */ }
  }
  function makeDayButton(day) {
    const button=document.createElement('button');
    button.type='button';button.className='date-tile';button.dataset.date=day.id;
    if (day.blocked) {
      button.disabled=true;button.setAttribute('aria-label',day.full+', journée non offerte');
    } else {
      button.setAttribute('aria-pressed','false');button.setAttribute('aria-label',day.full);
      button.addEventListener('click',()=>toggleDate(day.id));
    }
    button.innerHTML=`<span class="day-name">${day.name}</span><span class="day-number">${day.number}</span>${day.blocked?'<span class="closed-text">Non offert</span>':`<span class="day-month">${day.month}</span><span class="selected-check" aria-hidden="true">✓</span>`}`;
    return button;
  }
  function createCalendar() {
    DAYS.forEach(day=>(day.week===1?$('week-one'):$('week-two')).append(makeDayButton(day)));
  }
  function orderedDays() { return DAYS.filter(day=>ALLOWED.has(day.id)&&selected.has(day.id)); }
  function toggleDate(id) {
    if (pendingNonce || !ALLOWED.has(id)) return;
    if (noneNeeded) noneNeeded=false;
    if (selected.has(id)) selected.delete(id); else selected.add(id);
    updateCalendar();
    if (animation && !reducedMotion) {
      const tile=document.querySelector(`.date-tile[data-date="${id}"]`);
      animation.fromTo(tile,{scale:.95},{scale:1,duration:.31,ease:'back.out(2)'});
    }
  }
  function updateCalendar() {
    document.querySelectorAll('.date-tile:not(:disabled)').forEach(tile=>{
      const active=selected.has(tile.dataset.date);
      tile.classList.toggle('is-selected',active);
      tile.setAttribute('aria-pressed',String(active));
    });
    $('selection-count').textContent=String(selected.size);
    $('selection-count-label').textContent=selected.size>1?'journées sélectionnées':'journée sélectionnée';
    const chips=$('selection-chips');chips.replaceChildren();
    if (noneNeeded || selected.size===0) {
      const p=document.createElement('p');p.className='empty-selection';
      p.textContent=noneNeeded?'Aucun service nécessaire pendant ces dates.':'Vos journées choisies apparaîtront ici. ❄';
      chips.append(p);
    } else orderedDays().forEach(day=>{const chip=document.createElement('span');chip.className='date-chip';chip.textContent=day.short;chips.append(chip);});
    $('no-need').checked=noneNeeded;
    $('submit-button').disabled=(!noneNeeded&&selected.size===0)||Boolean(pendingNonce);
    $('submit-error').hidden=true;
  }
  function setProgress(stage) {
    const position=stageNames.indexOf(stage);
    document.querySelectorAll('[data-progress]').forEach(dot=>{
      const index=stageNames.indexOf(dot.dataset.progress);
      dot.classList.toggle('is-active',index===position);
      dot.classList.toggle('is-complete',index<position);
    });
  }
  function changeStage(next) {
    if (currentStage===next || navigating) return;
    navigating=true;
    const previous=$(`${currentStage}-stage`);
    const incoming=$(`${next}-stage`);
    const show=()=>{
      previous.hidden=true;previous.style.removeProperty('opacity');previous.style.removeProperty('transform');
      incoming.hidden=false;currentStage=next;setProgress(next);window.scrollTo({top:0,behavior:'instant'});
      if (animation&&!reducedMotion) {
        animation.fromTo(incoming,{opacity:0,y:19},{opacity:1,y:0,duration:.55,ease:'power2.out',clearProps:'all',onComplete:()=>{navigating=false;}});
        if (next==='calendar') animation.fromTo('.week-card',{opacity:0,y:22},{opacity:1,y:0,duration:.5,stagger:.11,delay:.09,ease:'power2.out',clearProps:'all'});
        if (next==='success') animation.fromTo('.success-emblem',{scale:.5,rotation:-24,opacity:0},{scale:1,rotation:0,opacity:1,duration:.85,ease:'elastic.out(1,.5)',clearProps:'all'});
      } else navigating=false;
      if (next==='calendar') $('calendar-title').focus({preventScroll:true});
    };
    if (animation&&!reducedMotion) animation.to(previous,{opacity:0,y:-9,duration:.16,ease:'power1.in',onComplete:show});
    else show();
  }
  function setError(message) { const error=$('submit-error');error.textContent=message;error.hidden=false; }
  function setSubmitting(busy) {
    const button=$('submit-button');button.classList.toggle('is-loading',busy);
    button.innerHTML=busy?'Enregistrement… <span aria-hidden="true">◌</span>':`${configured?'Envoyer ma réponse':'Tester la confirmation'} <span aria-hidden="true">↗</span>`;
    button.disabled=busy||(!selected.size&&!noneNeeded);
    $('responsible-name').disabled=busy;$('participant-name').disabled=busy;$('no-need').disabled=busy;
    document.querySelectorAll('.date-tile').forEach(tile=>{tile.disabled=busy||!ALLOWED.has(tile.dataset.date);});
  }
  function validateNames() {
    const names=getNames();let firstInvalid=null;
    [['responsible-name','responsible-error',names.responsable],['participant-name','participant-error',names.participant]].forEach(([id,errorId,value])=>{
      const invalid=value.length<2||value.length>100;
      $(id).setAttribute('aria-invalid',String(invalid));$(errorId).hidden=!invalid;
      if (invalid&&!firstInvalid) firstInvalid=$(id);
    });
    if (firstInvalid) { setError('Veuillez remplir les deux noms avant d’envoyer votre réponse.');firstInvalid.focus();return null; }
    return names;
  }
  function renderSuccess(isDemo) {
    $('success-eyebrow').textContent=isDemo?'MODE APERÇU · AUCUN ENVOI':'MERCI POUR VOTRE PARTICIPATION';
    $('success-title').innerHTML=isDemo?'Voici un aperçu <span class="highlight">de la confirmation.</span>':'Votre réponse est <span class="highlight">bien reçue&nbsp;!</span>';
    $('success-description').textContent=isDemo
      ? 'Il s’agit uniquement d’une démonstration. Aucune information n’a été enregistrée. Activez Google Sheets avant de partager le sondage.'
      : 'Merci ! Vos besoins ont été enregistrés et aideront notre équipe à organiser les services du temps des Fêtes.';
    const names=getNames();const person=$('success-summary-person');person.replaceChildren();
    for (const [label,value] of [['Personne responsable : ',names.responsable],['Participant·e : ',names.participant]]) {
      const line=document.createElement('div');const strong=document.createElement('strong');strong.textContent=value;line.append(document.createTextNode(label),strong);person.append(line);
    }
    const container=$('success-summary-days');container.replaceChildren();
    if (noneNeeded) {const none=document.createElement('span');none.className='none';none.textContent='Aucun service nécessaire pendant cette période';container.append(none);}
    else orderedDays().forEach(day=>{const chip=document.createElement('span');chip.className='date-chip';chip.textContent=day.full;container.append(chip);});
  }
  function serverOriginAllowed(origin) {
    try { const parsed=new URL(origin);return parsed.protocol==='https:'&&(parsed.hostname==='script.google.com'||parsed.hostname==='script.googleusercontent.com'||parsed.hostname.endsWith('.googleusercontent.com')); }
    catch { return false; }
  }
  function handleServerMessage(event) {
    if (!pendingNonce||!pendingData||!serverOriginAllowed(event.origin)) return;
    if (!event.data||event.data.type!=='orchidbleue-survey-result'||event.data.nonce!==pendingNonce) return;
    window.clearTimeout(submitTimer);pendingNonce=null;setSubmitting(false);
    if (event.data.ok!==true) { pendingData=null;setError('Votre réponse n’a pas pu être confirmée. Veuillez réessayer ou contacter l’organisme.');return; }
    rememberSuccess(pendingData);lastSubmission=pendingData;pendingData=null;renderSuccess(false);
    changeStage('success');
  }
  async function submit() {
    if (pendingNonce||(!selected.size&&!noneNeeded)) return;
    $('submit-error').hidden=true;
    const names=validateNames();if (!names) return;
    if (!configured) {renderSuccess(true);changeStage('success');return;}
    const nonce=newId().replace(/-/g,'');pendingNonce=nonce;setSubmitting(true);
    let hash=null;
    try { hash=await identityHash(names); } catch { /* Nouvel ID si empreinte indisponible. */ }
    if (pendingNonce!==nonce) return;
    const entries=storedResponses();
    const namesKey=JSON.stringify([normalizeName(names.responsable),normalizeName(names.participant)]);
    const existing=lastSubmission?.namesKey===namesKey ? lastSubmission : (hash&&entries[hash]);
    const id=existing&&/^[a-zA-Z0-9_-]{16,80}$/.test(existing.id)?existing.id:newId();
    const payload={id,nonce,responsable:names.responsable,participant:names.participant,dates:orderedDays().map(d=>d.id),aucunBesoin:noneNeeded};
    pendingData={identityHash:hash,namesKey,id,dates:payload.dates,aucunBesoin:noneNeeded};
    $('response-payload').value=JSON.stringify(payload);
    const form=$('response-form');form.action=configURL;
    try { form.submit(); }
    catch { pendingNonce=null;pendingData=null;setSubmitting(false);setError('Impossible d’envoyer le formulaire. Vérifiez votre connexion puis réessayez.');return; }
    submitTimer=window.setTimeout(()=>{
      if (pendingNonce!==nonce) return;
      pendingNonce=null;pendingData=null;setSubmitting(false);
      setError('Aucune confirmation reçue. Vérifiez la feuille Google Sheets avant de réessayer pour éviter un doublon.');
    },22000);
  }
  function resetForNewParticipant() {
    selected.clear();noneNeeded=false;
    $('responsible-name').value='';$('participant-name').value='';
    for(const id of ['responsible-name','participant-name']) $(id).removeAttribute('aria-invalid');
    $('responsible-error').hidden=true;$('participant-error').hidden=true;
    updateCalendar();changeStage('calendar');
  }
  function init() {
    DAYS.forEach(day=>{
      if (day.blocked&&ALLOWED.has(day.id)) throw new Error('Journée bloquée autorisée');
    });
    createCalendar();updateCalendar();setSubmitting(false);
    if (!configured) $('preview-banner').hidden=false;
    $('start-button').addEventListener('click',()=>changeStage('calendar'));
    $('back-intro').addEventListener('click',()=>changeStage('intro'));
    $('edit-button').addEventListener('click',()=>changeStage('calendar'));
    $('new-button').addEventListener('click',resetForNewParticipant);
    $('submit-button').addEventListener('click',submit);
    $('no-need').addEventListener('change',event=>{if(pendingNonce)return;noneNeeded=event.target.checked;if(noneNeeded)selected.clear();updateCalendar();});
    for(const [id,errorId] of [['responsible-name','responsible-error'],['participant-name','participant-error']]) {
      $(id).addEventListener('input',()=>{$(id).removeAttribute('aria-invalid');$(errorId).hidden=true;$('submit-error').hidden=true;});
    }
    window.addEventListener('message',handleServerMessage);
    if (animation&&!reducedMotion) {
      animation.fromTo('.intro-content > *',{opacity:0,y:17},{opacity:1,y:0,duration:.72,stagger:.08,ease:'power2.out',clearProps:'all'});
      animation.fromTo('.winter-art',{opacity:0,scale:.95},{opacity:1,scale:1,duration:1.15,delay:.17,ease:'power2.out',clearProps:'opacity,scale'});
      animation.to('.float-calendar',{y:-9,rotation:-5,duration:3.7,ease:'sine.inOut',repeat:-1,yoyo:true});
      animation.to('.float-pill--one',{y:-9,rotation:2,duration:4.5,ease:'sine.inOut',repeat:-1,yoyo:true});
      animation.to('.float-pill--two',{y:8,rotation:8,duration:4,ease:'sine.inOut',repeat:-1,yoyo:true});
    }
  }
  init();
})();

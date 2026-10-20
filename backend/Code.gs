/**
 * Sondage des Fêtes 2026–2027 — Centre d’activités l’Orchidbleue
 *
 * À INSTALLER DANS UNE FEUILLE GOOGLE SHEETS :
 * Extensions > Apps Script > coller ce fichier.
 * Exécuter une fois initialiserSondage(), puis déployer comme application Web.
 *
 * L’application n’enregistre aucun nom, courriel ou adresse IP.
 * Un identifiant aléatoire par navigateur permet de MODIFIER sa réponse,
 * au lieu de la compter deux fois depuis ce même navigateur.
 */

const NOM_FEUILLE_REPONSES = 'Réponses';
const NOM_FEUILLE_BILAN = 'Bilan';
const JOURS_OUVERTS = Object.freeze([
  ['2026-12-21', 'Lun. 21 décembre'],
  ['2026-12-22', 'Mar. 22 décembre'],
  ['2026-12-23', 'Mer. 23 décembre'],
  ['2026-12-26', 'Sam. 26 décembre'],
  ['2026-12-28', 'Lun. 28 décembre'],
  ['2026-12-29', 'Mar. 29 décembre'],
  ['2026-12-30', 'Mer. 30 décembre'],
  ['2027-01-02', 'Sam. 2 janvier']
]);

function initialiserSondage() {
  const classeur = obtenirClasseur_();
  const reponses = preparerFeuilleReponses_(classeur);
  let bilan = classeur.getSheetByName(NOM_FEUILLE_BILAN);
  if (!bilan) bilan = classeur.insertSheet(NOM_FEUILLE_BILAN);

  bilan.clear();
  bilan.getRange('A1').setValue('L’ORCHIDBLEUE · BILAN DES BESOINS');
  bilan.getRange('A1:C1').merge();
  bilan.getRange('A1:C1').setBackground('#5269db').setFontColor('#ffffff').setFontWeight('bold').setFontSize(14);
  bilan.setRowHeight(1,44);
  bilan.getRange('A2').setValue('Réponses reçues');
  bilan.getRange('B2').setFormula("=MAX(COUNTA('Réponses'!A2:A),0)");
  bilan.getRange('A3').setValue('Réponses « aucun besoin »');
  bilan.getRange('B3').setFormula("=COUNTIF('Réponses'!C2:C,TRUE)");
  bilan.getRange('A5:C5').setValues([['DATE', 'BESOINS EXPRIMÉS', 'STATUT']]);
  bilan.getRange('A5:C5').setBackground('#e8ecff').setFontWeight('bold').setFontColor('#344897');
  JOURS_OUVERTS.forEach(function(jour, index){
    const ligne = 6 + index;
    const colonne = lettreColonne_(5 + index);
    bilan.getRange(ligne,1).setValue(jour[1]);
    bilan.getRange(ligne,2).setFormula("=COUNTIF('Réponses'!"+colonne+"2:"+colonne+",1)");
    bilan.getRange(ligne,3).setValue('Sélectionnable');
    if (index % 2 === 1) bilan.getRange(ligne,1,1,3).setBackground('#f6f7ff');
  });
  bilan.getRange('A15').setValue('Chaque sélection contribue au total du jour. Une personne peut choisir plusieurs journées.');
  bilan.getRange('A16').setValue('Les 24, 25 et 31 décembre et le 1er janvier ne sont jamais offerts.');
  bilan.getRange('A17').setValue('Les réponses du même navigateur sont mises à jour (pas dupliquées).');
  bilan.getRange('A15:A17').setFontColor('#8290ad').setFontSize(10);
  bilan.setColumnWidth(1,255);
  bilan.setColumnWidth(2,170);
  bilan.setColumnWidth(3,180);
  bilan.setFrozenRows(5);
  bilan.getRange('B2:B13').setHorizontalAlignment('center');
  bilan.getRange('B2:B3').setFontSize(19).setFontWeight('bold').setFontColor('#5269db');

  // Graphique mis à jour automatiquement lorsque les réponses changent.
  bilan.getCharts().forEach(function(graphique){ bilan.removeChart(graphique); });
  const graphique = bilan.newChart()
    .asBarChart()
    .addRange(bilan.getRange('A5:B13'))
    .setNumHeaders(1)
    .setOption('title','Besoins par journée')
    .setOption('legend',{position:'none'})
    .setOption('colors',['#6177da'])
    .setOption('hAxis',{minValue:0,title:'Nombre de réponses'})
    .setPosition(5,5,0,0)
    .build();
  bilan.insertChart(graphique);
  classeur.setActiveSheet(bilan);
  SpreadsheetApp.flush();
  return 'Le sondage est prêt : feuilles « Réponses » et « Bilan » créées.';
}

function doGet() {
  return ContentService.createTextOutput('Sondage Orchidbleue : service actif.');
}

function doPost(e) {
  let nonce = '';
  try {
    const brut = e && e.parameter ? e.parameter.payload : '';
    if (typeof brut !== 'string' || brut.length > 3000) throw new Error('Données invalides');
    const payload = JSON.parse(brut);
    nonce = typeof payload.nonce === 'string' ? payload.nonce : '';
    if (!/^[A-Za-z0-9_-]{16,100}$/.test(nonce)) throw new Error('Requête invalide');
    if (typeof payload.id !== 'string' || !/^[A-Za-z0-9_-]{16,80}$/.test(payload.id)) throw new Error('Identifiant invalide');
    if (!Array.isArray(payload.dates) || payload.dates.length > JOURS_OUVERTS.length) throw new Error('Dates invalides');
    if (typeof payload.aucunBesoin !== 'boolean') throw new Error('Choix invalide');
    if (payload.aucunBesoin !== (payload.dates.length === 0)) throw new Error('Choix incohérent');
    const idsPossibles = JOURS_OUVERTS.map(function(j){return j[0];});
    if (new Set(payload.dates).size !== payload.dates.length ||
        payload.dates.some(function(date){return typeof date !== 'string' || idsPossibles.indexOf(date) === -1;})) {
      throw new Error('Date non autorisée');
    }

    const verrou = LockService.getScriptLock();
    verrou.waitLock(15000);
    try {
      const sheet = preparerFeuilleReponses_(obtenirClasseur_());
      const dates = new Set(payload.dates);
      const nouvelleLigne = [
        payload.id,
        new Date(),
        payload.aucunBesoin,
        payload.dates.join(', ')
      ].concat(JOURS_OUVERTS.map(function(j){return dates.has(j[0]) ? 1 : 0;}));
      const lastRow = sheet.getLastRow();
      let rowIndex = -1;
      if (lastRow > 1) {
        const existingIDs = sheet.getRange(2,1,lastRow - 1,1).getValues();
        for (let i=0; i<existingIDs.length; i++) {
          if (existingIDs[i][0] === payload.id) {rowIndex = i + 2;break;}
        }
      }
      if (rowIndex === -1) sheet.appendRow(nouvelleLigne);
      else sheet.getRange(rowIndex,1,1,nouvelleLigne.length).setValues([nouvelleLigne]);
      SpreadsheetApp.flush();
    } finally { verrou.releaseLock(); }

    return reponseIframe_(nonce,true);
  } catch (erreur) {
    console.error(erreur);
    return reponseIframe_(nonce,false);
  }
}

function obtenirClasseur_() {
  const classeur=SpreadsheetApp.getActiveSpreadsheet();
  if (!classeur) throw new Error('Ce script doit être créé depuis un classeur Google Sheets.');
  return classeur;
}
function preparerFeuilleReponses_(classeur) {
  let feuille=classeur.getSheetByName(NOM_FEUILLE_REPONSES);
  if (!feuille) feuille=classeur.insertSheet(NOM_FEUILLE_REPONSES);
  const entetes=['Identifiant de réponse','Date de réponse','Aucun besoin','Journées sélectionnées']
    .concat(JOURS_OUVERTS.map(function(j){return j[1];}));
  if (feuille.getLastRow() === 0){
    feuille.getRange(1,1,1,entetes.length).setValues([entetes]);
    feuille.getRange(1,1,1,entetes.length).setBackground('#5269db').setFontColor('#ffffff').setFontWeight('bold');
    feuille.setFrozenRows(1);
    feuille.setColumnWidth(1,290);feuille.setColumnWidth(2,175);
    feuille.setColumnWidth(3,120);feuille.setColumnWidth(4,400);
    feuille.getRange('B:B').setNumberFormat('dd mmm yyyy HH:mm:ss');
  }
  return feuille;
}
function lettreColonne_(n) {
  let nom='';
  while(n > 0){n--;nom=String.fromCharCode(65 + n%26)+nom;n=Math.floor(n/26);}
  return nom;
}
function reponseIframe_(nonce,ok){
  const message = JSON.stringify({type:'orchidbleue-survey-result',nonce:nonce,ok:ok}).replace(/</g,'\\u003c');
  const html='<!doctype html><html><head><meta charset="utf-8"></head><body>'+
    '<script>window.top.postMessage('+message+',"*");<\/script></body></html>';
  return HtmlService.createHtmlOutput(html)
    .setTitle('Confirmation du sondage')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

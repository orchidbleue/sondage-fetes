# Sondage des Fêtes · L’Orchidbleue

Site statique 100 % en français, destiné aux parents et aux personnes responsables des participant·e·s du Centre d’activités l’Orchidbleue. Animations GSAP (avec alternative pour les préférences de mouvement réduit). Fonctionne sur **GitHub Pages**, sans installation npm ni compilation.

## Ce que contient le projet

- `index.html` — pages d’introduction, calendrier interactif et confirmation ;
- `styles.css` — style, couleurs, responsive et animations CSS ;
- `app.js` — calendrier, validation et communication avec Google Sheets ;
- `config.js` — **seul fichier à modifier pour brancher la collecte** ;
- `backend/Code.gs` — code du serveur Google Apps Script ;
- `assets/favicon.svg` — icône du navigateur.

**Période : 21–26 décembre 2026 et 28 décembre 2026–2 janvier 2027.** Les 24, 25 et 31 décembre ainsi que le 1er janvier sont non sélectionnables. Les 8 autres journées sont sélectionnables, y compris les deux samedis. La réponse « aucun besoin » est possible.

## 1. Connecter la collecte des réponses à Google Sheets (OBLIGATOIRE avant partage)

GitHub Pages héberge l’interface, mais **ne peut pas enregistrer les réponses**. Le petit serveur Apps Script fourni les écrit dans un Google Sheets **privé**.

1. Ouvrez [Google Sheets](https://sheets.google.com/) avec le compte qui devra consulter les résultats. Créez un nouveau document nommé « Sondage Orchidbleue — Fêtes 2026-2027 ».
2. Dans ce document, cliquez **Extensions → Apps Script**.
3. Effacez le code existant et collez tout le contenu de `backend/Code.gs` dans le fichier `Code.gs`. Enregistrez.
4. En haut, sélectionnez la fonction **`initialiserSondage`**, puis cliquez sur **Exécuter**. Autorisez les permissions Google demandées. Revenez à votre Google Sheets : deux onglets ont été créés, **`Réponses`** et **`Bilan`**.
5. Dans Apps Script, cliquez **Déployer → Nouveau déploiement**. Choisissez le type **Application Web** (icône d’engrenage). Réglez **Exécuter en tant que : Moi** et **Qui a accès : Tout le monde** (*Anyone*). Cliquez **Déployer** et copiez l’URL se terminant par `/exec`. N’utilisez **pas** l’URL `/dev`.
6. Dans `config.js`, remplacez la chaîne vide par cette URL :

   ```js
   window.ORCHID_CONFIG = {
     SCRIPT_URL: "https://script.google.com/macros/s/VOTRE_IDENTIFIANT/exec"
   };
   ```

7. Ouvrez le site sur votre domaine GitHub Pages et faites une réponse de test. Après la confirmation, ouvrez la feuille `Réponses` pour vérifier qu’une nouvelle ligne est apparue. Regardez ensuite l’onglet `Bilan` : le total est calculé automatiquement.
8. Pour vérifier la **modification** : sur le même navigateur, rouvrez le sondage, modifiez les jours, renvoyez. La ligne existante et les compteurs doivent être mis à jour, pas dupliqués.

**Important :** Si vous modifiez `backend/Code.gs` plus tard, dans Apps Script choisissez **Déployer → Gérer les déploiements → Modifier → Nouvelle version**, sinon le site continue d’appeler l’ancienne version.

### Résultats dans Google Sheets

- **Réponses** : une ligne par identifiant anonyme, date de dépôt, réponse « aucun besoin », liste des jours et une colonne 1/0 pour chaque jour offert.
- **Bilan** : nombre total de réponses, nombre de « aucun besoin », nombre de sélections par journée et graphique en barres.
- Votre feuille reste **privée**, sauf si vous décidez de la partager. Le lien public du sondage **n’expose pas le contenu du Google Sheets**.

### Protection des informations / limites

Aucun nom, courriel, numéro de téléphone ou adresse IP n’est demandé ou volontairement enregistré par ce code. Le navigateur conserve localement un identifiant aléatoire de réponse, qui permet de modifier celle-ci sans la compter de nouveau **depuis le même navigateur**. Cela ne garantit **pas** l’unicité des familles : différents appareils, navigateurs ou suppressions de données locales peuvent générer des réponses distinctes. La date de dépôt est enregistrée dans Google Sheets. Pour une enquête officiellement nominative, il faudrait ajouter des critères de validation et une information de confidentialité adaptée.

Le lien de réponse étant public, aucune authentification n’empêche les réponses indésirables ; en cas de forte exposition, ajouter anti-spam, authentification ou limites de fréquence. Les nombres représentent les **réponses reçues**, pas nécessairement des familles uniques.

Le navigateur communique au serveur par un formulaire envoyé vers un iframe invisible ; le serveur confirme explicitement l’enregistrement en envoyant un message à la page. Si aucune confirmation ne revient après environ 22 secondes, le site **n’annonce pas que la réponse a été enregistrée**. Vérifiez la feuille avant de ressoumettre en cas de doute.

## 2. Publier sur GitHub Pages

1. Sur GitHub, créez un dépôt public, par exemple `sondage-orchidbleue`.
2. Déposez les fichiers `index.html`, `styles.css`, `app.js`, `config.js` et le dossier `assets` **à la racine** du dépôt. Le dossier `backend` peut être conservé à part ou inclus pour archivage (il ne contient aucun secret).
3. Allez dans **Settings → Pages → Build and deployment**, choisissez **Deploy from a branch**, branche **main**, dossier **/(root)**, puis enregistrez.
4. Patientez jusqu’à l’apparition de l’URL `https://NOM-UTILISATEUR.github.io/sondage-orchidbleue/`. Ouvrez-la pour vérifier le fonctionnement sur ordinateur **et** téléphone.
5. **Avant diffusion :** confirmez que la bannière « Mode aperçu » a disparu, envoyez une réponse réelle de test, vérifiez les colonnes du Google Sheets, puis effacez la ligne de test dans `Réponses` (ne supprimez pas les en-têtes de la ligne 1).

> Attention : une fois que le site est en ligne, tous les éléments de son code sont visibles. Ne placez **jamais** de clé API privée, mot de passe ou information personnelle dans `config.js`. L’URL `/exec` n’est pas un secret, mais elle doit pointer vers votre propre Apps Script.

## 3. Modifier les textes et l’apparence

- **Texte d’introduction (Lorem ipsum)** : dans `index.html`, chercher `id="intro-placeholder"` et remplacer le paragraphe.
- **Titre et message principal** : dans `index.html`, modifier `intro-title`, `intro-lead` et `calendar-title`.
- **Couleurs** : en haut de `styles.css`, changer les variables de `:root`, notamment `--blue`, `--ink`, `--bg`.
- **Dates** : pour modifier la période, éditer **à la fois** `DAYS` dans `app.js` et `JOURS_OUVERTS` dans `backend/Code.gs`, puis redéployer le serveur Apps Script. La période livrée est figée pour les Fêtes 2026–2027.

## 4. Test en local

Ouvrez `index.html` dans votre navigateur. Sans URL dans `config.js`, une bannière **Mode aperçu** est visible et la page de confirmation indique explicitement que **rien n’a été enregistré**.

Pour éviter des restrictions propres aux URL `file://`, vous pouvez lancer dans le dossier du site :

```bash
python -m http.server 8000
```

Puis visiter `http://localhost:8000`.

## Notes visuelles

L’univers graphique (bleu doux, lavande, fleurs stylisées, cartes lumineuses) a été composé comme une **interprétation originale** du nom et de la mission de l’Orchidbleue. Le pictogramme floral du projet n’est **pas** le logo officiel de l’organisme. Remplacez-le par le logo officiel si vous disposez des fichiers et de la charte de marque. L’interface utilise les polices Google Fonts DM Sans et Fraunces avec polices de repli ; les animations GSAP sont chargées depuis un CDN avec fonctionnement dégradé si le CDN n’est pas disponible.

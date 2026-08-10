# Workix

**Langues :** [English](README.md) · [Русский](README.ru.md) · [Español](README.es.md) · [Deutsch](README.de.md) · [Français](README.fr.md) · [Türkçe](README.tr.md) · [Українська](README.uk.md) · [हिन्दी](README.hi.md) · [中文](README.zh.md)

Workix est un espace où les personnes, les projets et les opportunités professionnelles se rencontrent.

Le [hub Workix](https://workix.co) réunit trois éléments dans un même catalogue :

- **Projets** — startups, produits et communautés à la recherche de personnes.
- **Postes et missions** — opportunités ouvertes avec une description, un budget, des tags et un moyen de postuler.
- **Prestataires** — spécialistes disponibles pour de nouveaux projets.

Workix n’est pas une plateforme freelance traditionnelle. Son objectif n’est pas de se substituer à la relation entre un projet et un spécialiste. Chaque annonce redirige vers le moyen de contact ou le formulaire de candidature privilégié par son auteur, tandis que Workix facilite la publication, la découverte et le partage de l’opportunité.

Le catalogue peut être consulté sur le Web. Les agents IA peuvent y effectuer des recherches et gérer les annonces par l’intermédiaire de MCP ou de l’API REST. Le même MCP local peut également collecter des opportunités provenant de plateformes externes, tout en conservant les identifiants de ces plateformes sur la machine de l’utilisateur.

**Ouvrir Workix :** [workix.co](https://workix.co)  
**Guide pour les agents :** [workix.co/agent](https://workix.co/agent)  
**Référence de l’API :** [workix.co/api.txt](https://workix.co/api.txt)

## Demandez à votre agent d’explorer Workix

Collez ce prompt dans Cursor, Claude ou un autre agent de programmation. Il lui demande d’étudier Workix, puis de vous aider à atteindre votre objectif précis.

```text
Apprends comment fonctionne Workix :

1. Ouvre https://workix.co/agent, https://workix.co/llms.txt
   et https://workix.co/api.txt.
2. Ouvre https://github.com/facetoplace/Workix et lis README.fr.md.
3. Explique en termes simples :
   - ce qu’est Workix et à qui il s’adresse ;
   - comment je peux parcourir les projets, les postes, les missions et les prestataires ;
   - ce qu’un agent IA peut faire par l’intermédiaire du MCP et de l’API Workix ;
   - quels éléments s’exécutent localement et comment les identifiants sont protégés.
4. Examine mon projet actuel et aide-moi à choisir puis à réaliser une prochaine étape utile :
   - connecter le MCP Workix à mon agent ;
   - rechercher des opportunités ou des prestataires pertinents ;
   - publier ou mettre à jour un projet, un poste ou un profil de prestataire ;
   - déployer la vitrine Workix sur mon propre domaine ;
   - contribuer à l’amélioration de Workix.

Utilise WORKIX_API=https://workix.co pour le hub central.
Ne téléverse pas de mots de passe ni de jetons de plateformes freelance vers le hub.
Adapte les instructions à mon système d’exploitation, à mes outils et à mon projet.
```

## Que contient ce dépôt ?

Ce dépôt contient les clients et les intégrations ouverts de Workix. Ils utilisent l’API du hub central à l’adresse `https://workix.co`, ce qui permet à une copie locale d’afficher le catalogue partagé sans avoir à gérer un catalogue distinct.

- [`views/`](views/) contient les pages de la vitrine.
- [`assets/`](assets/) contient l’application Web, les styles, les traductions, les fichiers PWA et les documents publics de l’API.
- [`mcp/`](mcp/) contient le serveur MCP TypeScript, les outils Workix et les adaptateurs pour les plateformes d’emploi prises en charge.
- [`docker/`](docker/) contient une petite image nginx destinée à servir la vitrine.
- [`docs/`](docs/) contient les guides publics pour les agents et l’auto-hébergement.

Les deux composants principaux sont indépendants :

1. **Vitrine** — une interface Web permettant de parcourir le catalogue Workix. Vous pouvez l’utiliser sur [workix.co](https://workix.co) ou héberger l’interface sur votre propre domaine.
2. **Serveur MCP** — des outils qui permettent à un agent IA d’effectuer des recherches dans Workix, de gérer vos annonces et votre profil, de préparer des propositions et d’utiliser les sources externes prises en charge.

Les données du catalogue sont fournies par l’API centrale de Workix. Aucun secret de production n’est nécessaire pour exécuter la vitrine ou connecter le client MCP.

## Utiliser Workix avec un agent IA

Avec `WORKIX_API=https://workix.co`, un agent peut rechercher des projets, des postes, des missions et des prestataires. Avec une `WORKIX_AGENT_KEY`, il peut également créer ou mettre à jour des annonces et gérer un profil de prestataire.

Pour exécuter le serveur MCP localement :

Nécessite **Node 22.5 ou plus récent** : le stockage local repose sur SQLite via le module `node:sqlite` intégré à Node, si bien que rien n’a besoin d’être compilé à l’installation.

```bash
git clone https://github.com/facetoplace/Workix.git
cd Workix/mcp
npm install
npm run build
```

Exemple de configuration MCP pour Cursor :

```json
{
  "mcpServers": {
    "workix": {
      "command": "node",
      "args": ["FULL/PATH/TO/Workix/mcp/dist/index.js"],
      "env": {
        "WORKIX_API": "https://workix.co",
        "WORKIX_AGENT_KEY": "wix_…"
      }
    }
  }
}
```

Inscrivez-vous sur [workix.co](https://workix.co) pour obtenir une clé d’agent. Cette clé est facultative pour les recherches publiques et obligatoire pour les actions liées à votre compte.

Les identifiants des plateformes externes doivent rester exclusivement dans l’environnement MCP local. N’envoyez pas de mots de passe ni de jetons Upwork, Kwork ou d’autres plateformes au hub Workix.

Consultez [`mcp/README.md`](mcp/README.md) pour connaître la procédure d’installation, les outils disponibles et les paramètres propres à chaque source.

## Héberger la vitrine sur votre domaine

Les projets et les communautés peuvent proposer l’interface Workix depuis un domaine tel que `work.example.com`. Ce miroir continue de lire le catalogue partagé depuis `https://workix.co`.

1. Déployez `views/` et `assets/`, ou utilisez l’image disponible dans [`docker/`](docker/).
2. Reliez l’interface au hub :

   ```html
   <meta name="workix-api" content="https://workix.co" />
   ```

   Vous pouvez également définir `API_BASE` ou `WORKIX_API` sur `https://workix.co`.
3. Configurez votre DNS et votre hébergement pour le domaine choisi.

Les annonces associées à ce domaine peuvent être mises en avant auprès des visiteurs du miroir. Consultez [work.facetoplace.app](https://work.facetoplace.app/) pour voir un exemple en ligne et [`docs/self-host.md`](docs/self-host.md) pour obtenir plus de détails.

## Utiliser d’autres plateformes avec Workix MCP

Workix MCP offre également une interface unique pour utiliser des plateformes freelance et des sites d’emploi externes. Un agent peut rechercher plusieurs sources dans une même synthèse, ouvrir une annonce précise, rédiger une proposition et soit l’envoyer par l’intermédiaire d’une API disponible, soit préparer à votre intention une liste d’étapes à effectuer dans le navigateur.

Ces intégrations s’exécutent localement. Les jetons d’API, les identifiants des plateformes et les sessions du navigateur restent sur votre machine et ne sont pas envoyés au hub Workix. L’envoi d’une proposition nécessite toujours une confirmation humaine explicite.

### Niveau de maturité des plateformes

Le score indique dans quelle mesure le **flux de travail prévu par Workix** est opérationnel aujourd’hui, et non la part de la plateforme elle-même qui est couverte :

- **5/5** — la recherche et l’envoi de candidatures fonctionnent par l’intermédiaire d’une API prise en charge.
- **4/5** — recherche fiable ; l’envoi de candidatures ou l’authentification présente encore une solution de repli ou une limitation.
- **3/5** — intégration utile, mais les identifiants, les proxys ou une interface non officielle nuisent à la fiabilité.
- **2/5** — source surveillée avec l’aide du navigateur plutôt que flux automatisé.
- **1/5** — lien ou liste d’étapes uniquement ; l’automatisation avancée est volontairement exclue.

La colonne **Politique d’automatisation** adopte volontairement une approche prudente. Les conditions d’utilisation des plateformes et les autorisations de leurs API peuvent évoluer ; les utilisateurs doivent donc également respecter les règles en vigueur de chaque source ainsi que celles applicables à leur propre compte.

| Plateforme | Recherche / lecture | Candidature | Maturité | Politique d’automatisation | Orientation |
|------------|---------------------|-------------|:--------:|----------------------------|-------------|
| **Freelancehunt** | API officielle | API | **5/5** | API approuvée et jeton | Maintenir le flux de travail complet |
| **Freelancer.com** | API officielle | Offre via l’API | **4/5** | API approuvée et OAuth | Stabiliser l’authentification et la gestion des erreurs |
| **Upwork** | OAuth GraphQL | API lorsque cela est autorisé ; navigateur en solution de repli | **4/5** | Uniquement les autorisations d’API approuvées ; aucune collecte non autorisée | Finaliser la configuration OAuth et la solution de repli pour les propositions |
| **FL.ru** | RSS | Navigateur | **4/5** | RSS public ; la candidature reste sous contrôle humain | Améliorer l’analyse des catégories et des budgets |
| **HH.ru** | API officielle | Navigateur | **4/5** | Règles de l’API officielle et agent utilisateur obligatoire | Améliorer les filtres de projets et de télétravail ; la candidature par API est facultative |
| **Remote OK** | API publique | Site de l’employeur | **4/5** | Flux public ; les règles de l’employeur s’appliquent après la redirection | Améliorer les filtres par tags et technologies |
| **Remotive · Arbeitnow · Himalayas · Jobicy · Working Nomads · The Muse · 4 Day Week · AI Dev Jobs** | API publique | Site de l’employeur | **4/5** | Flux publics ; les règles de l’employeur s’appliquent après la redirection | Conserver comme sources de la synthèse `include_jobs` |
| **We Work Remotely · Aquent · Jobspresso** | RSS public | Site de l’employeur | **4/5** | Flux publics ; les règles de l’employeur s’appliquent après la redirection | Conserver comme sources de la synthèse `include_jobs` |
| **Portails carrières des employeurs** (Greenhouse · Ashby · Lever · SmartRecruiters · Workable) | API publique par entreprise | Portail propre de l’employeur | **4/5** | Points d’accès publics des pages carrières ; le lien de candidature est celui de l’employeur | Élargir la liste d’entreprises dans `ats-companies.json` |
| **Troudvsem (Travail en Russie)** | API publique de données ouvertes | Externe | **4/5** | Données ouvertes de l’État ; aucun accès au compte | Ajouter des préréglages par région ; la publication exige une signature électronique nationale et reste hors périmètre |
| **NoFluffJobs · Landing.jobs · Get on Board** | API publique | Site de l’employeur | **4/5** | Flux publics ; les règles de l’employeur s’appliquent après la redirection | Conserver comme sources de la synthèse `include_jobs` |
| **Djinni** | RSS public | Compte sur la plateforme | **3/5** | Flux public ; la candidature reste sous contrôle humain | Conserver comme source `include_jobs` |
| **Adzuna** | API officielle avec vos propres clés | Site de l’employeur | **4/5** | Clés d’API enregistrées ; l’offre gratuite est limitée en fréquence | Conserver dans `include_jobs` ; afficher clairement les erreurs de quota |
| **JobsPipe** (LinkedIn · Indeed · Y Combinator · Greenhouse · Lever · Ashby · SmartRecruiters · Workday · Workable · Paylocity) | API officielle avec votre propre clé | Site de l’employeur | **4/5** | À la consommation : un crédit par offre renvoyée ; votre clé, votre quota | Volontairement hors de la synthèse automatique — voir plus bas |
| **USAJOBS · Careerjet · Jooble** | API officielle avec votre propre clé | Externe | **4/5** | Clés gratuites ; chacune a ses propres règles | Conserver dans `include_jobs` une fois la clé renseignée |
| **SuperJob** | API officielle avec votre propre clé | Navigateur | **3/5** | Règles de l’API officielle | Répond 403 depuis les adresses de centres de données ; nécessite une clé et souvent un proxy |
| **Reddit** (r/forhire et similaires) | Flux Atom public | Commentaire ou message privé manuel | **2/5** | **Aucune publication ni message privé automatisé** | Flux uniquement ; l’API JSON exige une application OAuth enregistrée |
| **Dream Offer** | Flux HTTP public | Site de l’employeur | **3/5** | Flux public ; aucun accès au compte | Surveiller les changements de flux |
| **Claw Earn · SeekClaw · Openwork** | API pour agents | API pour agents | **4/5** | Plateformes pour agents ; l’envoi passe par leur propre API | Conserver dans `include_agent_gigs` ; les offres ouvertes sont souvent absentes |
| **Superteam Earn** | API pour agents avec votre propre clé | API pour agents | **4/5** | Nécessite `SUPERTEAM_EARN_API_KEY` | Conserver dans `include_agent_gigs` |
| **Growth.Talent · RentAHuman** | API publique | API pour agents ou navigateur | **4/5** | Annonces publiques ; candidater demande une clé | Conserver dans `include_agent_gigs` |
| **Kwork** | API non officielle avec identifiants locaux | Navigateur | **3/5** | Accès non officiel à haut risque ; aucune candidature automatique | Améliorer la fiabilité de la connexion et des proxys |
| **Freelance.ru** | RSS ; un proxy peut être nécessaire | Navigateur | **3/5** | RSS public ; aucun contournement des restrictions de compte | Rendre les flux plus résistants aux blocages |
| **Weblancer** | RSS ; un proxy peut être nécessaire | Navigateur | **3/5** | RSS public ; aucun contournement des restrictions de compte | Rendre les flux plus résistants aux blocages |
| **Indeed** | Passerelle JobSpy (facultative, nécessite Python) | Site de l’employeur | **3/5** | Fonctionne via votre propre installation de `python-jobspy`, selon ses conditions et les vôtres | Conserver comme passerelle optionnelle ; aucun scraper maison |
| **Glassdoor · ZipRecruiter · Naukri** | Passerelle JobSpy (facultative, nécessite Python) | Site de l’employeur | **1/5** | Même passerelle ; depuis la plupart des adresses, elles répondent 403 ou expirent | Branchées mais peu fiables — cela dépend de votre réseau |
| **BDjobs** | Passerelle JobSpy — **cassée en amont** | Site de l’employeur | **1/5** | Bloquée par un bogue dans `python-jobspy` lui-même, pas par la plateforme | En attente d’un correctif en amont ; mentionnée pour ne pas être prise pour une erreur de configuration |
| **Habr Career** | JSON public du frontend, RSS en repli | Navigateur | **4/5** | Points d’accès publics uniquement ; aucune candidature de masse | Fournit salaire, niveau et compétences ; le RSS reste le repli |
| **Fiverr · SproutGigs** | Surveillance dans le navigateur | Navigateur | **2/5** | Briefs entrants et offres manuelles ; aucun scraper | Conserver l’assistance par navigateur |
| **Avito Services · YouDo** | Surveillance dans le navigateur | Navigateur | **2/5** | Capture manuelle ; aucun contournement des règles de compte | Conserver l’assistance par navigateur |
| **Product Radar / StartupFellows** | Surveillance dans le navigateur ou sur Telegram | Formulaire externe ou prise de contact | **2/5** | Surveillance organisée ; contact manuel | Conserver ces sources dans la sélection surveillée |
| **Contra / BotPool / Wellfound** | Surveillance dans le navigateur | Navigateur | **2/5** | Automatisation restreinte ou règles peu claires ; aucun outil de collecte | Conserver l’assistance du navigateur ; aucun outil de collecte prévu |
| **Telegram channels** | Surveillance dans le navigateur ou via une session utilisateur | Contact manuel | **2/5** | Respecter les règles des canaux ; aucun envoi massif non sollicité | Conserver un fonctionnement semi-manuel et configurable |
| **LinkedIn** | Liste d’étapes dans le navigateur | Manuelle / Easy Apply | **1/5** | **Aucune collecte automatisée ni candidature de masse** | Conserver uniquement un fonctionnement semi-manuel |
| **YC Co-Founder Matching / CoFoundersLab** | Parcours privé dans le navigateur | Mise en relation manuelle | **1/5** | **Aucune prise de contact automatisée ni aucun spam** | Conserver comme source surveillée manuellement |
| **Profi.ru** | Liste d’étapes dans le navigateur | Navigateur | **1/5** | Utilisation manuelle/dans le navigateur ; l’accès partenaire officiel nécessite mTLS | L’intégration partenaire mTLS est hors périmètre |
| **Arc.dev / Magier / Feltsense** | Mise en relation ou surveillance des offres | Manuelle | **1/5** | Mise en relation ou parcours manuel uniquement | Surveillance peu prioritaire ; aucune intégration avancée prévue |

L’ordre de développement actuel est le suivant :

1. Stabiliser Freelancer.com et finaliser le flux OAuth/candidature d’Upwork.
2. Améliorer la fiabilité de FL.ru, Freelance.ru, Weblancer et Kwork.
3. Ajouter de meilleurs filtres pour Remote OK et HH.ru et étoffer la liste d’entreprises des portails carrières.
4. Conserver une assistance par navigateur pour les plateformes fermées et sensibles aux conditions d’utilisation, au lieu de développer des outils de collecte fragiles.

### À propos des sources décomptées

Toutes les sources ci-dessus se lisent gratuitement, sauf **JobsPipe**, qui décompte un crédit par offre renvoyée. C’est pour cela qu’elle est la seule plateforme qu’une synthèse `include_jobs` ordinaire ne touche jamais : sinon, une exécution planifiée pourrait consommer un quota mensuel sans que personne ne s’en aperçoive. Utilisez-la délibérément avec l’outil `workix_jobspipe_search`, en indiquant `platforms: ["jobspipe"]`, ou en activant `JOBSPIPE_IN_DIGEST=1`. Un compteur local suit ce que ce MCP a dépensé et refuse de lancer un appel une fois le budget mensuel configuré épuisé ; `workix_jobspipe_usage` affiche ce qu’il reste.

JobsPipe est en lecture seule. Elle indexe les portails d’autrui et ne propose aucun point d’accès pour déposer une annonce : une offre n’entre dans cet index que si elle vit sur une source qu’elle parcourt déjà.

### À propos de la passerelle JobSpy

Indeed, Glassdoor, ZipRecruiter, Naukri et BDjobs sont lus via [JobSpy](https://github.com/speedyapply/JobSpy) (MIT), que **vous** installez : `pip install -U python-jobspy`, Python 3.10–3.12. Rien ne se produit tant que vous ne nommez pas explicitement l’une de ces plateformes — une synthèse ordinaire ne les touche pas.

Nous l’appelons plutôt que d’en copier le code, délibérément. Ces plateformes sont lues via des points d’accès privés utilisant des identifiants tirés de leurs propres applications mobiles ; garder cela en amont fait vivre ces identifiants dans votre installation au lieu d’être redistribués dans ce paquet, et celles et ceux qui maintiennent ces scrapers continuent de le faire.

Sachez que lors de nos propres tests, seul Indeed a renvoyé des résultats. Les autres sont bloqués ou limités depuis la plupart des adresses, et BDjobs déclenche actuellement une erreur au sein de JobSpy lui-même. Leur fonctionnement chez vous dépend de votre réseau, et leur usage relève de votre décision, dans le respect des conditions de chaque plateforme.

---

**Couverture actuelle :** 64 plateformes au catalogue, 36 livrées sous forme de modules adaptateurs téléchargeables. Au-delà des sources d’emploi et de freelance ci-dessus, le même système de modules dessert le catalogue d’applications **dStore** (publier un site ou une PWA en ligne, trouver des applications similaires) et un lecteur facultatif de canaux **Telegram**.


Le catalogue des sources se trouve dans [`mcp/platforms.json`](mcp/platforms.json). Exécutez `workix_list_platforms` pour obtenir la liste exploitable par une machine et `workix_sources_status` pour savoir quelles intégrations sont disponibles avec votre configuration locale actuelle.

## Documentation et flux

- [Guide pour les agents](https://workix.co/agent)
- [Présentation exploitable par une machine](https://workix.co/llms.txt)
- [Référence de l’API](https://workix.co/api.txt)
- [Document OpenAPI](https://workix.co/openapi-v1.yaml)
- [Assistance](https://workix.co/support)
- RSS : [missions](https://workix.co/feed/tasks.xml), [projets](https://workix.co/feed/projects.xml), [prestataires](https://workix.co/feed/performers.xml)

## Contribuer

Les contributions sont les bienvenues : nouveaux adaptateurs MCP, outils, préréglages, tests, améliorations de la vitrine, documentation et traductions.

Commencez par consulter [CONTRIBUTING.md](CONTRIBUTING.md). Pour toute question concernant le produit ou l’API, utilisez l’[assistance Workix](https://workix.co/support).

## Licence

Consultez [LICENSE](LICENSE). Toute modification ou redistribution doit clairement mentionner l’origine du projet. Toute réutilisation commerciale nécessite un accord préalable.

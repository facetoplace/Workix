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
| **Kwork** | API non officielle avec identifiants locaux | Navigateur | **3/5** | Accès non officiel à haut risque ; aucune candidature automatique | Améliorer la fiabilité de la connexion et des proxys |
| **Freelance.ru** | RSS ; un proxy peut être nécessaire | Navigateur | **3/5** | RSS public ; aucun contournement des restrictions de compte | Rendre les flux plus résistants aux blocages |
| **Weblancer** | RSS ; un proxy peut être nécessaire | Navigateur | **3/5** | RSS public ; aucun contournement des restrictions de compte | Rendre les flux plus résistants aux blocages |
| **Habr Career** | Surveillance dans le navigateur | Navigateur | **2/5** | Pages publiques/RSS uniquement ; aucune candidature de masse | Ajouter le RSS à la synthèse partagée |
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
3. Ajouter de meilleurs filtres pour Remote OK et HH.ru, puis intégrer le RSS de Habr Career.
4. Conserver une assistance par navigateur pour les plateformes fermées et sensibles aux conditions d’utilisation, au lieu de développer des outils de collecte fragiles.

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

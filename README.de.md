# Workix

**Sprachen:** [English](README.md) · [Русский](README.ru.md) · [Español](README.es.md) · [Deutsch](README.de.md) · [Français](README.fr.md) · [Türkçe](README.tr.md) · [Українська](README.uk.md) · [हिन्दी](README.hi.md) · [中文](README.zh.md)

Workix ist ein Ort, an dem Menschen, Projekte und Arbeit zueinanderfinden.

Der [Workix-Hub](https://workix.co) vereint drei Dinge in einem Katalog:

- **Projekte** — Start-ups, Produkte und Communities, die Mitwirkende suchen.
- **Rollen und Aufträge** — offene Aufgaben mit Beschreibung, Budget, Tags und einer Bewerbungsmöglichkeit.
- **Auftragnehmende** — Fachkräfte, die für neue Projekte offen sind.

Workix ist kein klassischer Freelance-Marktplatz. Es versucht nicht, die Beziehung zwischen einem Projekt und einer Fachkraft zu ersetzen. Ein Eintrag führt zum bevorzugten Kontaktweg oder Bewerbungsformular des Projektverantwortlichen, während Workix dafür sorgt, dass die Gelegenheit leicht veröffentlicht, gefunden und geteilt werden kann.

Menschen können den Katalog im Web durchsuchen. KI-Agenten können ihn über MCP oder die REST-API durchsuchen und Einträge verwalten. Dasselbe lokale MCP kann außerdem Angebote von externen Plattformen sammeln, wobei die Plattform-Zugangsdaten auf dem Rechner des Nutzers verbleiben.

**Workix öffnen:** [workix.co](https://workix.co)  
**Leitfaden für Agenten:** [workix.co/agent](https://workix.co/agent)  
**API-Referenz:** [workix.co/api.txt](https://workix.co/api.txt)

## Bitte deinen Agenten, Workix zu erkunden

Füge diesen Prompt in Cursor, Claude oder einen anderen Coding-Agenten ein. Er fordert den Agenten auf, sich mit Workix vertraut zu machen und dir anschließend bei deinem konkreten Ziel zu helfen.

```text
Lerne, wie Workix funktioniert:

1. Öffne https://workix.co/agent, https://workix.co/llms.txt
   und https://workix.co/api.txt.
2. Öffne https://github.com/facetoplace/Workix und lies README.de.md.
3. Erkläre in einfacher Sprache:
   - was Workix ist und für wen es gedacht ist;
   - wie ich Projekte, Rollen, Aufträge und Auftragnehmende durchsuchen kann;
   - was ein KI-Agent über Workix MCP und die API tun kann;
   - welche Komponenten lokal ausgeführt werden und wie Zugangsdaten geschützt bleiben.
4. Sieh dir mein aktuelles Projekt an und hilf mir, einen sinnvollen nächsten Schritt auszuwählen und abzuschließen:
   - Workix MCP mit meinem Agenten verbinden;
   - nach passenden Aufträgen oder Auftragnehmenden suchen;
   - ein Projekt, eine Rolle oder ein Profil für Auftragnehmende veröffentlichen oder aktualisieren;
   - die Workix-Benutzeroberfläche auf meiner eigenen Domain bereitstellen;
   - eine Verbesserung zu Workix beitragen.

Verwende WORKIX_API=https://workix.co für den zentralen Hub.
Lade keine Passwörter oder Tokens von Freelance-Plattformen zum Hub hoch.
Passe die Anweisungen an mein Betriebssystem, meine Werkzeuge und mein Projekt an.
```

## Was enthält dieses Repository?

Dieses Repository enthält die offenen Clients und Integrationen für Workix. Sie verwenden die API des zentralen Hubs unter `https://workix.co`, sodass eine lokale Kopie den gemeinsamen Katalog anzeigen kann, ohne einen separaten Katalog zu pflegen.

- [`views/`](views/) enthält die Seiten der Benutzeroberfläche.
- [`assets/`](assets/) enthält die Browser-Anwendung, Stile, Übersetzungen, PWA-Dateien und öffentlichen API-Dokumente.
- [`mcp/`](mcp/) enthält den TypeScript-MCP-Server, Workix-Werkzeuge und Adapter für unterstützte Jobplattformen.
- [`docker/`](docker/) enthält ein kleines nginx-Image zum Bereitstellen der Benutzeroberfläche.
- [`docs/`](docs/) enthält öffentliche Leitfäden für Agenten und Self-Hosting.

Die beiden Hauptbestandteile sind voneinander unabhängig:

1. **Benutzeroberfläche** — eine Weboberfläche zum Durchsuchen des Workix-Katalogs. Du kannst sie unter [workix.co](https://workix.co) verwenden oder die Oberfläche auf deiner eigenen Domain hosten.
2. **MCP-Server** — Werkzeuge, mit denen ein KI-Agent Workix durchsuchen, deine Einträge und dein Profil verwalten, Angebote vorbereiten und mit unterstützten externen Quellen arbeiten kann.

Die Katalogdaten werden von der zentralen Workix-API bereitgestellt. Für den Betrieb der Benutzeroberfläche oder die Verbindung des MCP-Clients sind keine Produktionsgeheimnisse erforderlich.

## Workix mit einem KI-Agenten verwenden

Mit `WORKIX_API=https://workix.co` kann ein Agent Projekte, Rollen, Aufträge und Auftragnehmende durchsuchen. Mit einem `WORKIX_AGENT_KEY` kann er außerdem Einträge erstellen oder aktualisieren und ein Profil für Auftragnehmende verwalten.

So führst du den MCP-Server lokal aus:

Erfordert **Node 22.5 oder neuer**: Der lokale Speicher ist SQLite über Nodes eingebautes `node:sqlite`, sodass bei der Installation nichts kompiliert werden muss.

```bash
git clone https://github.com/facetoplace/Workix.git
cd Workix/mcp
npm install
npm run build
```

Beispielkonfiguration für Cursor MCP:

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

Registriere dich unter [workix.co](https://workix.co), um einen Agentenschlüssel zu erhalten. Für die öffentliche Suche ist der Schlüssel optional, für Aktionen im Zusammenhang mit deinem Konto ist er erforderlich.

Zugangsdaten externer Plattformen gehören ausschließlich in die lokale MCP-Umgebung. Sende keine Passwörter oder Tokens von Upwork, Kwork oder anderen Plattformen an den Workix-Hub.

Unter [`mcp/README.md`](mcp/README.md) findest du Informationen zur Installation, zu den verfügbaren Werkzeugen und zu quellenspezifischen Einstellungen.

## Die Benutzeroberfläche auf deiner Domain hosten

Projekte und Communities können die Workix-Benutzeroberfläche über eine Domain wie `work.example.com` bereitstellen. Der Spiegel liest den gemeinsamen Katalog weiterhin von `https://workix.co`.

1. Stelle `views/` und `assets/` bereit oder verwende das Image in [`docker/`](docker/).
2. Richte die Oberfläche auf den Hub aus:

   ```html
   <meta name="workix-api" content="https://workix.co" />
   ```

   Alternativ kannst du `API_BASE` oder `WORKIX_API` auf `https://workix.co` setzen.
3. Konfiguriere DNS und Hosting für die gewählte Domain.

Einträge, die mit dieser Domain verknüpft sind, können für Besucher des Spiegels hervorgehoben werden. Ein Live-Beispiel findest du unter [work.facetoplace.app](https://work.facetoplace.app/), weitere Einzelheiten unter [`docs/self-host.md`](docs/self-host.md).

## Andere Plattformen über Workix MCP verwenden

Workix MCP dient außerdem als einheitliche Schnittstelle für die Arbeit mit externen Freelance-Marktplätzen und Jobbörsen. Ein Agent kann mehrere Quellen in einer Übersicht durchsuchen, einen bestimmten Eintrag öffnen, ein Angebot entwerfen und es entweder über eine verfügbare API einreichen oder eine Browser-Checkliste für dich vorbereiten.

Diese Integrationen werden lokal ausgeführt. API-Tokens, Plattform-Anmeldedaten und Browsersitzungen verbleiben auf deinem Rechner und werden nicht an den Workix-Hub gesendet. Das Einreichen eines Angebots erfordert immer eine ausdrückliche menschliche Bestätigung.

### Plattform-Reifegrad

Die Bewertung beschreibt, wie viel des **vorgesehenen Workix-Ablaufs** heute einsatzbereit ist, nicht wie umfassend die jeweilige Plattform selbst abgedeckt wird:

- **5/5** — Suche und Einreichung funktionieren über eine unterstützte API.
- **4/5** — zuverlässige Suche; Einreichung oder Authentifizierung hat noch einen Ausweichweg oder eine Einschränkung.
- **3/5** — nützliche Integration, deren Zuverlässigkeit jedoch durch Zugangsdaten, Proxys oder eine inoffizielle Schnittstelle beeinträchtigt wird.
- **2/5** — browsergestützte Beobachtungsquelle statt eines automatisierten Feeds.
- **1/5** — nur Link/Checkliste; tiefgreifende Automatisierung ist bewusst nicht vorgesehen.

Die Spalte **Automatisierungsrichtlinie** ist bewusst konservativ gehalten. Plattformbedingungen und API-Berechtigungen können sich ändern; Nutzer müssen daher zusätzlich die jeweils aktuellen Regeln jeder Quelle und ihres eigenen Kontos einhalten.

| Plattform | Suche / Lesen | Bewerben | Reifegrad | Automatisierungsrichtlinie | Ausrichtung |
|-----------|----------------|----------|:---------:|----------------------------|-------------|
| **Freelancehunt** | Offizielle API | API | **5/5** | Freigegebene API und Token | Vollständigen Ablauf beibehalten |
| **Freelancer.com** | Offizielle API | API-Gebot | **4/5** | Freigegebene API und OAuth | Authentifizierung und Fehlerbehandlung stabilisieren |
| **Upwork** | OAuth GraphQL | API, sofern zulässig; Browser als Ausweichlösung | **4/5** | Nur freigegebene API-Berechtigungen; kein unautorisiertes Scraping | OAuth-Einrichtung und Ausweichlösung für Angebote abschließen |
| **FL.ru** | RSS | Browser | **4/5** | Öffentliches RSS; Bewerbung bleibt unter menschlicher Kontrolle | Kategorien und Budgetanalyse verbessern |
| **HH.ru** | Offizielle API | Browser | **4/5** | Regeln der offiziellen API und vorgeschriebener User-Agent | Projekt-/Remote-Filter verbessern; Bewerbung per API ist optional |
| **Remote OK** | Öffentliche API | Website des Arbeitgebers | **4/5** | Öffentlicher Feed; nach der Weiterleitung gelten die Regeln des Arbeitgebers | Tag- und Technologiefilter verbessern |
| **Remotive · Arbeitnow · Himalayas · Jobicy · Working Nomads · The Muse · 4 Day Week · AI Dev Jobs** | Öffentliche API | Website des Arbeitgebers | **4/5** | Öffentliche Feeds; nach der Weiterleitung gelten die Regeln des Arbeitgebers | Als `include_jobs`-Quellen beibehalten |
| **We Work Remotely · Aquent · Jobspresso** | Öffentliches RSS | Website des Arbeitgebers | **4/5** | Öffentliche Feeds; nach der Weiterleitung gelten die Regeln des Arbeitgebers | Als `include_jobs`-Quellen beibehalten |
| **Karriereseiten der Arbeitgeber** (Greenhouse · Ashby · Lever · SmartRecruiters · Workable) | Öffentliche API je Unternehmen | Eigenes Karriereportal des Arbeitgebers | **4/5** | Öffentliche Endpunkte der Karriereseiten; der Bewerbungslink führt zum Arbeitgeber | Unternehmensliste in `ats-companies.json` erweitern |
| **Trudwsem (Arbeit in Russland)** | Öffentliche Open-Data-API | Extern | **4/5** | Staatliche offene Daten; kein Kontozugriff | Regionsvorlagen ergänzen; Veröffentlichung erfordert nationale E-Signatur und ist nicht vorgesehen |
| **NoFluffJobs · Landing.jobs · Get on Board** | Öffentliche API | Website des Arbeitgebers | **4/5** | Öffentliche Feeds; nach der Weiterleitung gelten die Regeln des Arbeitgebers | Als `include_jobs`-Quellen beibehalten |
| **Djinni** | Öffentliches RSS | Konto auf der Plattform | **3/5** | Öffentlicher Feed; die Bewerbung bleibt beim Menschen | Als `include_jobs`-Quelle beibehalten |
| **Adzuna** | Offizielle API mit eigenen Schlüsseln | Website des Arbeitgebers | **4/5** | Registrierte API-Schlüssel; der kostenlose Tarif ist ratenbegrenzt | In `include_jobs` behalten; Kontingentfehler klar anzeigen |
| **JobsPipe** (LinkedIn · Indeed · Y Combinator · Greenhouse · Lever · Ashby · SmartRecruiters · Workday · Workable · Paylocity) | Offizielle API mit eigenem Schlüssel | Website des Arbeitgebers | **4/5** | Nach Verbrauch: ein Guthaben je gelieferter Stelle; dein Schlüssel, dein Kontingent | Bewusst außerhalb der automatischen Übersicht — siehe unten |
| **USAJOBS · Careerjet · Jooble** | Offizielle API mit eigenem Schlüssel | Extern | **4/5** | Kostenlose Schlüssel; jeweils eigene Regeln | In `include_jobs` behalten, sobald der Schlüssel gesetzt ist |
| **SuperJob** | Offizielle API mit eigenem Schlüssel | Browser | **3/5** | Regeln der offiziellen API | Antwortet von Rechenzentrumsadressen mit 403; braucht Schlüssel und oft Proxy |
| **Reddit** (r/forhire und ähnliche) | Öffentlicher Atom-Feed | Kommentar oder DM von Hand | **2/5** | **Keine automatischen Beiträge oder Direktnachrichten** | Nur Feed; die JSON-API verlangt eine registrierte OAuth-App |
| **Dream Offer** | Öffentlicher HTTP-Feed | Website des Arbeitgebers | **3/5** | Öffentlicher Feed; kein Kontozugriff | Auf Feed-Änderungen achten |
| **Claw Earn · SeekClaw · Openwork** | Agenten-API | Agenten-API | **4/5** | Agentenplattformen; Einreichung über deren eigene API | In `include_agent_gigs` behalten; offene Aufträge sind oft leer |
| **Superteam Earn** | Agenten-API mit eigenem Schlüssel | Agenten-API | **4/5** | Erfordert `SUPERTEAM_EARN_API_KEY` | In `include_agent_gigs` behalten |
| **Growth.Talent · RentAHuman** | Öffentliche API | Agenten-API oder Browser | **4/5** | Öffentliche Anzeigen; für die Bewerbung ist ein Schlüssel nötig | In `include_agent_gigs` behalten |
| **Kwork** | Inoffizielle API mit lokalen Zugangsdaten | Browser | **3/5** | Riskanter inoffizieller Zugriff; keine automatische Bewerbung | Zuverlässigkeit von Anmeldung und Proxy verbessern |
| **Freelance.ru** | RSS; möglicherweise ist ein Proxy erforderlich | Browser | **3/5** | Öffentliches RSS; keine Umgehung von Kontobeschränkungen | Feeds widerstandsfähiger gegen Blockierungen machen |
| **Weblancer** | RSS; möglicherweise ist ein Proxy erforderlich | Browser | **3/5** | Öffentliches RSS; keine Umgehung von Kontobeschränkungen | Feeds widerstandsfähiger gegen Blockierungen machen |
| **Indeed** | JobSpy-Brücke (optional, benötigt Python) | Website des Arbeitgebers | **3/5** | Läuft über deine eigene `python-jobspy`-Installation, unter deren und deinen Bedingungen | Als optionale Brücke behalten; kein eigener Scraper |
| **Glassdoor · ZipRecruiter · Naukri** | JobSpy-Brücke (optional, benötigt Python) | Website des Arbeitgebers | **1/5** | Dieselbe Brücke; von den meisten Adressen kommt 403 oder ein Timeout | Angebunden, aber unzuverlässig — hängt von deinem Netz ab |
| **BDjobs** | JobSpy-Brücke — **upstream defekt** | Website des Arbeitgebers | **1/5** | Blockiert durch einen Fehler in `python-jobspy` selbst, nicht durch die Plattform | Wartet auf einen Upstream-Fix; aufgeführt, damit es nicht für einen Konfigurationsfehler gehalten wird |
| **Habr Career** | Öffentliches Frontend-JSON, RSS als Rückfallebene | Browser | **4/5** | Nur öffentliche Endpunkte; keine Massenbewerbungen | Liefert Gehalt, Level und Skills; RSS bleibt die Rückfallebene |
| **Fiverr · SproutGigs** | Browser-Beobachtung | Browser | **2/5** | Eingehende Briefings und manuelle Angebote; kein Scraper | Browsergestützt belassen |
| **Avito Dienstleistungen · YouDo** | Browser-Beobachtung | Browser | **2/5** | Manuelle Erfassung; keine Umgehung von Kontoregeln | Browsergestützt belassen |
| **Product Radar / StartupFellows** | Browser- oder Telegram-Beobachtung | Externes Formular oder Kontakt | **2/5** | Kuratierte Beobachtung; manueller Kontakt | Als kuratierte Beobachtungsquellen beibehalten |
| **Contra / BotPool / Wellfound** | Browser-Beobachtung | Browser | **2/5** | Eingeschränkte oder unklare Automatisierung; kein Scraper | Browsergestützt belassen; kein Scraper geplant |
| **Telegram channels** | Beobachtung per Browser/Nutzersitzung | Manueller Kontakt | **2/5** | Kanalregeln einhalten; keine unaufgeforderten Massennachrichten | Halbmanuell und konfigurierbar belassen |
| **LinkedIn** | Browser-Checkliste | Manuell / Easy Apply | **1/5** | **Kein automatisiertes Scraping und keine Massenbewerbungen** | Nur halbmanuell belassen |
| **YC Co-Founder Matching / CoFoundersLab** | Privater Browser-Ablauf | Manuelle Vorstellung | **1/5** | **Keine automatisierte Kontaktaufnahme und kein Spam** | Als manuelle Beobachtungsquelle beibehalten |
| **Profi.ru** | Browser-Checkliste | Browser | **1/5** | Browser-/manuelle Nutzung; offizieller Partnerzugriff erfordert mTLS | Partner-mTLS-Integration ist nicht vorgesehen |
| **Arc.dev / Magier / Feltsense** | Matching- oder Karrierebeobachtung | Manuell | **1/5** | Nur Matching/manueller Ablauf | Beobachtung mit niedriger Priorität; keine tiefe Integration geplant |

Die aktuelle Entwicklungsreihenfolge lautet:

1. Freelancer.com stabilisieren und den OAuth-/Bewerbungsablauf für Upwork abschließen.
2. Die Zuverlässigkeit von FL.ru, Freelance.ru, Weblancer und Kwork verbessern.
3. Bessere Filter für Remote OK und HH.ru hinzufügen und die Unternehmensliste der Arbeitgeber-Karriereseiten erweitern.
4. Geschlossene und AGB-sensible Plattformen browsergestützt belassen, statt anfällige Scraper zu entwickeln.

### Zu Quellen mit Verbrauchszählung

Alle Quellen oben lassen sich kostenlos lesen — außer **JobsPipe**, das ein Guthaben je gelieferter Stelle abrechnet. Deshalb ist es die einzige Plattform, die eine schlichte `include_jobs`-Übersicht nie anfasst: Ein geplanter Lauf könnte sonst unbemerkt ein Monatskontingent verbrauchen. Greif bewusst darauf zu — mit dem Werkzeug `workix_jobspipe_search`, per `platforms: ["jobspipe"]` oder mit `JOBSPIPE_IN_DIGEST=1`. Ein lokaler Zähler verfolgt, was dieses MCP ausgegeben hat, und startet keinen Aufruf mehr, sobald dein konfiguriertes Monatsbudget aufgebraucht ist; `workix_jobspipe_usage` zeigt den Rest.

JobsPipe ist rein lesend. Es indexiert fremde Karriereseiten und hat keinen Endpunkt zum Einstellen von Anzeigen — eine Stelle landet dort nur, wenn sie auf einer Quelle liegt, die JobsPipe ohnehin durchsucht.

### Zur JobSpy-Brücke

Indeed, Glassdoor, ZipRecruiter, Naukri und BDjobs werden über [JobSpy](https://github.com/speedyapply/JobSpy) (MIT) gelesen, das **du** installierst: `pip install -U python-jobspy`, Python 3.10–3.12. Es passiert nichts, solange du keine dieser Plattformen ausdrücklich nennst — eine gewöhnliche Übersicht rührt sie nicht an.

Wir rufen es bewusst auf, statt seinen Code zu kopieren. Diese Plattformen werden über private Endpunkte mit Zugangsdaten aus ihren eigenen Mobil-Apps gelesen; so bleiben diese Daten in deiner Installation, statt in unserem Paket weiterverteilt zu werden, und die Betreuer der Scraper pflegen sie weiter.

Beachte: In unseren eigenen Tests lieferte nur Indeed Ergebnisse. Die übrigen sind von den meisten Adressen blockiert oder ratenbegrenzt, und BDjobs wirft derzeit einen Fehler innerhalb von JobSpy selbst. Ob sie bei dir funktionieren, hängt von deinem Netz ab — und ihre Nutzung ist deine Entscheidung unter den Bedingungen der jeweiligen Plattform.

---

**Abdeckung heute:** 64 Plattformen im Katalog, 36 davon als herunterladbare Adapter-Module. Über die Job- und Freelance-Quellen oben hinaus bedient dasselbe Modulsystem den App-Katalog **dStore** (eine Live-Website oder PWA veröffentlichen, ähnliche Apps finden) und einen optionalen **Telegram**-Kanalleser.


Der Quellenkatalog befindet sich unter [`mcp/platforms.json`](mcp/platforms.json). Führe `workix_list_platforms` aus, um die maschinenlesbare Liste abzurufen, und `workix_sources_status`, um zu sehen, welche Integrationen mit deiner aktuellen lokalen Konfiguration verfügbar sind.

## Dokumentation und Feeds

- [Leitfaden für Agenten](https://workix.co/agent)
- [Maschinenlesbare Übersicht](https://workix.co/llms.txt)
- [API-Referenz](https://workix.co/api.txt)
- [OpenAPI-Dokument](https://workix.co/openapi-v1.yaml)
- [Support](https://workix.co/support)
- RSS: [Aufträge](https://workix.co/feed/tasks.xml), [Projekte](https://workix.co/feed/projects.xml), [Auftragnehmende](https://workix.co/feed/performers.xml)

## Mitwirken

Beiträge sind willkommen: neue MCP-Adapter, Werkzeuge, Voreinstellungen, Tests, Verbesserungen der Benutzeroberfläche, Dokumentation und Übersetzungen.

Beginne mit [CONTRIBUTING.md](CONTRIBUTING.md). Bei Fragen zum Produkt oder zur API wende dich an den [Workix-Support](https://workix.co/support).

## Lizenz

Siehe [LICENSE](LICENSE). Änderungen und Weiterverbreitung erfordern eine eindeutige Namensnennung. Die kommerzielle Wiederverwendung bedarf einer vorherigen Vereinbarung.

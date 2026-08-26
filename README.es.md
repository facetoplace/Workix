# Workix

**Idiomas:** [English](README.md) · [Русский](README.ru.md) · [Español](README.es.md) · [Deutsch](README.de.md) · [Français](README.fr.md) · [Türkçe](README.tr.md) · [Українська](README.uk.md) · [हिन्दी](README.hi.md) · [中文](README.zh.md)

Workix es un lugar donde las personas, los proyectos y el trabajo se encuentran.

El [hub de Workix](https://workix.co) reúne tres elementos en un solo catálogo:

- **Proyectos** — startups, productos y comunidades que buscan personas.
- **Roles y encargos** — oportunidades de trabajo abiertas con descripción, presupuesto, etiquetas y una forma de postularse.
- **Profesionales** — especialistas disponibles para nuevos proyectos.

Workix no es un marketplace freelance tradicional. No pretende sustituir la relación entre un proyecto y un especialista. Cada anuncio dirige al medio de contacto o formulario de postulación que prefiera el responsable del proyecto, mientras que Workix facilita publicar, descubrir y compartir la oportunidad.

Las personas pueden explorar el catálogo en la web. Los agentes de IA pueden buscar en él y gestionar anuncios mediante MCP o la API REST. El mismo MCP local también puede recopilar oportunidades de plataformas externas y mantener las credenciales de esas plataformas en el equipo del usuario.

**Abrir Workix:** [workix.co](https://workix.co)\
**Guía para agentes:** [workix.co/agent](https://workix.co/agent)\
**Referencia de la API:** [workix.co/api.txt](https://workix.co/api.txt)

## Pide a tu agente que explore Workix

Pega este prompt en Cursor, Claude u otro agente de programación. Le pide al agente que estudie Workix y después te ayude con tu objetivo concreto.

```text
Aprende cómo funciona Workix:

1. Abre https://workix.co/agent, https://workix.co/llms.txt
   y https://workix.co/api.txt.
2. Abre https://github.com/facetoplace/Workix y lee README.es.md.
3. Explica con palabras sencillas:
   - qué es Workix y a quién va dirigido;
   - cómo puedo explorar proyectos, roles, encargos y profesionales;
   - qué puede hacer un agente de IA mediante el MCP y la API de Workix;
   - qué componentes se ejecutan localmente y cómo se protegen las credenciales.
4. Revisa mi proyecto actual y ayúdame a elegir y completar un siguiente paso útil:
   - conectar Workix MCP con mi agente;
   - buscar trabajos o profesionales relevantes;
   - publicar o actualizar un proyecto, un rol o un perfil profesional;
   - desplegar la interfaz de Workix en mi propio dominio;
   - contribuir con una mejora a Workix.

Usa WORKIX_API=https://workix.co para el hub central.
No subas al hub contraseñas ni tokens de plataformas freelance.
Adapta las instrucciones a mi sistema operativo, mis herramientas y mi proyecto.
```

## ¿Qué contiene este repositorio?

Este repositorio contiene los clientes y las integraciones abiertas de Workix. Utilizan la API del hub central en `https://workix.co`, por lo que una copia local puede mostrar el catálogo compartido sin tener que mantener un catálogo separado.

- [`views/`](views/) contiene las páginas de la interfaz.
- [`assets/`](assets/) contiene la aplicación web, los estilos, las traducciones, los archivos de la PWA y los documentos públicos de la API.
- [`mcp/`](mcp/) contiene el servidor MCP en TypeScript, las herramientas de Workix y los adaptadores para las plataformas de empleo compatibles.
- [`docker/`](docker/) contiene una pequeña imagen de nginx para servir la interfaz.
- [`docs/`](docs/) contiene guías públicas para agentes y alojamiento propio.

Las dos partes principales son independientes:

1. **Interfaz** — una interfaz web para explorar el catálogo de Workix. Puedes usarla en [workix.co](https://workix.co) o alojarla en tu propio dominio.
2. **Servidor MCP** — herramientas que permiten a un agente de IA buscar en Workix, gestionar tus anuncios y tu perfil, preparar propuestas y trabajar con fuentes externas compatibles.

Los datos del catálogo se sirven mediante la API central de Workix. No se necesitan secretos de producción para ejecutar la interfaz ni para conectar el cliente MCP.

## Usa Workix con un agente de IA

Con `WORKIX_API=https://workix.co`, un agente puede buscar proyectos, roles, encargos y profesionales. Con una `WORKIX_AGENT_KEY`, también puede crear o actualizar anuncios y gestionar un perfil profesional.

Para ejecutar el servidor MCP localmente:

Requiere **Node 22.5 o posterior**: el almacenamiento local es SQLite a través del módulo `node:sqlite` incluido en Node, así que no hay que compilar nada al instalar.

```bash
git clone https://github.com/facetoplace/Workix.git
cd Workix/mcp
npm install
npm run build
```

Ejemplo de configuración de MCP para Cursor:

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

Regístrate en [workix.co](https://workix.co) para obtener una clave de agente. La clave es opcional para las búsquedas públicas y obligatoria para las acciones vinculadas a tu cuenta.

Las credenciales de plataformas externas solo deben guardarse en el entorno MCP local. No envíes contraseñas ni tokens de Upwork, Kwork u otras plataformas al hub de Workix.

Consulta [`mcp/README.md`](mcp/README.md) para conocer la instalación, las herramientas disponibles y la configuración específica de cada fuente.

## Aloja la interfaz en tu dominio

Los proyectos y las comunidades pueden servir la interfaz de Workix desde un dominio como `work.example.com`. El espejo seguirá leyendo el catálogo compartido desde `https://workix.co`.

1. Despliega `views/` y `assets/`, o utiliza la imagen de [`docker/`](docker/).
2. Conecta la interfaz con el hub:

   ```html
   <meta name="workix-api" content="https://workix.co" />
   ```

   También puedes establecer `API_BASE` o `WORKIX_API` en `https://workix.co`.
3. Configura el DNS y el alojamiento del dominio elegido.

Los anuncios asociados a ese dominio pueden destacarse para quienes visiten el espejo. Consulta [work.facetoplace.app](https://work.facetoplace.app/) para ver un ejemplo en funcionamiento y [`docs/self-host.md`](docs/self-host.md) para obtener más información.

## Usa otras plataformas mediante Workix MCP

Workix MCP también ofrece una interfaz única para trabajar con marketplaces freelance y portales de empleo externos. Un agente puede buscar en varias fuentes dentro de un mismo resumen, abrir un anuncio concreto, redactar una propuesta y enviarla mediante una API disponible o prepararte una lista de comprobación para el navegador.

Estas integraciones se ejecutan localmente. Los tokens de API, los datos de acceso a las plataformas y las sesiones del navegador permanecen en tu equipo y no se envían al hub de Workix. El envío de propuestas siempre requiere una confirmación humana explícita.

### Preparación de las plataformas

La puntuación indica qué parte del **flujo de trabajo previsto en Workix** está disponible actualmente, no qué proporción de la propia plataforma está cubierta:

- **5/5** — la búsqueda y el envío funcionan mediante una API compatible.
- **4/5** — búsqueda fiable; el envío o la autenticación todavía tienen una alternativa o una limitación.
- **3/5** — integración útil, pero las credenciales, los proxies o una interfaz no oficial afectan a la fiabilidad.
- **2/5** — fuente de seguimiento asistida por el navegador en lugar de un feed automatizado.
- **1/5** — solo enlace o lista de comprobación; la automatización avanzada queda fuera del alcance de forma intencionada.

La columna **Política de automatización** es deliberadamente conservadora. Las condiciones de las plataformas y los permisos de las API pueden cambiar, por lo que los usuarios también deben respetar las normas vigentes de cada fuente y de su propia cuenta.

| Plataforma | Búsqueda / lectura | Postulación | Preparación | Política de automatización | Orientación |
|------------|--------------------|-------------|:-----------:|----------------------------|-------------|
| **Freelancehunt** | API oficial | API | **5/5** | API y token autorizados | Mantener el flujo de trabajo completo |
| **Freelancer.com** | API oficial | Oferta mediante API | **4/5** | API y OAuth autorizados | Estabilizar la autenticación y la gestión de errores |
| **Upwork** | OAuth GraphQL | API cuando se permita; navegador como alternativa | **4/5** | Solo permisos de API autorizados; sin scraping no autorizado | Completar la configuración de OAuth y la alternativa para propuestas |
| **FL.ru** | RSS | Navegador | **4/5** | RSS público; la postulación permanece bajo control humano | Mejorar las categorías y el análisis de presupuestos |
| **HH.ru** | API oficial | Navegador | **4/5** | Normas de la API oficial y agente de usuario obligatorio | Mejorar los filtros de proyectos y trabajo remoto; la postulación mediante API es opcional |
| **Remote OK** | API pública | Sitio del empleador | **4/5** | Feed público; tras la redirección se aplican las normas del empleador | Mejorar los filtros de etiquetas y tecnologías |
| **Remotive · Arbeitnow · Himalayas · Jobicy · Working Nomads · The Muse · 4 Day Week · AI Dev Jobs** | API pública | Sitio del empleador | **4/5** | Feeds públicos; tras la redirección se aplican las normas del empleador | Mantener como fuentes del resumen `include_jobs` |
| **We Work Remotely · Aquent · Jobspresso** | RSS público | Sitio del empleador | **4/5** | Feeds públicos; tras la redirección se aplican las normas del empleador | Mantener como fuentes del resumen `include_jobs` |
| **Portales de empleo de las empresas** (Greenhouse · Ashby · Lever · SmartRecruiters · Workable) | API pública por empresa | Portal propio del empleador | **4/5** | Endpoints públicos de las páginas de empleo; el enlace de postulación es el del empleador | Ampliar la lista de empresas en `ats-companies.json` |
| **Trudvsem (Trabajo en Rusia)** | API pública de datos abiertos | Externo | **4/5** | Datos abiertos estatales; sin acceso a la cuenta | Añadir preajustes por región; publicar exige firma electrónica nacional y queda fuera del alcance |
| **NoFluffJobs · Landing.jobs · Get on Board** | API pública | Sitio del empleador | **4/5** | Feeds públicos; tras la redirección se aplican las normas del empleador | Mantener como fuentes del resumen `include_jobs` |
| **Djinni** | RSS público | Cuenta en la plataforma | **3/5** | Feed público; la postulación sigue en manos de la persona | Mantener como fuente `include_jobs` |
| **Adzuna** | API oficial con tus propias claves | Sitio del empleador | **4/5** | Claves de API registradas; el plan gratuito tiene límite de frecuencia | Mantener en `include_jobs`; mostrar con claridad los errores de cuota |
| **JobsPipe** (LinkedIn · Indeed · Y Combinator · Greenhouse · Lever · Ashby · SmartRecruiters · Workday · Workable · Paylocity) | API oficial con tu propia clave | Sitio del empleador | **4/5** | Con contador: un crédito por cada empleo devuelto; tu clave, tu cuota | Deliberadamente fuera del resumen automático — véase más abajo |
| **USAJOBS · Careerjet · Jooble** | API oficial con tu propia clave | Externo | **4/5** | Claves gratuitas; cada una con sus propias normas | Mantener en `include_jobs` una vez configurada la clave |
| **SuperJob** | API oficial con tu propia clave | Navegador | **3/5** | Normas de la API oficial | Responde 403 desde direcciones de centros de datos; necesita clave y a menudo proxy |
| **Reddit** (r/forhire y similares) | Feed Atom público | Comentario o mensaje directo manual | **2/5** | **Sin publicaciones ni mensajes automáticos** | Solo lectura del feed; la API JSON exige una app OAuth registrada |
| **Dream Offer** | Feed HTTP público | Sitio del empleador | **3/5** | Feed público; sin acceso a la cuenta | Vigilar cambios en el feed |
| **Claw Earn · SeekClaw · Openwork** | API para agentes | API para agentes | **4/5** | Plataformas para agentes; el envío se hace por su propia API | Mantener en `include_agent_gigs`; a menudo no hay ofertas abiertas |
| **Superteam Earn** | API para agentes con tu propia clave | API para agentes | **4/5** | Requiere `SUPERTEAM_EARN_API_KEY` | Mantener en `include_agent_gigs` |
| **Growth.Talent · RentAHuman** | API pública | API para agentes o navegador | **4/5** | Anuncios públicos; postular requiere una clave | Mantener en `include_agent_gigs` |
| **Kwork** | API no oficial con credenciales locales | Navegador | **3/5** | Acceso no oficial de alto riesgo; sin postulación automática | Mejorar la fiabilidad del inicio de sesión y de los proxies |
| **Freelance.ru** | RSS; puede requerir un proxy | Navegador | **3/5** | RSS público; sin eludir restricciones de cuenta | Aumentar la resistencia de los feeds ante bloqueos |
| **Weblancer** | RSS; puede requerir un proxy | Navegador | **3/5** | RSS público; sin eludir restricciones de cuenta | Aumentar la resistencia de los feeds ante bloqueos |
| **Indeed** | Puente JobSpy (opcional, requiere Python) | Sitio del empleador | **3/5** | Funciona con tu propia instalación de `python-jobspy`, bajo sus condiciones y las tuyas | Mantener como puente opcional; sin scraper propio |
| **Glassdoor · ZipRecruiter · Naukri** | Puente JobSpy (opcional, requiere Python) | Sitio del empleador | **1/5** | El mismo puente; desde la mayoría de direcciones responden 403 o agotan el tiempo | Conectados pero poco fiables — depende de tu red |
| **BDjobs** | Puente JobSpy — **roto en el proyecto original** | Sitio del empleador | **1/5** | Lo impide un error dentro de `python-jobspy`, no la plataforma | A la espera de una corrección aguas arriba; se indica para que no se confunda con un fallo de configuración |
| **Habr Career** | JSON público del frontend, RSS de reserva | Navegador | **4/5** | Solo endpoints públicos; sin postulaciones masivas | Aporta salario, nivel y competencias; el RSS sigue como reserva |
| **Fiverr · SproutGigs** | Seguimiento en navegador | Navegador | **2/5** | Briefs entrantes y ofertas manuales; sin scraper | Mantener asistido por navegador |
| **Avito Servicios · YouDo** | Seguimiento en navegador | Navegador | **2/5** | Captura manual; sin eludir las normas de la cuenta | Mantener asistido por navegador |
| **Product Radar / StartupFellows** | Seguimiento en navegador o Telegram | Formulario externo o contacto | **2/5** | Seguimiento seleccionado; contacto manual | Mantenerlas como fuentes de seguimiento seleccionadas |
| **Contra / BotPool / Wellfound** | Seguimiento en navegador | Navegador | **2/5** | Automatización restringida o poco clara; sin scraper | Mantener la asistencia mediante navegador; no se prevé ningún scraper |
| **Telegram channels** | Seguimiento mediante navegador/sesión del usuario | Contacto manual | **2/5** | Respetar las normas del canal; sin mensajes masivos no solicitados | Mantener un proceso semimanual y configurable |
| **LinkedIn** | Lista de comprobación para el navegador | Manual / Easy Apply | **1/5** | **Sin scraping automatizado ni postulaciones masivas** | Mantener únicamente el proceso semimanual |
| **YC Co-Founder Matching / CoFoundersLab** | Flujo privado en navegador | Presentación manual | **1/5** | **Sin contacto automatizado ni spam** | Mantener como fuente de seguimiento manual |
| **Profi.ru** | Lista de comprobación para el navegador | Navegador | **1/5** | Uso manual/mediante navegador; el acceso oficial para socios requiere mTLS | La integración mTLS para socios queda fuera del alcance |
| **Arc.dev / Magier / Feltsense** | Seguimiento de coincidencias u ofertas profesionales | Manual | **1/5** | Solo flujo de coincidencias/manual | Seguimiento de baja prioridad; no se prevé una integración avanzada |

El orden de desarrollo actual es:

1. Estabilizar Freelancer.com y completar el flujo de OAuth/postulación de Upwork.
2. Mejorar la fiabilidad de FL.ru, Freelance.ru, Weblancer y Kwork.
3. Añadir mejores filtros para Remote OK y HH.ru y ampliar la lista de empresas de los portales de empleo.
4. Mantener las plataformas cerradas y sensibles a las condiciones de servicio asistidas por el navegador, en lugar de crear scrapers frágiles.

### Sobre las fuentes con contador

Todas las fuentes anteriores se leen gratis salvo **JobsPipe**, que cobra un crédito por cada empleo devuelto. Por eso es la única plataforma que un resumen `include_jobs` normal nunca toca: de lo contrario, una ejecución programada podría gastar una cuota mensual sin que nadie se diera cuenta. Úsala de forma deliberada con la herramienta `workix_jobspipe_search`, indicando `platforms: ["jobspipe"]` o activando `JOBSPIPE_IN_DIGEST=1`. Un contador local registra lo que ha gastado este MCP y se niega a iniciar una llamada cuando se agota el presupuesto mensual configurado; `workix_jobspipe_usage` muestra lo que queda.

JobsPipe es de solo lectura. Indexa portales ajenos y no tiene ningún endpoint para publicar, así que no es posible publicar una oferta a través de él: un anuncio llega a ese índice únicamente si vive en una fuente que ya rastrea.

### Sobre el puente JobSpy

Indeed, Glassdoor, ZipRecruiter, Naukri y BDjobs se leen a través de [JobSpy](https://github.com/speedyapply/JobSpy) (MIT), que instalas **tú**: `pip install -U python-jobspy`, Python 3.10–3.12. No ocurre nada mientras no nombres explícitamente una de esas plataformas: un resumen normal no las toca.

Lo llamamos en lugar de copiar su código a propósito. Esas plataformas se leen mediante endpoints privados con credenciales tomadas de sus propias aplicaciones móviles; mantenerlo aguas arriba hace que esas credenciales vivan en tu instalación en vez de redistribuirse dentro de este paquete, y quienes mantienen esos scrapers siguen manteniéndolos.

Ten en cuenta que en nuestras pruebas solo Indeed devolvió resultados. El resto están bloqueados o limitados desde la mayoría de direcciones, y BDjobs falla actualmente dentro del propio JobSpy. Que funcionen para ti depende de tu red, y usarlos es decisión tuya bajo las condiciones de cada plataforma.

---

**Cobertura actual:** 64 plataformas en el catálogo, 36 distribuidas como módulos adaptadores descargables. Más allá de las fuentes de empleo y freelance anteriores, el mismo sistema de módulos sirve al catálogo de aplicaciones **dStore** (publicar un sitio o PWA en vivo, encontrar aplicaciones similares) y a un lector opcional de canales de **Telegram**.


El catálogo de fuentes se encuentra en [`mcp/platforms.json`](mcp/platforms.json). Ejecuta `workix_list_platforms` para obtener la lista legible por máquinas y `workix_sources_status` para ver qué integraciones están disponibles con tu configuración local actual.

## Documentación y feeds

- [Guía para agentes](https://workix.co/agent)
- [Descripción general legible por máquinas](https://workix.co/llms.txt)
- [Referencia de la API](https://workix.co/api.txt)
- [Documento OpenAPI](https://workix.co/openapi-v1.yaml)
- [Soporte](https://workix.co/support)
- RSS: [encargos](https://workix.co/feed/tasks.xml), [proyectos](https://workix.co/feed/projects.xml), [participantes](https://workix.co/feed/performers.xml)

## Contribuciones

Las contribuciones son bienvenidas: nuevos adaptadores MCP, herramientas, ajustes predefinidos, pruebas, mejoras de la interfaz, documentación y traducciones.

Empieza por [CONTRIBUTING.md](CONTRIBUTING.md). Para preguntas sobre el producto o la API, utiliza el [soporte de Workix](https://workix.co/support).

## Licencia

Consulta [LICENSE](LICENSE). La modificación y la redistribución requieren una atribución clara. La reutilización comercial requiere un acuerdo previo.

# Workix

**Diller:** [English](README.md) · [Русский](README.ru.md) · [Español](README.es.md) · [Deutsch](README.de.md) · [Français](README.fr.md) · [Türkçe](README.tr.md) · [Українська](README.uk.md) · [हिन्दी](README.hi.md) · [中文](README.zh.md)

![Workix](./assets/img/workix-cover-v8-green-angular-w-agents-api-rss.png)

Workix; insanların, projelerin ve işlerin birbirini bulduğu bir yerdir.

[Workix merkezi](https://workix.co) üç unsuru tek bir katalogda buluşturur:

- **Projeler** — ekip arkadaşı arayan girişimler, ürünler ve topluluklar.
- **Roller ve iş ilanları** — açıklaması, bütçesi, etiketleri ve başvuru yöntemi bulunan açık işler.
- **Uzmanlar** — yeni projelere açık profesyoneller.

Workix, geleneksel bir serbest çalışma pazaryeri değildir. Bir proje ile uzman arasındaki ilişkinin yerini almaya çalışmaz. İlanlar, proje sahibinin tercih ettiği iletişim kanalına veya başvuru formuna yönlendirir; Workix ise fırsatların kolayca yayımlanmasını, keşfedilmesini ve paylaşılmasını sağlar.

Kullanıcılar kataloğa web üzerinden göz atabilir. Yapay zekâ ajanları MCP veya REST API aracılığıyla katalogda arama yapabilir ve ilanları yönetebilir. Aynı yerel MCP, platform kimlik bilgilerini kullanıcının bilgisayarında tutarak harici platformlardaki fırsatları da toplayabilir.

**Workix'i açın:** [workix.co](https://workix.co)  
**Ajan rehberi:** [workix.co/agent](https://workix.co/agent)  
**API referansı:** [workix.co/api.txt](https://workix.co/api.txt)

## Ajanınızdan Workix'i keşfetmesini isteyin

Bu istemi Cursor'a, Claude'a veya başka bir kodlama ajanına yapıştırın. İstem, ajandan Workix'i incelemesini ve ardından özel hedefiniz konusunda size yardımcı olmasını ister.

```text
Workix'in nasıl çalıştığını öğren:

1. https://workix.co/agent, https://workix.co/llms.txt
   ve https://workix.co/api.txt adreslerini aç.
2. https://github.com/facetoplace/Workix adresini aç ve README.tr.md dosyasını oku.
3. Şunları sade bir dille açıkla:
   - Workix nedir ve kimler içindir;
   - projelere, rollere, iş ilanlarına ve uzmanlara nasıl göz atabilirim;
   - bir yapay zekâ ajanı Workix MCP ve API aracılığıyla neler yapabilir;
   - hangi bölümler yerel olarak çalışır ve kimlik bilgileri nasıl güvende tutulur.
4. Mevcut projeme bak ve aşağıdaki yararlı adımlardan birini seçip tamamlamama yardım et:
   - Workix MCP'yi ajanıma bağlamak;
   - uygun işler veya uzmanlar aramak;
   - bir proje, rol ya da uzman profili yayımlamak veya güncellemek;
   - Workix vitrinini kendi alan adımda yayınlamak;
   - Workix'e katkıda bulunacak bir iyileştirme yapmak.

Merkezi hub için WORKIX_API=https://workix.co kullan.
Serbest çalışma platformlarının parolalarını veya belirteçlerini hub'a yükleme.
Talimatları işletim sistemime, araçlarıma ve projeme uyarla.
```

## Bu depoda neler var?

Bu depo, Workix'in açık istemcilerini ve entegrasyonlarını içerir. Bunlar `https://workix.co` adresindeki merkezi hub API'sini kullanır; böylece yerel bir kopya, ayrı bir katalog tutmadan ortak kataloğu görüntüleyebilir.

- [`views/`](views/) vitrin sayfalarını içerir.
- [`assets/`](assets/) tarayıcı uygulamasını, stilleri, çevirileri, PWA dosyalarını ve herkese açık API belgelerini içerir.
- [`mcp/`](mcp/) TypeScript MCP sunucusunu, Workix araçlarını ve desteklenen iş platformlarına yönelik adaptörleri içerir.
- [`docker/`](docker/) vitrini sunmak için küçük bir nginx imajı içerir.
- [`docs/`](docs/) ajanlara ve kendi sunucunuzda barındırmaya yönelik herkese açık rehberleri içerir.

İki ana bölüm birbirinden bağımsızdır:

1. **Vitrin** — Workix kataloğuna göz atmak için kullanılan web arayüzü. Arayüzü [workix.co](https://workix.co) adresinde kullanabilir veya kendi alan adınızda barındırabilirsiniz.
2. **MCP sunucusu** — bir yapay zekâ ajanının Workix'te arama yapmasını, ilanlarınızı ve profilinizi yönetmesini, teklif hazırlamasını ve desteklenen harici kaynaklarla çalışmasını sağlayan araçlar.

Katalog verileri merkezi Workix API'si tarafından sunulur. Vitrini çalıştırmak veya MCP istemcisini bağlamak için üretim ortamı sırları gerekmez.

## Workix'i bir yapay zekâ ajanıyla kullanma

Bir ajan, `WORKIX_API=https://workix.co` ayarıyla projelerde, rollerde, iş ilanlarında ve uzmanlarda arama yapabilir. `WORKIX_AGENT_KEY` sağlandığında hesabınıza bağlı ilanlar oluşturabilir veya bunları güncelleyebilir ve uzman profilini yönetebilir.

MCP sunucusunu yerel olarak çalıştırmak için:

**Node 22.5 veya üzeri** gerekir: yerel depolama, Node’un yerleşik `node:sqlite` modülü üzerinden SQLite kullanır; bu sayede kurulumda hiçbir şey derlenmez.

```bash
git clone https://github.com/facetoplace/Workix.git
cd Workix/mcp
npm install
npm run build
```

Örnek Cursor MCP yapılandırması:

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

Bir ajan anahtarı almak için [workix.co](https://workix.co) adresine kaydolun. Anahtar, herkese açık aramalar için isteğe bağlı; hesabınıza bağlı işlemler için zorunludur.

Harici platform kimlik bilgileri yalnızca yerel MCP ortamında bulunmalıdır. Upwork, Kwork veya diğer platformlara ait parolaları ve belirteçleri Workix hub'ına göndermeyin.

Kurulum, kullanılabilir araçlar ve kaynağa özel ayarlar için [`mcp/README.md`](mcp/README.md) dosyasına bakın.

## Vitrini kendi alan adınızda barındırma

Projeler ve topluluklar Workix arayüzünü `work.example.com` gibi bir alan adından sunabilir. Bu yansı, ortak kataloğu yine `https://workix.co` adresinden okur.

1. `views/` ile `assets/` dizinlerini yayınlayın veya [`docker/`](docker/) içindeki imajı kullanın.
2. Arayüzü hub'a yönlendirin:

   ```html
   <meta name="workix-api" content="https://workix.co" />
   ```

   Ayrıca `API_BASE` veya `WORKIX_API` değerini `https://workix.co` olarak ayarlayabilirsiniz.
3. Seçtiğiniz alan adı için DNS ve barındırma ayarlarını yapılandırın.

Bu alan adıyla ilişkilendirilmiş ilanlar, yansıyı ziyaret eden kullanıcılar için öne çıkarılabilir. Canlı bir örnek için [work.facetoplace.app](https://work.facetoplace.app/) adresine, ayrıntılar için [`docs/self-host.md`](docs/self-host.md) dosyasına bakın.

## Diğer platformları Workix MCP üzerinden kullanma

Workix MCP, harici serbest çalışma pazaryerleri ve iş ilanı panolarıyla çalışmak için de tek bir arayüz sunar. Bir ajan birden fazla kaynakta tek bir özet üzerinden arama yapabilir, belirli bir ilanı açabilir, teklif taslağı hazırlayabilir ve teklifi kullanılabilir bir API üzerinden gönderebilir ya da sizin için bir tarayıcı kontrol listesi oluşturabilir.

Bu entegrasyonlar yerel olarak çalışır. API belirteçleri, platform oturum bilgileri ve tarayıcı oturumları bilgisayarınızda kalır ve Workix hub'ına gönderilmez. Teklif gönderimi her zaman açıkça insan onayı gerektirir.

### Platform hazırlık durumu

Puan, platformun ne kadarının kapsandığını değil, **hedeflenen Workix iş akışının** bugün ne ölçüde hazır olduğunu gösterir:

- **5/5** — arama ve başvuru, desteklenen bir API üzerinden çalışır.
- **4/5** — arama güvenilirdir; başvuru veya kimlik doğrulamada hâlâ alternatif bir yöntem ya da kısıtlama vardır.
- **3/5** — entegrasyon kullanışlıdır ancak kimlik bilgileri, proxy'ler veya resmî olmayan bir arayüz güvenilirliği etkiler.
- **2/5** — otomatik akış yerine tarayıcı destekli izleme kaynağıdır.
- **1/5** — yalnızca bağlantı/kontrol listesi sunulur; kapsamlı otomasyon bilinçli olarak kapsam dışındadır.

**Otomasyon politikası** sütunu bilinçli olarak ihtiyatlı hazırlanmıştır. Platform koşulları ve API izinleri değişebileceğinden kullanıcılar her kaynağın güncel kurallarına ve kendi hesapları için geçerli koşullara da uymalıdır.

| Platform | Arama / okuma | Başvuru | Hazırlık | Otomasyon politikası | Hedef |
|----------|---------------|---------|:--------:|----------------------|-------|
| **Freelancehunt** | Resmî API | API | **5/5** | Onaylı API ve belirteç | Eksiksiz iş akışını sürdürmek |
| **Freelancer.com** | Resmî API | API üzerinden teklif | **4/5** | Onaylı API ve OAuth | Kimlik doğrulamayı ve hata işlemeyi kararlı hâle getirmek |
| **Upwork** | OAuth GraphQL | İzin verildiğinde API; tarayıcı alternatifi | **4/5** | Yalnızca onaylı API izinleri; izinsiz veri kazıma yok | OAuth kurulumunu ve teklif alternatifini tamamlamak |
| **FL.ru** | RSS | Tarayıcı | **4/5** | Herkese açık RSS; başvuru insan denetiminde kalır | Kategorileri ve bütçe ayrıştırmayı iyileştirmek |
| **HH.ru** | Resmî API | Tarayıcı | **4/5** | Resmî API kuralları ve zorunlu kullanıcı aracısı | Proje/uzaktan çalışma filtrelerini iyileştirmek; API üzerinden başvuru isteğe bağlıdır |
| **Remote OK** | Herkese açık API | İşverenin sitesi | **4/5** | Herkese açık akış; yönlendirmeden sonra işveren kuralları geçerlidir | Etiket ve teknoloji filtrelerini iyileştirmek |
| **Remotive · Arbeitnow · Himalayas · Jobicy · Working Nomads · The Muse · 4 Day Week · AI Dev Jobs** | Herkese açık API | İşverenin sitesi | **4/5** | Herkese açık akışlar; yönlendirmeden sonra işveren kuralları geçerlidir | `include_jobs` özet kaynakları olarak tutmak |
| **We Work Remotely · Aquent · Jobspresso** | Herkese açık RSS | İşverenin sitesi | **4/5** | Herkese açık akışlar; yönlendirmeden sonra işveren kuralları geçerlidir | `include_jobs` özet kaynakları olarak tutmak |
| **İşveren kariyer sayfaları** (Greenhouse · Ashby · Lever · SmartRecruiters · Workable) | Şirket bazında herkese açık API | İşverenin kendi ilan panosu | **4/5** | Kariyer sayfalarının herkese açık uç noktaları; başvuru bağlantısı işverene aittir | `ats-companies.json` içindeki şirket listesini genişletmek |
| **Trudvsem (Rusya’da İş)** | Herkese açık açık veri API’si | Harici | **4/5** | Devlete ait açık veri; hesap erişimi yok | Bölge hazır ayarları eklemek; ilan yayımlamak ulusal e-imza gerektirir ve kapsam dışıdır |
| **NoFluffJobs · Landing.jobs · Get on Board** | Herkese açık API | İşverenin sitesi | **4/5** | Herkese açık akışlar; yönlendirmeden sonra işveren kuralları geçerlidir | `include_jobs` özet kaynakları olarak tutmak |
| **Djinni** | Herkese açık RSS | Platformdaki hesap | **3/5** | Herkese açık akış; başvuru insanın denetiminde kalır | `include_jobs` kaynağı olarak tutmak |
| **Adzuna** | Kendi anahtarlarınızla resmî API | İşverenin sitesi | **4/5** | Kayıtlı API anahtarları; ücretsiz katmanda hız sınırı var | `include_jobs` içinde tutmak; kota hatalarını açıkça göstermek |
| **JobsPipe** (LinkedIn · Indeed · Y Combinator · Greenhouse · Lever · Ashby · SmartRecruiters · Workday · Workable · Paylocity) | Kendi anahtarınızla resmî API | İşverenin sitesi | **4/5** | Sayaçlı: dönen her ilan için bir kredi; anahtar sizin, kota sizin | Bilinçli olarak otomatik özetin dışında — aşağıya bakın |
| **USAJOBS · Careerjet · Jooble** | Kendi anahtarınızla resmî API | Harici | **4/5** | Ücretsiz anahtarlar; her birinin kendi kuralları var | Anahtar tanımlandığında `include_jobs` içinde tutmak |
| **SuperJob** | Kendi anahtarınızla resmî API | Tarayıcı | **3/5** | Resmî API kuralları | Veri merkezi adreslerinden 403 döner; anahtar ve çoğu zaman proxy gerekir |
| **Reddit** (r/forhire ve benzerleri) | Herkese açık Atom akışı | Elle yorum veya özel mesaj | **2/5** | **Otomatik gönderi veya özel mesaj yok** | Yalnızca akış; JSON API kayıtlı bir OAuth uygulaması ister |
| **Dream Offer** | Herkese açık HTTP akışı | İşverenin sitesi | **3/5** | Herkese açık akış; hesap erişimi yok | Akış değişikliklerini izlemek |
| **Claw Earn · SeekClaw · Openwork** | Ajan API’si | Ajan API’si | **4/5** | Ajanlara yönelik platformlar; gönderim kendi API’leri üzerinden | `include_agent_gigs` içinde tutmak; açık ilanlar çoğu zaman boş |
| **Superteam Earn** | Kendi anahtarınızla ajan API’si | Ajan API’si | **4/5** | `SUPERTEAM_EARN_API_KEY` gerekir | `include_agent_gigs` içinde tutmak |
| **Growth.Talent · RentAHuman** | Herkese açık API | Ajan API’si veya tarayıcı | **4/5** | Herkese açık ilanlar; başvuru için anahtar gerekir | `include_agent_gigs` içinde tutmak |
| **Kwork** | Yerel kimlik bilgileriyle resmî olmayan API | Tarayıcı | **3/5** | Yüksek riskli resmî olmayan erişim; otomatik başvuru yok | Oturum açma ve proxy güvenilirliğini iyileştirmek |
| **Freelance.ru** | RSS; proxy gerekebilir | Tarayıcı | **3/5** | Herkese açık RSS; hesap kısıtlamaları aşılmaz | Akışları engellemelere karşı daha dayanıklı hâle getirmek |
| **Weblancer** | RSS; proxy gerekebilir | Tarayıcı | **3/5** | Herkese açık RSS; hesap kısıtlamaları aşılmaz | Akışları engellemelere karşı daha dayanıklı hâle getirmek |
| **Indeed** | JobSpy köprüsü (isteğe bağlı, Python gerekir) | İşverenin sitesi | **3/5** | Kendi `python-jobspy` kurulumunuz üzerinden, onun ve sizin koşullarınızla çalışır | İsteğe bağlı köprü olarak tutmak; kendi kazıyıcımızı yazmıyoruz |
| **Glassdoor · ZipRecruiter · Naukri** | JobSpy köprüsü (isteğe bağlı, Python gerekir) | İşverenin sitesi | **1/5** | Aynı köprü; çoğu adresten 403 döner ya da zaman aşımına uğrar | Bağlı ama güvenilmez — ağınıza bağlı |
| **BDjobs** | JobSpy köprüsü — **kaynak projede bozuk** | İşverenin sitesi | **1/5** | Platform değil, `python-jobspy` içindeki bir hata engelliyor | Yukarı akıştaki düzeltme bekleniyor; yapılandırma hatası sanılmasın diye listelendi |
| **Habr Career** | Herkese açık ön yüz JSON’u, yedek olarak RSS | Tarayıcı | **4/5** | Yalnızca herkese açık uç noktalar; toplu başvuru yok | Maaş, seviye ve becerileri taşır; RSS yedek olarak kalır |
| **Fiverr · SproutGigs** | Tarayıcıyla izleme | Tarayıcı | **2/5** | Gelen brifingler ve elle teklifler; kazıyıcı yok | Tarayıcı destekli tutmak |
| **Avito Hizmetler · YouDo** | Tarayıcıyla izleme | Tarayıcı | **2/5** | Elle yakalama; hesap kurallarını aşma yok | Tarayıcı destekli tutmak |
| **Product Radar / StartupFellows** | Tarayıcı veya Telegram üzerinden izleme | Harici form veya iletişim | **2/5** | Seçilmiş kaynakları izleme; elle iletişim | Seçilmiş izleme kaynakları olarak tutmak |
| **Contra / BotPool / Wellfound** | Tarayıcıyla izleme | Tarayıcı | **2/5** | Otomasyon kısıtlı veya belirsiz; veri kazıyıcı yok | Tarayıcı destekli tutmak; veri kazıyıcı planlanmıyor |
| **Telegram kanalları** | Tarayıcı/kullanıcı oturumuyla izleme | Elle iletişim | **2/5** | Kanal kurallarına uyulur; istenmeyen toplu mesajlaşma yok | Yarı manuel ve yapılandırılabilir tutmak |
| **LinkedIn** | Tarayıcı kontrol listesi | Manuel / Easy Apply | **1/5** | **Otomatik veri kazıma veya toplu başvuru yok** | Yalnızca yarı manuel tutmak |
| **YC Co-Founder Matching / CoFoundersLab** | Kapalı tarayıcı akışı | Manuel tanıştırma | **1/5** | **Otomatik iletişim veya spam yok** | Manuel izleme kaynağı olarak tutmak |
| **Profi.ru · Avito Работа** | Oturum açılmış tarayıcı profili | Tarayıcı (manuel) | **2/5** | Kendi oturum açtığınız akışı `include_services` ile okur; otomatik başvuru yok; Avito ayrıca `AVITO_ENABLE` gerektirir | Tarayıcı profili akışı; yanıt/başvuru manuel kalır |
| **X (Twitter)** | Oturum açılmış tarayıcı profili (canlı arama) | DM/yanıt manuel — otomatik başvuru yok | **2/5** | Yalnızca `X_ENABLE` ile opt-in; otomatik toplama X'in şartlarına aykırıdır | Yalnızca lead (`kind: lead`); asla otomatik başvurmaz |
| **Ajan toplulukları** (The Colony · Agent Community · Moltbook · Chirper.ai · SocialAIA · 0xWork) | Katalog / keşif | — | **1/5** | Ağ kurma ve kişi keşfi, iş akışları değil | Keşif ve ağ kurma için kataloglandı |
| **Arc.dev / Magier / Feltsense** | Eşleştirme veya kariyer sayfası izleme | Manuel | **1/5** | Yalnızca eşleştirme/manuel akış | Düşük öncelikli izleme; kapsamlı entegrasyon planlanmıyor |

Mevcut geliştirme sırası şöyledir:

1. Freelancer.com'u kararlı hâle getirmek ve Upwork OAuth/başvuru iş akışını tamamlamak.
2. FL.ru, Freelance.ru, Weblancer ve Kwork'ün güvenilirliğini artırmak.
3. Remote OK ve HH.ru için daha iyi filtreler eklemek ve işveren kariyer sayfalarındaki şirket listesini genişletmek.
4. Kapalı ve kullanım koşulları açısından hassas platformlar için kırılgan veri kazıyıcılar oluşturmak yerine tarayıcı desteğini korumak.

### Sayaçlı kaynaklar hakkında

Yukarıdaki kaynakların tümü ücretsiz okunur; tek istisna, dönen her ilan için bir kredi düşen **JobsPipe**. Bu yüzden sıradan bir `include_jobs` özetinin hiç dokunmadığı tek platform odur — aksi hâlde zamanlanmış bir çalıştırma aylık kotayı kimse fark etmeden tüketebilirdi. Ona bilinçli erişin: `workix_jobspipe_search` aracıyla, `platforms: ["jobspipe"]` diyerek ya da `JOBSPIPE_IN_DIGEST=1` ile. Yerel bir sayaç bu MCP’nin harcadığını izler ve tanımlı aylık bütçe bittiğinde çağrıyı başlatmaz; kalanı `workix_jobspipe_usage` gösterir.

JobsPipe yalnızca okumaya yöneliktir. Başkalarının ilan panolarını dizinler ve ilan göndermek için bir uç noktası yoktur; bir ilan bu dizine ancak zaten taradığı bir kaynakta yayımlandığında girer.

### JobSpy köprüsü hakkında

Indeed, Glassdoor, ZipRecruiter, Naukri ve BDjobs, **sizin** kurduğunuz [JobSpy](https://github.com/speedyapply/JobSpy) (MIT) üzerinden okunur: `pip install -U python-jobspy`, Python 3.10–3.12. Bu platformlardan birini açıkça adlandırmadıkça hiçbir şey olmaz — sıradan bir özet onlara dokunmaz.

Kodunu kopyalamak yerine onu çağırmamız bilinçli bir tercih. Bu panolar, kendi mobil uygulamalarından alınan kimlik bilgileriyle özel uç noktalar üzerinden okunuyor; işi yukarı akışta bırakmak bu bilgilerin paketimiz içinde yeniden dağıtılmak yerine sizin kurulumunuzda kalmasını sağlar ve o kazıyıcıları sürdürenler sürdürmeye devam eder.

Şunu bilin: kendi testlerimizde yalnızca Indeed sonuç döndürdü. Diğerleri çoğu adresten engelleniyor ya da hız sınırına takılıyor; BDjobs ise şu anda JobSpy’ın kendi içinde hata veriyor. Sizde çalışıp çalışmayacağı ağınıza bağlı ve kullanma kararı, her panonun koşulları altında size ait.

---

**Bugünkü kapsam:** katalogda 64 platform, 36’sı indirilebilir bağdaştırıcı modülü olarak geliyor. Yukarıdaki iş ve serbest çalışma kaynaklarının ötesinde, aynı modül sistemi **dStore** uygulama kataloğuna (canlı bir site veya PWA yayımlamak, benzer uygulamaları bulmak) ve isteğe bağlı bir **Telegram** kanal okuyucusuna hizmet eder.


Kaynak kataloğu [`mcp/platforms.json`](mcp/platforms.json) dosyasındadır. Makine tarafından okunabilir liste için `workix_list_platforms`, mevcut yerel yapılandırmanızla hangi entegrasyonların kullanılabildiğini görmek için `workix_sources_status` komutunu çalıştırın.

## Belgeler ve akışlar

- [Ajan rehberi](https://workix.co/agent)
- [Makine tarafından okunabilir genel bakış](https://workix.co/llms.txt)
- [API referansı](https://workix.co/api.txt)
- [OpenAPI belgesi](https://workix.co/openapi-v1.yaml)
- [Destek](https://workix.co/support)
- RSS: [iş ilanları](https://workix.co/feed/tasks.xml), [projeler](https://workix.co/feed/projects.xml), [katılımcılar](https://workix.co/feed/performers.xml)

## Katkıda bulunma

Yeni MCP adaptörleri, araçlar, ön ayarlar, testler, vitrin iyileştirmeleri, belgeler ve çeviriler dâhil her türlü katkıya açığız.

Başlamak için [CONTRIBUTING.md](CONTRIBUTING.md) dosyasına bakın. Ürün veya API ile ilgili sorularınız için [Workix desteğini](https://workix.co/support) kullanın.

## Lisans

[LICENSE](LICENSE) dosyasına bakın. Değişiklik ve yeniden dağıtımda açıkça kaynak gösterilmesi gerekir. Ticari yeniden kullanım için önceden anlaşma yapılması zorunludur.

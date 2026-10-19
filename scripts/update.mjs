// Rebuilds README.md and data/companies.json from Göçmeden's open data (https://gocmeden.hellobasalt.dev/veri/).
// Companies stay in data/companies.json after their last open job closes, so the list also records who has hired
// from Türkiye before. No dependencies; Node 20+.
import fs from 'node:fs';
const SITE = 'https://gocmeden.hellobasalt.dev';
const res = await fetch(process.env.SOURCE || `${SITE}/veri/v1/companies.json`, {headers: {'User-Agent': 'turkiye-remote-sirketler'}});
if (!res.ok) throw new Error(`companies.json: HTTP ${res.status}`);
const now = await res.json();
const day = now.generated.slice(0, 10);
const FILE = 'data/companies.json';
const past = fs.existsSync(FILE) ? JSON.parse(fs.readFileSync(FILE, 'utf8')) : {companies: {}};
const all = past.companies;
for (const c of Object.values(all)) { c.open = 0; c.eu = 0; c.roles = {}; c.jobs = []; }
for (const c of now.companies) {
  const prev = all[c.name] || {};
  all[c.name] = {name: c.name, open: c.open, eu: c.eu, roles: c.roles, jobs: c.jobs,
    first_seen: [prev.first_seen, c.first_seen].filter(Boolean).sort()[0] || day, last_seen: day};
}
fs.mkdirSync('data', {recursive: true});
fs.writeFileSync(FILE, JSON.stringify({updated: day, source: `${SITE}/veri/`, licence: now.licence, companies: all}, null, 1) + '\n');

const md = s => String(s).replace(/([|\\[\]])/g, '\\$1');
const list = Object.values(all);
const active = list.filter(c => c.open + c.eu > 0).sort((a, b) => b.open - a.open || b.eu - a.eu || a.name.localeCompare(b.name, 'tr'));
const before = list.filter(c => c.open + c.eu === 0).sort((a, b) => b.last_seen.localeCompare(a.last_seen) || a.name.localeCompare(b.name, 'tr'));
const open = active.reduce((n, c) => n + c.open, 0), eu = active.reduce((n, c) => n + c.eu, 0);
const roles = c => Object.entries(c.roles).sort((a, b) => b[1] - a[1]).map(([r]) => r).join(', ');
const jobs = c => c.jobs.slice(0, 4).map(j => `[${md(j.title)}](${j.url})${j.eligibility === 'eu' ? ' (AB)' : ''}`).join('<br>') + (c.jobs.length > 4 ? `<br>[+${c.jobs.length - 4} ilan](${SITE}/)` : '');
const readme = `# Türkiye'den işe alan remote şirketler

Türkiye'de yaşarken başvurabileceğin, şu an açık remote yazılım ilanı olan yabancı şirketler. Liste her sabah [Göçmeden](${SITE}/)'in verisinden kendiliğinden güncellenir.

**Son güncelleme: ${day}** · ${active.length} şirket · Türkiye'ye açık ${open} ilan · Türkiye'yi kapsayıp kapsamadığı belirsiz AB/EMEA ilanı ${eu}

"Remote" yazan ilanların yarısı Türkiye'den başvuruya kapalı (19 Ekim 2026'da taranan 422 ilanın 211'i): ABD şartı, Türkiye'nin olmadığı ülke listesi, AB çalışma izni. Göçmeden her ilanın metnini okuyup Türkiye'den başvurulabilir mi diye etiketliyor ve kararı veren cümleyi ilandan alıntılıyor. Gerekçe ve alıntı her ilanın Göçmeden sayfasında.

## Şu an ilanı olan şirketler

| Şirket | Türkiye'ye açık | AB (belirsiz) | Roller | İlanlar |
|---|---:|---:|---|---|
${active.map(c => `| ${md(c.name)} | ${c.open} | ${c.eu} | ${md(roles(c))} | ${jobs(c)} |`).join('\n')}
${before.length ? `
## Daha önce listede olan şirketler

Şu an Türkiye'ye açık ya da AB odaklı ilanları yok; son ilanlarını gördüğümüz gün yazıyor.

| Şirket | Son görülme | İlk görülme |
|---|---|---|
${before.map(c => `| ${md(c.name)} | ${c.last_seen} | ${c.first_seen} |`).join('\n')}
` : ''}
## Veri

- Liste: [data/companies.json](data/companies.json), her gün aynı dosya güncellenir; geçmiş commit'lerde.
- Ham veri ve alanların açıklaması: [gocmeden.hellobasalt.dev/veri/](${SITE}/veri/)
- Etiketler ilan metnine bakılarak verilir ve hatalı olabilir; bağlayıcı olan şirketin kendi ilanıdır. Hata görürsen issue aç ya da support@hellobasalt.dev'e yaz.
- Bir şirketi eklemek için issue aç: kariyer sayfası okunabilir bir ATS'deyse (Greenhouse, Lever, Ashby, Workable, Recruitee, SmartRecruiters) Göçmeden'in taramasına eklenir.

Lisans: veri ${now.licence}. Kod MIT. Göçmeden bir [Basalt](https://hellobasalt.dev/) ürünüdür.
`;
fs.writeFileSync('README.md', readme);
console.log(`${day}: ${active.length} companies with jobs, ${before.length} earlier, ${open} open, ${eu} EU`);

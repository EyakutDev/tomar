# Tomar

Kitap pasajlarını okumak ve paylaşmak için mobil öncelikli web uygulaması.

## Teknoloji

- React, Vite, TypeScript ve özel CSS
- Fastify ile Node.js API
- PostgreSQL: ortak pasaj akışı ve içerik bildirimleri
- Tarayıcı depolaması: kaydedilen pasajlar, tema ve kaldığın yer

## Yerelde çalıştırma

Node.js 22+ ile sadece arayüzü görmek için PostgreSQL gerekmez:

```powershell
npm install
npm run dev:demo
```

`http://127.0.0.1:5173` adresini açın. Önizleme, `content/curated-passages.json` içindeki gerçek kitap seçkisini gösterir. Önizlemede eklenen pasajlar ve bildirimler yalnızca o tarayıcıda saklanır; diğer kullanıcılara gitmez.

Ortak akış ve gerçek bildirimlerle çalıştırmak için PostgreSQL gerekir. Bu bilgisayardaki PostgreSQL 18 kurulumu için proje kökünde:

```powershell
npm run db:local
npm run dev
```

`db:local`, mevcut PostgreSQL servisine dokunmadan proje klasöründeki `.local/` altında ayrı bir UTF-8 veritabanı başlatır, 5433 portunu kullanır ve `.env` dosyasını oluşturur. Kullanıcıların eklediği pasajlar bu veritabanında saklanır.

Docker Desktop çalışıyorsa alternatif olarak:

```powershell
docker compose up -d db
Copy-Item .env.example .env
npm install
npm run dev
```

Web arayüzü `http://127.0.0.1:5173` adresinde açılır. API `http://127.0.0.1:3001` adresindedir. Docker kullanmıyorsanız kendi PostgreSQL sunucunuzun bağlantısını `.env` içindeki `DATABASE_URL` değerine yazın. API ilk açılışta `server/schema.sql` şemasını oluşturur.

İlk kurulumda gerçek kitap seçkisini yüklemek için `npm run seed:curated` çalıştırın. Komut tekrar çalıştırıldığında aynı pasajları çoğaltmaz ve eski uydurma örnekleri yayından kaldırır. Seçkide pasaj metni, kitap/yazar adı, varsa çevirmen, özgün metin bağlantısı ve hak araştırması bağlantısı tutulur. Türkçe eserler özgün metinlerden seçilir. Shakespeare ve Machiavelli pasajları özgün dillerinden Tomar için çevrilmiş seçki taslaklarıdır; yayımlanmış modern Türkçe çevirilerden alınmamıştır. Yayın öncesinde çeviri ve kaynak bilgileri editör tarafından son kez karşılaştırılmalıdır. Koruma süresi ve işlenme eserlerin bağımsızlığı için [Kültür ve Turizm Bakanlığı açıklamasına](https://telifhaklari.ktb.gov.tr/TR-332373/telif-hakki-kac-yil-sureyle-korunur.html) bakın.

Yeni seçki için ölçü: pasaj tek başına okununca anlamlı bir düşünce, duygu veya karakter taşımalı; metin özgün kaynaktan karşılaştırılmalı; kitap, yazar ve açılabilir kaynak bağlantısı bulunmalı. Uzunluk tek başına kalite ölçüsü değildir; anlamlı kısa pasaj da alınır. Yazarı ve çeviriyi ayrı ayrı hak yönünden kontrol edin. Yalnızca akışı doldurmak için kısa, bağlamsız cümleler eklemeyin. Tanpınar için yayın bekleme notları [hak kuyruğunda](content/rights-queue.md). Okurlar paylaşım yaparken isteğe bağlı HTTPS metin bağlantısı ekleyebilir. Bu gönderiler akışta Tomar seçkisinden ayrı işaretlenir ve kaynak doğrulaması yapılmış içerik olarak sunulmaz.

## Kontroller ve üretim derlemesi

```powershell
npm run check
npm test
npm run build
npm start
```

Üretimde API'yi ters vekil sunucunun arkasında çalıştırın. Vekil dışında doğrudan erişim kapalıysa `TRUST_PROXY=true` ayarlayın; böylece gönderi hız sınırı ziyaretçinin IP adresini kullanır. PostgreSQL verisini kalıcı depolamada tutup düzenli yedekleyin. Bağımlılıklar `package-lock.json` ile sabitlenir.

## İçerik bildirimleri

Okurlar pasajın kaynak kartından telif, spam veya yanlış kaynak bildirimi gönderebilir. Sunucu operatörü bildirimleri ve kaldırma işlemlerini şu komutlarla yönetir:

```powershell
npm run moderate -- list
npm run moderate -- remove 12
npm run moderate -- resolve 5
```

Bu komutlar `npm run build` sonrasında, `.env` ve PostgreSQL bağlantısı hazırken çalışır. Kullanıcı gönderileri doğrudan yayınlanır; başlangıçta hesap açma veya manuel ön onay yoktur.

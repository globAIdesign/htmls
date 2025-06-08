// Gerekli paketleri çağırıyoruz
require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const multer = require('multer');
const path = require('path');
const cloudinary = require('cloudinary').v2;
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const cors = require('cors'); // CORS HATALARINI ÖNLEMEK İÇİN YENİ PAKET

const app = express();
const PORT = process.env.PORT || 3000; // Render'ın vereceği portu kullan

// --- YENİ: CORS Middleware'i ---
// Farklı adreslerden (Netlify -> Render) gelen isteklere izin ver
app.use(cors());

// --- YENİ: Cloudinary Yapılandırması ---
cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET
});

// --- YENİ: Cloudinary Depolama Ayarı ---
// server.js içinde
const storage = new CloudinaryStorage({
    cloudinary: cloudinary,
    params: {
        folder: 'fotogaleri',
        allowed_formats: ['jpeg', 'png', 'jpg'],
        // YENİ EKLENEN SATIR: Yüklenirken optimizasyon yap
        transformation: [{ width: 1920, height: 1080, crop: "limit", quality: "auto" }]
    }
});
const upload = multer({ storage: storage });

// --- Veritabanı Bağlantısı (Aynı kaldı) ---
mongoose.connect(process.env.MONGO_URI)
    .then(() => console.log("MongoDB'ye başarıyla bağlanıldı."))
    .catch(err => console.error('MongoDB bağlantı hatası:', err));

// --- Veritabanı Modeli (Şema) (Aynı kaldı) ---
const PhotoSchema = new mongoose.Schema({
    title: String,
    description: String,
    // filename yerine path'i kullanacağız, Cloudinary bize tam URL verecek
    path: String, // Resmin Cloudinary'deki URL'si
    public_id: String, // Resmi silmek için gerekli olan Cloudinary ID'si
    createdAt: { type: Date, default: Date.now }
});
const Photo = mongoose.model('Photo', PhotoSchema);

// --- Middleware Ayarları (Aynı kaldı) ---
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// --- API Rotaları (DEĞİŞTİ) ---

// Ana sayfa için basit bir karşılama mesajı
app.get('/', (req, res) => {
    res.send('Galeri Backend Sunucusu Çalışıyor!');
});

// a) Fotoğraf yükleme rotası (DEĞİŞTİ)
app.post('/upload', upload.single('image'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).send("Lütfen bir resim dosyası seçin.");
        }

        const newPhoto = new Photo({
            title: req.body.title,
            description: req.body.description,
            path: req.file.path, // Cloudinary'den gelen güvenli URL
            public_id: req.file.filename // Cloudinary'den gelen silme ID'si
        });

        await newPhoto.save();
        res.status(201).json(newPhoto); // Başarı yanıtı olarak yeni fotoğrafı döndür
    } catch (error) {
        console.error("Yükleme sırasında hata:", error);
        res.status(500).send('Fotoğraf yüklenirken bir sunucu hatası oluştu.');
    }
});

// b) Tüm fotoğrafları getirme rotası (Aynı kaldı)
app.get('/photos', async (req, res) => {
    try {
        const photos = await Photo.find().sort({ createdAt: -1 });
        res.json(photos);
    } catch (error) {
        res.status(500).send('Fotoğraflar getirilirken hata oluştu.');
    }
});

// --- Sunucuyu Başlatma (Aynı kaldı) ---
app.listen(PORT, () => {
    console.log(`Sunucu http://localhost:${PORT} adresinde çalışıyor.`);
});
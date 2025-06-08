// Gerekli paketleri çağırıyoruz
require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const multer = require('multer');
const path = require('path');
const cloudinary = require('cloudinary').v2;
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;

// CORS Middleware'i
app.use(cors()); // Şimdilik basit tutalım, tüm isteklere izin versin

// Cloudinary Yapılandırması
cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET
});

// Cloudinary Depolama Ayarı
const storage = new CloudinaryStorage({
    cloudinary: cloudinary,
    params: {
        folder: 'fotogaleri',
        allowed_formats: ['jpeg', 'png', 'jpg'],
        transformation: [{ width: 1920, height: 1080, crop: "limit", quality: "auto" }]
    }
});
const upload = multer({ storage: storage });

// Veritabanı Bağlantısı
mongoose.connect(process.env.MONGO_URI)
    .then(() => console.log("MongoDB'ye başarıyla bağlanıldı."))
    .catch(err => console.error('MongoDB bağlantı hatası:', err));

// --- 1. DEĞİŞİKLİK: Veritabanı Modeli (Şema) Güncellendi ---
const PhotoSchema = new mongoose.Schema({
    title: String,
    description: String,
    path: String,
    public_id: String,
    tags: [String], // Etiketleri bir metin dizisi olarak sakla
    createdAt: { type: Date, default: Date.now }
});
const Photo = mongoose.model('Photo', PhotoSchema);

// Middleware Ayarları
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// --- API Rotaları ---
app.get('/', (req, res) => {
    res.send('Galeri Backend Sunucusu Çalışıyor!');
});

// --- 2. DEĞİŞİKLİK: Fotoğraf yükleme rotası güncellendi ---
app.post('/upload', upload.single('image'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).send("Lütfen bir resim dosyası seçin.");
        }

        // Formdan gelen etiketleri al (örn: "deniz, fatih, melih")
        const tagsString = req.body.tags || '';
        // Virgülle ayrılmış metni bir diziye çevir, boşlukları temizle ve boş etiketleri kaldır
        const tagsArray = tagsString.split(',')
                                    .map(tag => tag.trim())
                                    .filter(tag => tag.length > 0);

        const newPhoto = new Photo({
            title: req.body.title,
            description: req.body.description,
            path: req.file.path,
            public_id: req.file.filename,
            tags: tagsArray // Diziye çevrilmiş etiketleri kaydet
        });

        await newPhoto.save();
        res.status(201).json(newPhoto);
    } catch (error) {
        console.error("Yükleme sırasında hata:", error);
        res.status(500).send('Fotoğraf yüklenirken bir sunucu hatası oluştu.');
    }
});

// Tüm fotoğrafları getirme rotası
app.get('/photos', async (req, res) => {
    try {
        const photos = await Photo.find().sort({ createdAt: -1 });
        res.json(photos);
    } catch (error) {
        res.status(500).send('Fotoğraflar getirilirken hata oluştu.');
    }
});

// Sunucuyu Başlatma
app.listen(PORT, () => {
    console.log(`Sunucu http://localhost:${PORT} adresinde çalışıyor.`);
});
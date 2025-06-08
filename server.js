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
const corsOptions = {
  origin: '*',
  methods: "GET,HEAD,PUT,PATCH,POST,DELETE",
  preflightContinue: false,
  optionsSuccessStatus: 204
};
app.use(cors(corsOptions));

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

// --- Veritabanı Modelleri ---
const CommentSchema = new mongoose.Schema({
    username: { type: String, required: true },
    text: { type: String, required: true },
    // YENİ: Her yorum için gizli bir silme anahtarı
    deleteKey: { type: String, required: true, select: false }, // select: false, bu alanın normal sorgularda gelmesini engeller
    createdAt: { type: Date, default: Date.now }
});
const PhotoSchema = new mongoose.Schema({
    title: String,
    description: String,
    path: String,
    public_id: String,
    tags: [String],
    comments: [CommentSchema],
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

app.post('/upload', upload.single('image'), async (req, res) => {
    try {
        if (!req.file) return res.status(400).send("Lütfen bir resim dosyası seçin.");
        const tagsString = req.body.tags || '';
        const tagsArray = tagsString.split(',').map(tag => tag.trim()).filter(tag => tag.length > 0);
        const newPhoto = new Photo({
            title: req.body.title, description: req.body.description,
            path: req.file.path, public_id: req.file.filename,
            tags: tagsArray
        });
        await newPhoto.save();
        res.status(201).json(newPhoto);
    } catch (error) {
        console.error("Yükleme sırasında hata:", error);
        res.status(500).send('Fotoğraf yüklenirken bir sunucu hatası oluştu.');
    }
});

app.get('/photos', async (req, res) => {
    try {
        const photos = await Photo.find().sort({ createdAt: -1 });
        res.json(photos);
    } catch (error) {
        res.status(500).send('Fotoğraflar getirilirken hata oluştu.');
    }
});

app.post('/photos/:id/comments', async (req, res) => {
    try {
        const photo = await Photo.findById(req.params.id);
        if (!photo) return res.status(404).send('Fotoğraf bulunamadı.');

        const newComment = {
            username: req.body.username,
            text: req.body.text,
            deleteKey: req.body.deleteKey // YENİ: Frontend'den gelen anahtarı al
        };

        photo.comments.push(newComment);
        await photo.save();
        res.status(201).json(photo);
    } catch (error) {
        // ...
    }
});

app.delete('/photos/:photoId/comments/:commentId', async (req, res) => {
    try {
        const { photoId, commentId } = req.params;
        // YENİ: Silme anahtarını isteğin gövdesinden (body) al
        const { deleteKey } = req.body;

        if (!deleteKey) {
            return res.status(403).send('Silme anahtarı eksik.'); // 403 Forbidden
        }

        const photo = await Photo.findOne({ _id: photoId, "comments._id": commentId });
        if (!photo) return res.status(404).send('Yorum veya fotoğraf bulunamadı.');

        // Yorumu bul ve anahtarı kontrol et
        const commentToDelete = photo.comments.id(commentId);
        // Doğrudan anahtarı çekmek için özel bir sorgu gerekiyor
        const realComment = await Photo.findOne(
            { "comments._id": commentId },
            { "comments.$": 1 }
        ).select("+comments.deleteKey"); // select:false olduğu için zorla getir

        if (!realComment || realComment.comments[0].deleteKey !== deleteKey) {
            return res.status(403).send('Bu yorumu silme yetkiniz yok.');
        }

        // Anahtar doğruysa, silme işlemini yap
        photo.comments.pull(commentId);
        await photo.save();
        
        res.status(200).json(photo);

    } catch (error) {
        console.error("Yorum silinirken hata:", error);
        res.status(500).send('Yorum silinirken bir sunucu hatası oluştu.');
    }
});

// Sunucuyu Başlatma
app.listen(PORT, () => {
    console.log(`Sunucu http://localhost:${PORT} adresinde çalışıyor.`);
});